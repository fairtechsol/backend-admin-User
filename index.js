// Import required modules
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const http2 = require("http2"); // Use http2 instead of http
const http = require("http");
const fs = require("fs");
const { socketManager } = require("./sockets/socketManager.js");
const route = require("./routes/index.js");
const swaggerUi = require("swagger-ui-express");
const error = require("./utils/error.js");
const i18n = require("./config/i18n");
const setI18Language = require("./middleware/setI18Language.js");
const { logger } = require("./config/logger.js");
const helmet = require("helmet");

// Create Express app
const app = express();

// Function to allow requests from specific domains
const allowSubdomainsAndLocalhost = (origin, callback) => {
  if (!origin || origin.includes("fairgame7.com") || origin.includes("maxbet07.com")) {
    callback(null, true); // Allow the request
  } else {
    callback(new Error("Not allowed by CORS")); // Deny the request
  }
};

// Enable CORS based on environment
if (process.env.NODE_ENV === "production") {
  app.use(cors({ credentials: true, origin: allowSubdomainsAndLocalhost }));
} else {
  app.use(cors({ origin: "*" }));
}

app.enable("trust proxy");
app.use(helmet());

// Parse incoming JSON data with a size limit of 2MB
app.use(express.json({ limit: "2mb" }));

// Parse URL-encoded data with extended support
app.use(bodyParser.urlencoded({ extended: true }));

// Configure i18n for message control
app.use(i18n.init);
app.use(setI18Language);

// Middleware for logging requests
app.use((req, res, next) => {
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  const body = JSON.stringify(req.body);
  const query = JSON.stringify(req.query);
  const params = JSON.stringify(req.params);
  logger.debug(`Request [From:${ip}] ${req.path} || ${req.method} || query: ${query} || params: ${params} || body: ${body}`);
  next();
});

// Define routes
app.use("/", route);

// Serve Swagger documentation in non-production environments
if (process.env.NODE_ENV !== "production") {
  const swaggerDocument = require("./swagger_output.json");
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
}

// Error handling middleware
app.use(error);

// Check environment to determine SSL setup
let server;

if (process.env.NODE_ENV == "production" || process.env.NODE_ENV == "dev") {
  // Production SSL configuration with Let's Encrypt certificates
  const sslOptions = {
    key: fs.readFileSync(`/etc/letsencrypt/live/${process.env.SSL_PATH}/privkey.pem`),
    cert: fs.readFileSync(`/etc/letsencrypt/live/${process.env.SSL_PATH}/fullchain.pem`),
    allowHTTP1: true, // Allows HTTP/1.1 fallback
  };

  // Create an HTTP/2 server with SSL options
  server = http2.createSecureServer(sslOptions, app);

  console.log("Running with HTTPS in production mode");
} else {
  // Create an HTTP server for local development
  server = http.createServer(app);

  console.log("Running with HTTP in development mode");
}

// Integrate socket manager with the server
socketManager(server);

// Start the server on the specified port
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`HTTP/2 server is running on https://localhost:${PORT}`);
});
