const { ErrorResponse } = require("../utils/response");
const jwt = require("jsonwebtoken");


exports.isAuthenticate = async (req, res, next) => {
  const { token } = req.headers;
  if (!token) {
    ErrorResponse(
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
    const decodedUser = jwt.verify(token, process.env.JWT_SECRET || "secret");
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
    req.user = decodedUser;
    next();
  }
};
