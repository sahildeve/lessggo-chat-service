import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import redis from "./config/redis.js";
import logger from "./utils/logger.js";

const initSocket = (httpServer) => {
  const io = new Server(httpServer);

  try {
    const pubClient = redis.duplicate();
    const subClient = redis.duplicate();

    pubClient.on("error", (err) => {
      logger.error("Chat Redis PubClient error:", { message: err.message });
    });
    subClient.on("error", (err) => {
      logger.error("Chat Redis SubClient error:", { message: err.message });
    });

    io.adapter(createAdapter(pubClient, subClient));
    logger.info("Chat Socket.io Redis adapter connected");
  } catch (err) {
    logger.error("Chat Redis adapter error:", { message: err.message });
  }

  return io;
};

export default initSocket;