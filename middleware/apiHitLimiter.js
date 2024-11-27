const rateLimit = require('express-rate-limit');
// Rate limiter configuration
exports.apiLimiter = rateLimit({
  windowMs: process.env.API_LIMIT ?? 600, // 1 second window
  max: 1, // limit each IP to 1 request per windowMs
  message: { message: 'Too many requests from this IP, please try again after a second', statusCode: 429, status: "error" },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});