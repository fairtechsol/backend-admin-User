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
console.log(decodedUser);
    if (!decodedUser) {
      return ErrorResponse(
        {
          statusCode: 400,
          message: {
            msg: "notFound",
            key: { name: "User" },
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
