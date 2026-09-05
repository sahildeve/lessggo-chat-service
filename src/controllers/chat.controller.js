import * as chatService from "../services/chat.service.js";
import { success, error } from "../utils/response.js";
import logger from "../utils/logger.js";

// ─── Get Chat History
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

// ─── Delete Message
export const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    await chatService.deleteMessage(messageId, req.user.sub);
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
    await chatService.deleteRideChat(rideId, req.user.sub);
    return success(res, {}, "Chat deleted successfully");
  } catch (err) {
    logger.error("Delete ride chat error:", {
      message: err.message,
      stack: err.stack,
    });
    return error(res, err.message, err.status || 500);
  }
};

// ─── Internal: Post System Message (location service se)
export const postSystemMessage = async (req, res) => {
  try {
    const { rideId } = req.params;
    const { message } = req.body;

    if (!message?.trim()) {
      return error(res, "message is required", 400);
    }

    const savedMsg = await chatService.saveSystemMessage(
      rideId,
      message.trim(),
    );

    const io = req.app.get("io");
    if (io) {
      io.to(rideId).emit("system_message", {
        message: savedMsg.message,
        timestamp: savedMsg.createdAt,
      });
    }

    return success(res, {}, "System message posted");
  } catch (err) {
    logger.error("Post system message error:", {
      message: err.message,
      stack: err.stack,
    });
    return error(res, err.message, err.status || 500);
  }
};

// ─── Internal: Close Ride Chat (location service se)
export const closeRideChat = async (req, res) => {
  try {
    const { rideId } = req.params;
    const { reason } = req.body;

    const savedMsg = await chatService.closeRideChat(rideId, reason);

    const io = req.app.get("io");
    if (io) {
      io.to(rideId).emit("chat_closed", {
        rideId,
        message: savedMsg.message,
        timestamp: savedMsg.createdAt,
      });
    }

    return success(res, {}, "Ride chat closed");
  } catch (err) {
    logger.error("Close ride chat error:", {
      message: err.message,
      stack: err.stack,
    });
    return error(res, err.message, err.status || 500);
  }
};
