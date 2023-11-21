const express = require('express');
const cors = require("cors");
const bodyParser = require("body-parser");
const app = express();

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

// Routes
const authRoutes = require('./routes/authRoutes');
app.use('/auth', authRoutes);

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
