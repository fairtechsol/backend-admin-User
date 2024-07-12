const jwt = require("jsonwebtoken");
const internalRedis = require("../config/internalRedisConnection");
const { jwtSecret } = require("../config/contants");
require("dotenv").config();

function verifyToken(token) {
  const decodedUser = jwt.verify(token, jwtSecret);
  return decodedUser ?? false;
}

function getUserTokenFromRedis(userId) {
  return internalRedis.hget(userId, "token");
}

module.exports = {
  verifyToken,
  getUserTokenFromRedis,
};
