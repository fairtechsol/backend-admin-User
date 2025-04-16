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

function getUserPermissionFromRedis(userId) {
  return internalRedis.hget(userId,"permission");
}

module.exports = {
  verifyToken,
  getUserTokenFromRedis,
  getUserPermissionFromRedis
};
