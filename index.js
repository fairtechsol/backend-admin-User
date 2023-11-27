const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const app = express();
const route = require("./routes/index.js");
const swaggerUi = require("swagger-ui-express");
const swaggerDocument = require("./swagger_output.json");
const { ErrorResponse } = require("./utils/response.js");
const error = require("./utils/error.js");
const i18n = require("./config/i18n");
const setI18Language = require("./middleware/setI18Language.js");
/**
 * Enable Cross-Origin Resource Sharing (CORS)
 */
app.use(cors({ origin: "*" }));

/**
 * Parse incoming JSON data
 */
app.use(express.json());

/**
 * Parse URL-encoded data with extended support
 */
app.use(bodyParser.urlencoded({ extended: true }));

// configureing i18 for message control
app.use(i18n.init);
app.use(setI18Language);

// Routes
app.use("/", route);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use(error);
// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
