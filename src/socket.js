import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import redis from "./config/redis.js";
import * as chatService from "./services/chat.service.js";
import logger from "./utils/logger.js";

const initSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.ALLOWED_ORIGINS?.split(",") || "*",
      credentials: true,
    },
  });

  // ─── Auth Middleware
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

  // ─── Connection
  io.on("connection", (socket) => {
    logger.info(`User connected to chat: ${socket.user.username}`);

    // ─── Join Chat Room
    socket.on("join_chat", async (rideId) => {
      try {
        // Redis me check karo — ye user is ride me hai?
        const isMember = await redis.sismember(
          `ride_members:${rideId}`,
          socket.user.sub,
        );

        if (!isMember) {
          socket.emit("error", {
            message: "You are not a member of this ride",
          });
          return;
        }

        socket.join(rideId);
        logger.info(`${socket.user.username} joined chat room: ${rideId}`);

        // System message — user joined
        const sysMsg = await chatService.saveSystemMessage(
          rideId,
          `${socket.user.username} joined the chat`,
        );

        // Room me sabko batao
        io.to(rideId).emit("system_message", {
          message: sysMsg.message,
          timestamp: sysMsg.createdAt,
        });
      } catch (err) {
        logger.error("Join chat error:", err.message);
        socket.emit("error", { message: err.message });
      }
    });

    // ─── Send Message
    socket.on("send_message", async ({ rideId, message }) => {
      try {
        if (!message?.trim()) return;
        if (message.length > 500) {
          socket.emit("error", { message: "Message too long (max 500 chars)" });
          return;
        }

        // Redis me check karo
        const isMember = await redis.sismember(
          `ride_members:${rideId}`,
          socket.user.sub,
        );
        if (!isMember) {
          socket.emit("error", {
            message: "You are not a member of this ride",
          });
          return;
        }

        // DB me save karo
        const savedMsg = await chatService.saveMessage(
          rideId,
          socket.user.sub,
          socket.user.username,
          message.trim(),
        );

        // Room me sabko bhejo
        io.to(rideId).emit("new_message", {
          messageId: savedMsg._id,
          senderId: socket.user.sub,
          senderUsername: socket.user.username,
          message: savedMsg.message,
          timestamp: savedMsg.createdAt,
        });
      } catch (err) {
        logger.error("Send message error:", err.message);
        socket.emit("error", { message: err.message });
      }
    });

    // ─── Leave Chat Room
    socket.on("leave_chat", async (rideId) => {
      try {
        socket.leave(rideId);
        logger.info(`${socket.user.username} left chat room: ${rideId}`);

        const sysMsg = await chatService.saveSystemMessage(
          rideId,
          `${socket.user.username} left the chat`,
        );

        socket.to(rideId).emit("system_message", {
          message: sysMsg.message,
          timestamp: sysMsg.createdAt,
        });
      } catch (err) {
        logger.error("Leave chat error:", err.message);
      }
    });

    // ─── Typing Indicator
    socket.on("typing", ({ rideId, isTyping }) => {
      socket.to(rideId).emit("user_typing", {
        userId: socket.user.sub,
        username: socket.user.username,
        isTyping,
      });
    });

    // ─── Disconnect
    socket.on("disconnect", () => {
      logger.info(`User disconnected from chat: ${socket.user.username}`);
    });
  });

  return io;
};

export default initSocket;
