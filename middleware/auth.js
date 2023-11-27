const { ErrorResponse } = require("../utils/response");
const jwt=require("jsonwebtoken");

exports.isAuthenticate = async (req, res, next) => {
  const { token } = req.headers;
  if (!token) {
    ErrorResponse(
      {
        statusCode: 401,
        message: {
          msg: "authFailed",
        },
      },
      req,
      res
    );
  }

  if (auth) {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    next();
  }
};
