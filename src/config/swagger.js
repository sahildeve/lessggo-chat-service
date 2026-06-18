import { chatSwaggerDocs } from "../docs/chat.swagger.js";

const swaggerSpec = {
  openapi: "3.0.0",
  info: {
    title: "Chat Service API",
    version: "1.0.0",
    description: "Ride-based disposable chat service for Cab Sharing App",
  },
  servers: [
    {
      url: process.env.API_URL || "http://localhost:3003",
      description: "Server",
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
  },
  paths: chatSwaggerDocs,
};

export default swaggerSpec;
