export const chatSwaggerDocs = {
  "/api/chat/{rideId}/history": {
    get: {
      summary: "Get chat history for a ride (paginated)",
      tags: ["Chat"],
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "rideId",
          in: "path",
          required: true,
          schema: { type: "string", example: "6a1fb71391ca3b940980581a" },
        },
        {
          name: "page",
          in: "query",
          required: false,
          schema: { type: "integer", example: 1 },
        },
        {
          name: "limit",
          in: "query",
          required: false,
          schema: { type: "integer", example: 50 },
        },
      ],
      responses: {
        200: { description: "Chat history fetched successfully" },
        401: { description: "Unauthorized" },
      },
    },
  },

  "/api/chat/message/{messageId}": {
    delete: {
      summary: "Delete your own message (soft delete)",
      tags: ["Chat"],
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "messageId",
          in: "path",
          required: true,
          schema: { type: "string", example: "6a1fb71391ca3b940980581b" },
        },
      ],
      responses: {
        200: { description: "Message deleted successfully" },
        403: { description: "You can only delete your own messages" },
        404: { description: "Message not found" },
      },
    },
  },

  "/api/chat/{rideId}/delete-all": {
    delete: {
      summary: "Delete all messages for a ride (used when ride ends)",
      tags: ["Chat"],
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "rideId",
          in: "path",
          required: true,
          schema: { type: "string", example: "6a1fb71391ca3b940980581a" },
        },
      ],
      responses: {
        200: { description: "Chat deleted successfully" },
        401: { description: "Unauthorized" },
      },
    },
  },
};

// Socket.io events documentation
export const socketDocs = {
  events: {
    emit: [
      {
        name: "join_chat",
        data: "rideId (string)",
        description: "Join a ride chat room (verified via Redis ride_members)",
      },
      {
        name: "send_message",
        data: "{ rideId, message }",
        description: "Send a message to the ride chat room",
      },
      {
        name: "leave_chat",
        data: "rideId (string)",
        description: "Leave a ride chat room",
      },
      {
        name: "typing",
        data: "{ rideId, isTyping }",
        description: "Notify others that you are typing",
      },
    ],
    on: [
      {
        name: "new_message",
        data: "{ messageId, senderId, senderUsername, message, timestamp }",
        description: "New message received",
      },
      {
        name: "system_message",
        data: "{ message, timestamp }",
        description: "System message (joined/left)",
      },
      {
        name: "user_typing",
        data: "{ userId, username, isTyping }",
        description: "Someone is typing",
      },
      { name: "error", data: "{ message }", description: "Error occurred" },
    ],
  },
};
