import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import redis from "./config/redis.js";
import logger from "./utils/logger.js";

// eslint-disable-next-line no-unused-vars
const initSocket = (httpServer) => {
  // Not attached to the HTTP server (CHAT-02): no client can connect here.
  // This instance only emits and joins sockets through the Redis adapter;
  // browsers connect to the gateway only.
  const io = new Server();

  try {
    // Adapter clients are only for broadcasting between instances, so the main
    // client's "fail fast" settings are wrong here:
    //  - commandTimeout: undefined — SUBSCRIBE is long-lived; a 5s timeout would
    //    reject it on a slow connect and stop this instance receiving broadcasts.
    //    (Do not use 0: ioredis treats it as a 0ms timeout.)
    //  - maxRetriesPerRequest: null — the adapter publishes without .catch; keep
    //    commands queued until Redis is back instead of rejecting them.
    const pubClient = redis.duplicate({
      commandTimeout: undefined,
      maxRetriesPerRequest: null,
    });
    const subClient = redis.duplicate({
      commandTimeout: undefined,
      maxRetriesPerRequest: null,
    });

    // duplicate() does not copy listeners: log errors through our logger (CHAT-02).
    pubClient.on("error", (err) =>
      logger.error("Socket adapter pub Redis error", { message: err.message }),
    );
    subClient.on("error", (err) =>
      logger.error("Socket adapter sub Redis error", { message: err.message }),
    );

    io.adapter(createAdapter(pubClient, subClient));
    logger.info("Chat Socket.io Redis adapter connected");
  } catch (err) {
    logger.error("Chat Redis adapter error", { message: err.message });
  }

  return io;
};

export default initSocket;
