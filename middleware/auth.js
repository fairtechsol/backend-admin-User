const { oldBetFairDomain } = require("../config/contants");
const { getAccessUserById } = require("../services/accessUserService");
const {  transactionPasswordAttempts } = require("../services/commonService");
const { getUserById, updateUser } = require("../services/userService");
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
      if (userTokenRedis != token || (decodedUser?.isAuthenticatorEnable && (req.baseUrl != "/auth" && req.baseUrl != "/user/check/oldPassword"))) {
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
      if (req.user?.isAccessUser) {
        req.user.childId = req.user.id;
        req.user.id = req.user.mainParentId;
      }
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


exports.checkTransactionPassword = async (req, res, next) => {
  let {transactionPassword} = req.body
  let { id, isAccessUser, childId } = req.user
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

  let user;
  if(isAccessUser){
    user = await getAccessUserById(childId, ["transPassword", "id"]);
  }
  else {
    user = await getUserById(id, ["transPassword", "id", "transactionPasswordAttempts", "createBy", "superParentId"]);
  }
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

    const currDomain = `${process.env.GRPC_URL}`;

    if (currDomain != oldBetFairDomain && !isAccessUser) {
      await transactionPasswordAttempts(user);
    }
    return ErrorResponse(
      {
        statusCode: 400,
        message: { msg: "auth.invalidPass", keys: { type: "transaction" } },
        data: { attemptsLeft: 11 - (user.transactionPasswordAttempts + 1) },
      },
      req,
      res
    );
  }

  if (user?.transactionPasswordAttempts > 0) {
    await updateUser(user.id, { transactionPasswordAttempts: 0 });
  }
  next()
};
