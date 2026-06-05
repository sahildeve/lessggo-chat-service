import mongoose from "mongoose";
import logger from "../utils/logger.js";

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    logger.info("Chat MongoDB connected");
  } catch (err) {
    logger.error("Chat MongoDB connection error:", err.message);
    process.exit(1);
  }
};

mongoose.connection.on("disconnected", () => {
  logger.warn("Chat MongoDB disconnected. Retrying...");
  setTimeout(connectDB, 5000);
});

export default connectDB;
