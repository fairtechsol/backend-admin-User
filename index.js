const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const app = express();
const http = require("http");
const { socketManager } = require("./sockets/socketManager.js");
const route = require("./routes/index.js");
const swaggerUi = require("swagger-ui-express");
const error = require("./utils/error.js");
const i18n = require("./config/i18n");
const setI18Language = require("./middleware/setI18Language.js");
const { logger } = require("./config/logger.js");

const allowSubdomainsAndLocalhost = (origin, callback) => {
  // Check if the request comes from the specified domain or localhost
  if (!origin || origin.includes("fairgame7.com")) {
    callback(null, true); // Allow the request
  } else {
    callback(new Error("Not allowed by CORS")); // Deny the request
  }
};

if (process.env.NODE_ENV == 'production') {
  // Enable CORS with the custom origin function
  app.use(cors({ credentials: true, origin: allowSubdomainsAndLocalhost }));
} else {
  app.use(cors({ origin: "*" }));
}

app.enable('trust proxy');

/**
 * Parse incoming JSON data
 */
app.use(express.json({ limit: '2mb' }));

/**
 * Parse URL-encoded data with extended support
 */
app.use(bodyParser.urlencoded({ extended: true }));

// configureing i18 for message control
app.use(i18n.init);
app.use(setI18Language);

app.use((req, res, next) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const body = JSON.stringify(req.body);
  const query = JSON.stringify(req.query);
  const params = JSON.stringify(req.params);
  logger.debug(`Request [From:${ip}] ${req.path} ||  ${req.method} || query : ${query} || params : ${params} || body : ${body}`);
  next();
});
// Routes
app.use("/", route);
if (process.env.NODE_ENV != 'production') {
  const swaggerDocument = require("./swagger_output.json");
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
}
app.use(error);

//connect http
const server = http.createServer(app);

//Connect socket
socketManager(server);
// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
