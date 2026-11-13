import pubsub from "../config/pubsub.js";
import logger from "../utils/logger.js";
import * as chatService from "../services/chat.service.js";
import { handleSubscriberError } from "../utils/subscriberError.js";
import {
  claimMessage,
  markProcessed,
  releaseProcessed,
} from "../utils/messageDedupe.js";
import redis from "../config/redis.js";

import ChatMessage from "../models/Message.js";

const SUBSCRIPTION_NAME = process.env.CHAT_EVENTS_SUB || "chat-events-sub";

// Dedupe claim aur release dono me same hona chahiye
const SUBSCRIBER_CONTEXT = "chat-service:chatSubscriber";

// ── Subscription lifecycle (CHAT-06) ──
const activeSubscriptions = new Map();
const restartAttempts = new Map();
const pendingRestarts = new Set();
let stopping = false;

const scheduleRestart = (io, subscriptionName) => {
  if (stopping || pendingRestarts.has(subscriptionName)) return;
  const attempt = restartAttempts.get(subscriptionName) || 0;
  const delay = Math.min(30_000, 1000 * 2 ** attempt);
  restartAttempts.set(subscriptionName, attempt + 1);
  pendingRestarts.add(subscriptionName);
  logger.warn("Restarting chat subscription", {
    subscriptionName,
    inMs: delay,
  });
  setTimeout(async () => {
    pendingRestarts.delete(subscriptionName);
    const old = activeSubscriptions.get(subscriptionName);
    activeSubscriptions.delete(subscriptionName);
    try {
      old?.removeAllListeners();
      await old?.close();
    } catch {
      // already closed
    }
    startChatSubscriber(io, subscriptionName);
  }, delay);
};

export const stopChatSubscribers = async () => {
  stopping = true;
  await Promise.allSettled(
    [...activeSubscriptions.values()].map((s) => s.close()),
  );
};

// subscriptionName param — same handler do subscriptions pe chalta hai
// (chat-events + auth-events ka USER_DELETED); eventType pe branch karta hai
export const startChatSubscriber = (
  io,
  subscriptionName = SUBSCRIPTION_NAME,
) => {
  try {
    if (stopping) return;
    // At most 50 messages in flight per subscription (CHAT-06).
    const subscription = pubsub.subscription(subscriptionName, {
      flowControl: { maxMessages: 50, allowExcessMessages: false },
    });
    activeSubscriptions.set(subscriptionName, subscription);

    subscription.on("message", async (message) => {
      try {
        const parsedData = JSON.parse(message.data.toString());
        const { eventType, payload } = parsedData;

        // ── Duplicate delivery (Pub/Sub at-least-once)
        const claim = await claimMessage(message.id, SUBSCRIBER_CONTEXT);
        if (claim === "done") {
          message.ack();
          return;
        }
        if (claim === "in_progress") {
          // Another worker has it, or one died mid-way (CHAT-05): retry later.
          message.nack();
          return;
        }

        // ── Chat events: the sender must still be a ride member (CHAT-07).
        // The gateway checked at send time; check again here, since membership
        // can end between the two.
        if (
          [
            "SEND_RIDE_CHAT_MESSAGE",
            "RIDE_CHAT_JOINED",
            "RIDE_CHAT_LEFT",
          ].includes(eventType)
        ) {
          const { rideId, userId } = payload || {};
          const validIds =
            /^[a-f\d]{24}$/i.test(String(rideId)) &&
            /^[a-f\d]{24}$/i.test(String(userId));
          const isMember =
            validIds &&
            (await redis.sismember(`ride_members:${rideId}`, String(userId)));
          if (!isMember) {
            message.ack();
            await markProcessed(message.id, SUBSCRIBER_CONTEXT);
            return;
          }
        }

        // ── 1. RIDE_CHAT_JOINED ──
        if (eventType === "RIDE_CHAT_JOINED") {
          const { rideId, userId, displayName } = payload;
          const sysMsg = await chatService.saveSystemMessage(
            rideId,
            `${displayName} joined the chat`,
          );

          if (io) {
            io.to(rideId).emit("system_message", {
              message: sysMsg.message,
              timestamp: sysMsg.createdAt,
            });
          }
        }

        // ── 2. SEND_RIDE_CHAT_MESSAGE ──
        if (eventType === "SEND_RIDE_CHAT_MESSAGE") {
          const { rideId, userId, displayName, text } = payload;

          const savedMsg = await chatService.saveMessage(
            rideId,
            userId,
            displayName,
            text,
          );

          if (io) {
            io.to(rideId).emit("new_message", {
              messageId: savedMsg._id,
              senderId: userId,
              senderUsername: displayName,
              message: savedMsg.message,
              timestamp: savedMsg.createdAt,
            });
          }
        }

        // ── 3. RIDE_CHAT_LEFT ──
        if (eventType === "RIDE_CHAT_LEFT") {
          const { rideId, userId, displayName } = payload;
          const sysMsg = await chatService.saveSystemMessage(
            rideId,
            `${displayName} left the chat`,
          );

          if (io) {
            io.to(rideId).emit("system_message", {
              message: sysMsg.message,
              timestamp: sysMsg.createdAt,
            });
          }
        }

        // ── 4. USER_DELETED (Wipe out chat data) ──
        if (eventType === "USER_DELETED") {
          const { userId } = payload;

          // User ke bheje gaye saare ride chat messages ko anonymize
          await ChatMessage.updateMany(
            { senderId: userId },
            {
              $set: {
                senderUsername: "Deleted User",
                message:
                  "This message was removed because the user deleted their account.",
              },
            },
          );

          logger.info(
            `Wiped out all ride chat data for deleted user: ${userId}`,
          );
        }
        message.ack();
        await markProcessed(message.id, SUBSCRIBER_CONTEXT);
        restartAttempts.set(subscriptionName, 0); // healthy again
        logger.debug(
          `Processed chat event: ${eventType} (MsgID: ${message.id})`,
        );
      } catch (err) {
        // Fail hua — claim hata do, warna retry duplicate samajh ke skip ho jayega
        await releaseProcessed(message.id, SUBSCRIBER_CONTEXT);
        handleSubscriberError(message, err, logger, SUBSCRIBER_CONTEXT);
      }
    });

    subscription.on("error", (error) => {
      logger.error("Chat Pub/Sub subscription error:", {
        subscription: subscriptionName,
        message: error.message,
      });
      // Restart only when the stream actually fails (CHAT-06).
      scheduleRestart(io, subscriptionName);
    });

    logger.info(`Chat Subscriber listening on ${subscriptionName}`);
  } catch (err) {
    logger.error("Failed to start Chat Subscriber:", { message: err.message });
    scheduleRestart(io, subscriptionName);
  }
};
