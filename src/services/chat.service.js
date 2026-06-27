import Message from "../models/Message.js";
import redis from "../config/redis.js";
import logger from "../utils/logger.js";
import { assertRideMember } from "../utils/rideMembership.js";

const READ_KEY_TTL = 86400 * 7;

const readKey = (rideId, userId) => `chat_read:${rideId}:${userId}`;

const attachReadStatus = (messages, userId, lastReadAt) => {
  const lastReadTime = lastReadAt ? new Date(lastReadAt).getTime() : 0;

  return messages.map((msg) => ({
    ...msg,
    isRead:
      msg.senderId?.toString() === userId ||
      new Date(msg.createdAt).getTime() <= lastReadTime,
  }));
};

export const getLastReadAt = async (rideId, userId) => {
  return redis.get(readKey(rideId, userId));
};

export const markAsRead = async (rideId, userId) => {
  await assertRideMember(rideId, userId);
  await redis.set(readKey(rideId, userId), new Date().toISOString(), "EX", READ_KEY_TTL);
  return true;
};

export const getUnreadCount = async (rideId, userId) => {
  const lastReadAt = await getLastReadAt(rideId, userId);
  const query = {
    rideId,
    isDeleted: false,
    senderId: { $ne: userId },
  };

  if (lastReadAt) {
    query.createdAt = { $gt: new Date(lastReadAt) };
  }

  return Message.countDocuments(query);
};

export const saveMessage = async (
  rideId,
  senderId,
  senderUsername,
  message,
) => {
  const msg = await Message.create({
    rideId,
    senderId,
    senderUsername,
    message,
    messageType: "text",
  });
  return msg;
};

export const getChatHistory = async (rideId, userId, page = 1, limit = 50) => {
  await assertRideMember(rideId, userId);

  const skip = (page - 1) * limit;
  const lastReadAt = await getLastReadAt(rideId, userId);

  const messages = await Message.find({
    rideId,
    isDeleted: false,
  })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const total = await Message.countDocuments({ rideId, isDeleted: false });
  const unreadCount = await getUnreadCount(rideId, userId);

  return {
    messages: attachReadStatus(messages.reverse(), userId, lastReadAt),
    unreadCount,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: page < Math.ceil(total / limit),
    },
  };
};

export const deleteMessage = async (messageId, userId) => {
  const message = await Message.findById(messageId);

  if (!message) {
    const err = new Error("Message not found");
    err.status = 404;
    throw err;
  }

  await assertRideMember(message.rideId.toString(), userId);

  if (message.senderId.toString() !== userId) {
    const err = new Error("You can only delete your own messages");
    err.status = 403;
    throw err;
  }

  message.isDeleted = true;
  await message.save();
  return message;
};

export const saveSystemMessage = async (rideId, message) => {
  const msg = await Message.create({
    rideId,
    senderId: "000000000000000000000000",
    senderUsername: "System",
    message,
    messageType: "system",
  });
  return msg;
};

export const deleteRideChat = async (rideId) => {
  await Message.deleteMany({ rideId });
  logger.info(`Chat deleted for ride: ${rideId}`);
  return true;
};
