const { verifyToken, getUserTokenFromRedis } = require("../utils/authUtils");
const { ErrorResponse } = require("../utils/response");

exports.isAuthenticate = async (req, res, next) => {
  try{
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
            msg: "auth.unauthorize",
          },
        },
        req,
        res
      );
    }

    req.user = decodedUser;
    next();
  }}
  catch(err){
    return ErrorResponse(
      {
        statusCode: 500,
        message: {
          msg: "internalServerError"
        },
      },
      req,
      res
    );
  }
};
