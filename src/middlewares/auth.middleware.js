import jwt from "jsonwebtoken";
import { error } from "../utils/response.js";

export const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return error(res, "No token provided", 401);
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, {
      issuer: "cab-auth-service",
      audience: "cab-app",
    });

    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError")
      return error(res, "Token expired", 401);
    if (err.name === "JsonWebTokenError")
      return error(res, "Invalid token", 401);
    return error(res, "Authentication failed", 401);
  }
};
