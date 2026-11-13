import "dotenv/config";
import http from "http";
import util from "util";
import mongoose from "mongoose";
import app from "./app.js";
import connectDB from "./src/config/db.js";
import redis from "./src/config/redis.js";
import initSocket from "./src/socket.js";
import {
  startChatSubscriber,
  stopChatSubscribers,
} from "./src/workers/chatSubscriber.js";
import logger from "./src/utils/logger.js";

const PORT = process.env.PORT || 3003;
let httpServer;

const start = async () => {
  try {
    await connectDB();


    httpServer = http.createServer(app);

    const io = await initSocket(httpServer);
    app.set("io", io);

    startChatSubscriber(io);
    // auth-events topic ka USER_DELETED — alag subscription, same handler
    startChatSubscriber(
      io,
      process.env.USER_DELETED_SUB || "chat-user-deleted-sub",
    );

    httpServer.listen(PORT, () => {
      logger.info(`Chat Service running on port ${PORT}`, {
        mode: process.env.NODE_ENV,
      });
    });
  } catch (err) {
    logger.error("Server startup error", {
      message: err.message,
      stack: err.stack,
    });
    process.exit(1);
  }
};

start();

// Readable details even when the rejected value is not an Error.
const errorDetails = (err) => {
  let inspected;
  try {
    inspected = util.inspect(err, { depth: 4, breakLength: Infinity });
  } catch {
    inspected = "[uninspectable value]";
  }
  return {
    name: err?.name,
    message: err?.message,
    stack: err?.stack,
    inspected,
  };
};

// ── Graceful shutdown (CHAT-06) ──
// Cloud Run sends SIGTERM on deploy / scale-down and kills the instance ~10s
// later. Stop Pub/Sub first (unfinished messages are retried, see METRO-07),
// let in-flight HTTP requests finish, then close connections.
let shuttingDown = false;
const shutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`${signal} received, shutting down gracefully`);

  const forceExit = setTimeout(() => process.exit(0), 9000);
  forceExit.unref();

  try {
    await stopChatSubscribers();
    if (httpServer) await new Promise((resolve) => httpServer.close(resolve));
    await Promise.allSettled([mongoose.connection.close(), redis.quit()]);
  } finally {
    process.exit(0);
  }
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Log only: one stray rejected promise should not kill every in-flight request.
process.on("unhandledRejection", (err) => {
  logger.error("Unhandled Rejection", errorDetails(err));
});

// After an uncaught exception the process state is unknown: log and exit so
// Cloud Run starts a clean instance (it used to keep running broken).
process.on("uncaughtException", (err) => {
  logger.error("Uncaught Exception", errorDetails(err));
  process.exit(1);
});
