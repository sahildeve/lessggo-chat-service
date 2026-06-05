import * as chatService from "../services/chat.service.js";
import { success, error } from "../utils/response.js";
import logger from "../utils/logger.js";

// ─── Get Chat History
export const getChatHistory = async (req, res) => {
  try {
    const { rideId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;

    const data = await chatService.getChatHistory(rideId, page, limit);
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
    await chatService.deleteRideChat(rideId);
    return success(res, {}, "Chat deleted successfully");
  } catch (err) {
    logger.error("Delete ride chat error:", {
      message: err.message,
      stack: err.stack,
    });
    return error(res, err.message, err.status || 500);
  }
};
