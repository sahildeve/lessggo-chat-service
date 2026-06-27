import * as chatService from "../services/chat.service.js";
import { assertRideMember } from "../utils/rideMembership.js";
import { success, error } from "../utils/response.js";
import logger from "../utils/logger.js";

export const getChatHistory = async (req, res) => {
  try {
    const { rideId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;

    const data = await chatService.getChatHistory(
      rideId,
      req.user.sub,
      page,
      limit,
    );
    return success(res, data, "Chat history fetched successfully");
  } catch (err) {
    logger.error("Get chat history error:", {
      message: err.message,
      stack: err.stack,
    });
    return error(res, err.message, err.status || 500);
  }
};

export const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const message = await chatService.deleteMessage(messageId, req.user.sub);

    const io = req.app.get("io");
    if (io) {
      io.to(message.rideId.toString()).emit("message_deleted", {
        conversationId: message.rideId.toString(),
        messageId: message._id.toString(),
      });
    }

    return success(res, {}, "Message deleted successfully");
  } catch (err) {
    logger.error("Delete message error:", {
      message: err.message,
      stack: err.stack,
    });
    return error(res, err.message, err.status || 500);
  }
};

export const deleteRideChat = async (req, res) => {
  try {
    const { rideId } = req.params;
    await assertRideMember(rideId, req.user.sub);
    await chatService.deleteRideChat(rideId);

    const io = req.app.get("io");
    if (io) {
      io.to(rideId).emit("chat_cleared", { conversationId: rideId });
    }

    return success(res, {}, "Chat deleted successfully");
  } catch (err) {
    logger.error("Delete ride chat error:", {
      message: err.message,
      stack: err.stack,
    });
    return error(res, err.message, err.status || 500);
  }
};

export const markChatRead = async (req, res) => {
  try {
    const { rideId } = req.params;
    await chatService.markAsRead(rideId, req.user.sub);

    const io = req.app.get("io");
    if (io) {
      io.to(rideId).emit("message_read", {
        conversationId: rideId,
        userId: req.user.sub,
      });
    }

    return success(res, {}, "Chat marked as read");
  } catch (err) {
    logger.error("Mark chat read error:", {
      message: err.message,
      stack: err.stack,
    });
    return error(res, err.message, err.status || 500);
  }
};

export const postInternalSystemMessage = async (req, res) => {
  try {
    const { rideId } = req.params;
    const { message } = req.body;

    if (!message?.trim()) {
      return error(res, "Message is required", 400);
    }

    const sysMsg = await chatService.saveSystemMessage(rideId, message.trim());

    const io = req.app.get("io");
    if (io) {
      io.to(rideId).emit("system_message", {
        messageId: sysMsg._id,
        conversationId: rideId,
        rideId,
        senderId: sysMsg.senderId,
        senderUsername: sysMsg.senderUsername,
        message: sysMsg.message,
        messageType: sysMsg.messageType,
        timestamp: sysMsg.createdAt,
      });
    }

    return success(res, { message: sysMsg }, "System message posted");
  } catch (err) {
    logger.error("Post internal system message error:", {
      message: err.message,
      stack: err.stack,
    });
    return error(res, err.message, err.status || 500);
  }
};

export const closeInternalRideChat = async (req, res) => {
  try {
    const { rideId } = req.params;
    const { reason } = req.body;

    await chatService.deleteRideChat(rideId);

    const io = req.app.get("io");
    if (io) {
      io.to(rideId).emit("chat_closed", {
        conversationId: rideId,
        rideId,
        reason: reason || "Ride chat has been closed",
      });
    }

    return success(res, {}, "Ride chat closed");
  } catch (err) {
    logger.error("Close internal ride chat error:", {
      message: err.message,
      stack: err.stack,
    });
    return error(res, err.message, err.status || 500);
  }
};
