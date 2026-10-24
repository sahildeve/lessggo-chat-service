import pubsub from "../config/pubsub.js";
import logger from "../utils/logger.js";
import * as chatService from "../services/chat.service.js";
import { handleSubscriberError } from "../utils/subscriberError.js";
import {
  alreadyProcessed,
  markProcessed,
  releaseProcessed,
} from "../utils/messageDedupe.js";

import ChatMessage from "../models/Message.js"; 

const SUBSCRIPTION_NAME = process.env.CHAT_EVENTS_SUB || "chat-events-sub";

// Dedupe claim aur release dono me same hona chahiye
const SUBSCRIBER_CONTEXT = "chat-service:chatSubscriber";

export const startChatSubscriber = (io) => {
  try {
    const subscription = pubsub.subscription(SUBSCRIPTION_NAME);

    subscription.on("message", async (message) => {
      try {
        const parsedData = JSON.parse(message.data.toString());
        const { eventType, payload } = parsedData;

        // ── Duplicate delivery (Pub/Sub at-least-once) — pehle hi process ho chuka
        if (await alreadyProcessed(message.id, SUBSCRIBER_CONTEXT)) {
          logger.info(
            `Skipped duplicate chat event: ${eventType} (MsgID: ${message.id})`,
          );
          message.ack();
          return;
        }

        // ── 1. RIDE_CHAT_JOINED ──
        if (eventType === "RIDE_CHAT_JOINED") {
          const { rideId, userId, displayName } = payload;
          const sysMsg = await chatService.saveSystemMessage(
            rideId,
            `${displayName} joined the chat`
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
            text
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
            `${displayName} left the chat`
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
                message: "This message was removed because the user deleted their account." 
              } 
            }
          );

          logger.info(`Wiped out all ride chat data for deleted user: ${userId}`);
        }

        message.ack();
        await markProcessed(message.id, SUBSCRIBER_CONTEXT);
        logger.info(`Processed chat event: ${eventType} (MsgID: ${message.id})`);
      } catch (err) {
        // Fail hua — claim hata do, warna retry duplicate samajh ke skip ho jayega
        await releaseProcessed(message.id, SUBSCRIBER_CONTEXT);
        handleSubscriberError(message, err, logger, SUBSCRIBER_CONTEXT);
      }
    });

    subscription.on("error", (error) => {
      logger.error("Chat Pub/Sub subscription error:", { message: error.message });
    });

    logger.info(`Chat Subscriber listening on ${SUBSCRIPTION_NAME}`);
  } catch (err) {
    logger.error("Failed to start Chat Subscriber:", { message: err.message });
  }
};