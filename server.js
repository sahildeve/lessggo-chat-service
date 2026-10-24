import "dotenv/config";
import http from "http";
import util from "util";
import app from "./app.js";
import connectDB from "./src/config/db.js";
import initSocket from "./src/socket.js";
import logger from "./src/utils/logger.js";
import { startChatSubscriber } from "./src/workers/chatSubscriber.js";

const PORT = process.env.PORT || 3003;

const start = async () => {
  try {
    await connectDB();

    const httpServer = http.createServer(app);
    const io = initSocket(httpServer);
    app.set("io", io);

    startChatSubscriber(io);
    // auth-events topic ka USER_DELETED — alag subscription, same handler
    startChatSubscriber(
      io,
      process.env.USER_DELETED_SUB || "chat-user-deleted-sub",
    );

    httpServer.listen(PORT, () => {
      logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      logger.info(`  Chat Service running on port ${PORT}`);
      logger.info(`  Mode : ${process.env.NODE_ENV}`);
      logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    });
  } catch (err) {
    logger.error("Server startup error:", {
      message: err.message,
      stack: err.stack,
    });
    process.exit(1);
  }
};

start();

// Rejected value Error na ho (string, plain object, undefined) toh bhi kuch dikhe.
// String() plain object ke liye sirf "[object Object]" deta hai — isliye inspect bhi.
// String() throw bhi kar sakta hai (e.g. Object.create(null)) — handler khud crash na ho
const errorDetails = (err) => {
  let value;
  try {
    value = String(err);
  } catch {
    value = "[unstringifiable value]";
  }
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
    value,
    inspected,
  };
};

process.on("unhandledRejection", (err) => {
  logger.error("Unhandled Rejection:", errorDetails(err));
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  logger.error("Uncaught Exception:", errorDetails(err));
  process.exit(1);
});
