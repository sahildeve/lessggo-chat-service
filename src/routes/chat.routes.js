import { Router } from "express";
import { protect } from "../middlewares/auth.middleware.js";
import {
  getChatHistory,
  deleteMessage,
  deleteRideChat
} from "../controllers/chat.controller.js";

const router = Router();

// ─── Chat Routes
router.get("/:rideId/history", protect, getChatHistory);
router.delete("/message/:messageId", protect, deleteMessage);

router.delete('/:rideId/delete-all', protect, deleteRideChat);
export default router;
