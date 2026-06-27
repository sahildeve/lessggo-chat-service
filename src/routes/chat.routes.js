import { Router } from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { protectInternal } from "../middlewares/internal.middleware.js";
import {
  getChatHistory,
  deleteMessage,
  deleteRideChat,
  markChatRead,
  postInternalSystemMessage,
  closeInternalRideChat,
} from "../controllers/chat.controller.js";

const router = Router();

router.get("/:rideId/history", protect, getChatHistory);
router.patch("/:rideId/read", protect, markChatRead);
router.delete("/message/:messageId", protect, deleteMessage);
router.delete("/:rideId/delete-all", protect, deleteRideChat);

router.post(
  "/internal/:rideId/system-message",
  protectInternal,
  postInternalSystemMessage,
);
router.post("/internal/:rideId/close", protectInternal, closeInternalRideChat);

export default router;
