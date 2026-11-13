import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    rideId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    senderUsername: {
      type: String,
      default: null,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    messageType: {
      type: String,
      enum: ["text", "system"],
      default: "text",
    },
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  },
);

// TTL index — 24 hours = 86400 seconds
messageSchema.index({ rideId: 1, createdAt: -1 });
// Ride chat is disposable (CHAT-09): messages are deleted 30 days after they
// were sent. The old comment said 24h, but no expiry existed at all.
messageSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 },
);

const Message = mongoose.model("Message", messageSchema);
export default Message;
