import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import redis from "./config/redis.js";
import * as chatService from "./services/chat.service.js";
import { isRideMember } from "./utils/rideMembership.js";
import logger from "./utils/logger.js";

const initSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.ALLOWED_ORIGINS?.split(",") || "*",
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token || socket.handshake.query?.auth;
      if (!token) return next(new Error("No token provided"));

      const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, {
        issuer: "cab-auth-service",
        audience: "cab-app",
      });

      socket.user = decoded;
      next();
    } catch (err) {
      next(new Error("Authentication failed"));
    }
  });

  io.on("connection", (socket) => {
    logger.info(`User connected to chat: ${socket.user.username}`);

    socket.on("join_chat", async (rideId) => {
      try {
        const isMember = await isRideMember(rideId, socket.user.sub);

        if (!isMember) {
          socket.emit("error", {
            message: "You are not a member of this ride",
          });
          return;
        }

        socket.join(rideId);
        logger.info(`${socket.user.username} joined chat room: ${rideId}`);
      } catch (err) {
        logger.error("Join chat error:", err.message);
        socket.emit("error", { message: err.message });
      }
    });

    socket.on("send_message", async ({ rideId, message, tempId }) => {
      console.log(`Received message from ${socket.user.username} in ride ${rideId}: ${message}`);
      try {
        if (!message?.trim()) return;
        if (message.length > 500) {
          socket.emit("error", { message: "Message too long (max 500 chars)" });
          return;
        }

        const isMember = await isRideMember(rideId, socket.user.sub);
        if (!isMember) {
          socket.emit("error", {
            message: "You are not a member of this ride",
          });
          return;
        }

        const savedMsg = await chatService.saveMessage(
          rideId,
          socket.user.sub,
          socket.user.username,
          message.trim(),
        );

        io.to(rideId).emit("new_message", {
          messageId: savedMsg._id,
          tempId,
          conversationId: rideId,
          rideId,
          senderId: socket.user.sub,
          senderUsername: socket.user.username,
          message: savedMsg.message,
          messageType: savedMsg.messageType,
          timestamp: savedMsg.createdAt,
        });
      } catch (err) {
        logger.error("Send message error:", err.message);
        socket.emit("error", { message: err.message });
      }
    });

    socket.on("leave_chat", (rideId) => {
      socket.leave(rideId);
      logger.info(`${socket.user.username} left chat room: ${rideId}`);
    });

    socket.on("typing", ({ rideId, isTyping }) => {
      const event = isTyping ? "typing_start" : "typing_stop";
      socket.to(rideId).emit(event, {
        conversationId: rideId,
        userId: socket.user.sub,
        username: socket.user.username,
      });
    });

    socket.on("mark_read", async ({ rideId }) => {
      try {
        const isMember = await isRideMember(rideId, socket.user.sub);
        if (!isMember) return;

        await chatService.markAsRead(rideId, socket.user.sub);
        socket.to(rideId).emit("message_read", {
          conversationId: rideId,
          userId: socket.user.sub,
        });
      } catch (err) {
        logger.error("Mark read error:", err.message);
      }
    });

    socket.on("disconnect", () => {
      logger.info(`User disconnected from chat: ${socket.user.username}`);
    });
  });

  return io;
};

export default initSocket;
