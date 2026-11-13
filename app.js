import "dotenv/config";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import mongoose from "mongoose";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./src/config/swagger.js";
import chatRoutes from "./src/routes/chat.routes.js";
import redis from "./src/config/redis.js";
import logger from "./src/utils/logger.js";
import { gatewayOnly } from "./src/middlewares/gatewayOnly.js";

const app = express();

app.set("trust proxy", 1);
app.use(helmet());

// ─── Health Check (open for Cloud Run and monitoring)
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "chat-service" });
});

// ─── Readiness (CHAT-19): checks MongoDB and Redis.
const withTimeout = (promise, ms) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), ms),
    ),
  ]);

app.get("/ready", async (_req, res) => {
  const [mongo, cache] = await Promise.allSettled([
    withTimeout((async () => mongoose.connection.db.admin().ping())(), 2000),
    withTimeout(redis.ping(), 2000),
  ]);
  const checks = {
    mongo: mongo.status === "fulfilled" ? "ok" : "down",
    redis: cache.status === "fulfilled" ? "ok" : "down",
  };
  const ready = checks.mongo === "ok" && checks.redis === "ok";
  res
    .status(ready ? 200 : 503)
    .json({ status: ready ? "READY" : "NOT_READY", ...checks });
});

// ─── Only the gateway may call the API (CHAT-04). Internal routes are called
// directly by location-service and are protected by internalAuth instead.
app.use((req, res, next) =>
  req.path.startsWith("/api/chat/internal/")
    ? next()
    : gatewayOnly(req, res, next),
);

app.use(express.json({ limit: "10kb" }));
// Express 5 leaves req.body undefined when no body is sent (CHAT-11).
app.use((req, _res, next) => {
  req.body ??= {};
  next();
});
if (process.env.NODE_ENV !== "production") app.use(morgan("dev"));

// ─── Routes
app.use("/api/chat", chatRoutes);

// API docs only outside production (CHAT-04).
if (process.env.NODE_ENV !== "production") {
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

// ─── 404 Handler (JSON, not Express's HTML page)
app.use((_req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// ─── Global Error Handler: real message only for client errors (CHAT-12)
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) {
    logger.error("Unhandled error", { message: err.message, stack: err.stack });
  }
  res.status(status).json({
    success: false,
    message:
      status < 500 ? err.message : "Something went wrong. Please try again.",
  });
});

export default app;
