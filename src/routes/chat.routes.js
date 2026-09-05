import { Router } from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { internalAuth } from "../middlewares/internalAuth.middleware.js";
import {
  getChatHistory,
  deleteMessage,
  deleteRideChat,
  postSystemMessage,
  closeRideChat,
} from "../controllers/chat.controller.js";

const router = Router();

// ─── Internal Routes (service-to-service, no user token)
router.post(
  "/internal/:rideId/system-message",
  internalAuth,
  postSystemMessage,
);
router.post("/internal/:rideId/close", internalAuth, closeRideChat);

// ─── Chat Routes
router.get("/:rideId/history", protect, getChatHistory);
router.delete("/message/:messageId", protect, deleteMessage);
router.delete("/:rideId/delete-all", protect, deleteRideChat);

export default router;
