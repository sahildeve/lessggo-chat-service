import crypto from "crypto";
import { error } from "../utils/response.js";

// Constant-time compare (CHAT-18), like auth-service's internal routes.
const safeEqual = (a, b) => {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
};

// ─── Service-to-service auth (user token nahi, shared key). Fails closed.
export const internalAuth = (req, res, next) => {
  const expected = process.env.INTERNAL_SERVICE_KEY;
  const key = req.headers["x-service-key"];

  if (!expected || !key || !safeEqual(key, expected)) {
    return error(res, "Unauthorized", 401);
  }

  next();
};
