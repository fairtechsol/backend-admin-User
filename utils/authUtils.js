const jwt = require("jsonwebtoken");
const internalRedis = require("../config/internalRedisConnection");
require("dotenv").config();

function verifyToken(token) {
  const decodedUser = jwt.verify(token, process.env.JWT_SECRET || "secret");
  return decodedUser ?? false;
}

function getUserTokenFromRedis(userId) {
  return internalRedis.hget(userId, "token");
}

module.exports = {
  verifyToken,
  getUserTokenFromRedis,
};
