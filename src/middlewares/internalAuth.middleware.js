import { error } from "../utils/response.js";

// ─── Service-to-service auth (user token nahi, shared key)
export const internalAuth = (req, res, next) => {
  const key = req.headers["x-service-key"];

  if (!key || key !== process.env.INTERNAL_SERVICE_KEY) {
    return error(res, "Unauthorized", 401);
  }

  next();
};