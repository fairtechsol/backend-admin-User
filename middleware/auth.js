const internalRedis = require("../config/internalRedisConnection");
const { verifyToken, getUserTokenFromRedis } = require("../utils/authUtils");
const { ErrorResponse } = require("../utils/response");
const jwt = require("jsonwebtoken");

exports.isAuthenticate = async (req, res, next) => {
  const { token } = req.headers;
  if (!token) {
    return ErrorResponse(
      {
        statusCode: 401,
        message: {
          msg: "auth.authFailed",
        },
      },
      req,
      res
    );
  }

  if (token) {
    const decodedUser = verifyToken(token);
    if (!decodedUser) {
      return ErrorResponse(
        {
          statusCode: 400,
          message: {
            msg: "notFound",
            keys: { name: "User" },
          },
        },
        req,
        res
      );
    }
    const userTokenRedis = await getUserTokenFromRedis(decodedUser.id);
    if (userTokenRedis != token) {
      return ErrorResponse(
        {
          statusCode: 401,
          message: {
            msg: "invalid",
            keys: { name: "token" },
          },
        },
        req,
        res
      );
    }

    req.user = decodedUser;
    next();
  }
};
