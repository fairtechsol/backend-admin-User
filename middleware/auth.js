const { getUserById } = require("../services/userService");
const { verifyToken, getUserTokenFromRedis } = require("../utils/authUtils");
const { ErrorResponse } = require("../utils/response");
const bcrypt=require("bcryptjs");
exports.isAuthenticate = async (req, res, next) => {
  try {
    const { authorization } = req.headers;
    if (!authorization) {
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

    const token = authorization?.split(" ")[1];

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
    }
  } catch (err) {
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
};


exports.checkTransactionPassword = async (req,res,next) => {
  let {transactionPassword} = req.body
  let {id} = req.user
  if(!transactionPassword) 
  return ErrorResponse(
    {
      statusCode: 400,
      message: {
        msg: "required",
        keys: { name: "Transaction password" },
      },
    },
    req,
    res
  );
   // Retrieve user's transaction password from the database
  const user = await getUserById(id, ["transPassword", "id"]);
  if(!user)
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
  if(!user.transPassword)
  return ErrorResponse(
    {
      statusCode: 400,
      message: { msg: "auth.invalidPass", keys: { type: "transaction" }},
    },
    req,
    res
  );
  
  // Compare old transaction password with the stored transaction password
  let check = bcrypt.compareSync(transactionPassword, user.transPassword);
  if(!check){
    return ErrorResponse(
      {
        statusCode: 400,
        message: { msg: "auth.invalidPass", keys: { type: "transaction" } },
      },
      req,
      res
    );
  }
  next()
};
