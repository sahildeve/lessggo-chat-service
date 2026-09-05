import Message from "../models/Message.js";
import logger from "../utils/logger.js";
import redis from "../config/redis.js";

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
  // ── Membership check — Redis me ride members store hote hain
  const isMember = await redis.sismember(`ride_members:${rideId}`, userId);

  if (!isMember) {
    const err = new Error("You are not a member of this ride");
    err.status = 403;
    throw err;
  }

  const skip = (page - 1) * limit;

  const messages = await Message.find({
    rideId,
    isDeleted: false,
  })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const total = await Message.countDocuments({ rideId, isDeleted: false });

  return {
    messages: messages.reverse(),
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
  if (message.senderId.toString() !== userId) {
    const err = new Error("You can only delete your own messages");
    err.status = 403;
    throw err;
  }

  message.isDeleted = true;
  await message.save();
  return true;
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

// ─── Delete All Messages of a Ride (ride end hone pe)
export const deleteRideChat = async (rideId, userId) => {
  // ── Membership check — sirf ride ka member hi chat delete kar sake
  const isMember = await redis.sismember(`ride_members:${rideId}`, userId);

  if (!isMember) {
    const err = new Error("You are not a member of this ride");
    err.status = 403;
    throw err;
  }

  await Message.deleteMany({ rideId });
  logger.info(`Chat deleted for ride: ${rideId}`);
  return true;
};

// ─── Close ride chat (internal — location service se)
export const closeRideChat = async (rideId, reason) => {
  const msg = await Message.create({
    rideId,
    senderId: "000000000000000000000000",
    senderUsername: "System",
    message: reason || "This ride chat has been closed",
    messageType: "system",
  });

  logger.info(`Ride chat closed: ${rideId}`);
  return msg;
};