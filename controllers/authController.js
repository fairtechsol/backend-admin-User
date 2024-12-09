const {
  userRoleConstant,
  redisTimeOut,
  differLoginTypeByRoles,
  jwtSecret,
  redisKeys,
  authenticatorType,
  authenticatorExpiryTime,
  teleAuthenticatorExpiryTime,
} = require("../config/contants");
const internalRedis = require("../config/internalRedisConnection");
const { ErrorResponse, SuccessResponse } = require("../utils/response");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const {
  getUserWithUserBalance,
  addUser,
  updateUser,
  getUserById,
} = require("../services/userService");
const { userLoginAtUpdate, addAuthenticator, getAuthenticator, deleteAuthenticator, getAuthenticators } = require("../services/authService");
const { forceLogoutIfLogin, findUserPartnerShipObj, settingBetsDataAtLogin, settingOtherMatchBetsDataAtLogin, settingRacingMatchBetsDataAtLogin, settingTournamentMatchBetsDataAtLogin, loginDemoUser, deleteDemoUser, connectAppWithToken } = require("../services/commonService");
const { logger } = require("../config/logger");
const { updateUserDataRedis, getUserRedisSingleKey, getRedisKey, setRedisKey, deleteKeyFromUserRedis } = require("../services/redis/commonfunction");
const { getChildUsersSinglePlaceBet } = require("../services/betPlacedService");
const { generateAuthToken, verifyAuthToken } = require("../utils/generateAuthToken");
const bot = require("../config/telegramBot");
const { __mf } = require("i18n");



// Function to validate a user by username and password
const validateUser = async (userName, password) => {
  // Find user by username and select specific fields
  const user = await getUserWithUserBalance(userName);
  // Check if the user is found
  if (user) {
    // Check if the provided password matches the hashed password in the database
    if (bcrypt.compareSync(password, user.password)) {
      // If the passwords match, create a result object without the password field
      const { password, ...result } = user;
      return result;
    }

    // If the passwords don't match, return an error object
    return {
      error: true,
      message: { msg: "auth.invalidPass", keys: { type: "user" } },
      statusCode: 403,
    };
  }

  // If the user is not found, return null
  return null;
};

const setUserDetailsRedis = async (user) => {
  try{
  logger.info({ message: "Setting exposure at login time.", data: user });

  // Fetch user details from Redis
  const redisUserData = await internalRedis.hget(user.id, "userName");

  if (!redisUserData) {
    // Fetch and set betting data at login
    let betData = await settingBetsDataAtLogin(user);
    let otherMatchBetData = await settingOtherMatchBetsDataAtLogin(user);
    let racingMatchData = await settingRacingMatchBetsDataAtLogin(user);
    let tournamentBetData = await settingTournamentMatchBetsDataAtLogin(user);
    // Set user details and partnerships in Redis
    await updateUserDataRedis(user.id, {
      exposure: user?.userBal?.exposure || 0,
      profitLoss: user?.userBal?.profitLoss || 0,
      myProfitLoss: user?.userBal?.myProfitLoss || 0,
      userName: user.userName,
      currentBalance: user?.userBal?.currentBalance || 0,
      roleName: user.roleName,
      ...(betData || {}),
      ...(otherMatchBetData || {}),
      ...(racingMatchData || {}),
      ...(tournamentBetData || {}),
      partnerShips: await findUserPartnerShipObj(user),
      userRole: user.roleName,
    });

    // Expire user data in Redis
    await internalRedis.expire(user.id, redisTimeOut);
  }
  else{
     // Expire user data in Redis
     await internalRedis.expire(user.id, redisTimeOut);
  }}
  catch(err){
    throw err;
  }
};

exports.login = async (req, res) => {
  try {
    const { password, loginType } = req.body;
    const userName = req.body.userName;
    const user = await validateUser(userName, password);

    if (user?.error) {
      return ErrorResponse(
        {
          statusCode: 404,
          message: user.message,
        },
        req,
        res
      );
    }

    if (!user) {
      return ErrorResponse(
        {
          statusCode: 404,
          message: {
            msg: "notFound",
            keys: { name: "User" },
          },
        },
        req,
        res
      );
    } else if (user.userBlock) {
      return ErrorResponse(
        {
          statusCode: 403,
          message: {
            msg: "user.blocked",
          },
        },
        req,
        res
      );
    }
    const { roleName } = user;
    const throwUserNotCorrectError = () => {
      return ErrorResponse(
        {
          statusCode: 404,
          message: {
            msg: "auth.roleNotCorrectLogin",
          },
        },
        req,
        res
      );
    };

    switch (loginType) {
      case userRoleConstant.user:
      case userRoleConstant.expert:
        if (roleName !== loginType) {
          return throwUserNotCorrectError();
        }
        break;

      case userRoleConstant.admin:
        if (!differLoginTypeByRoles.admin.includes(roleName)) {
          return throwUserNotCorrectError();
        }
        break;

      case "wallet":
        if (!differLoginTypeByRoles.wallet.includes(roleName)) {
          return throwUserNotCorrectError();
        }
        break;
      default:
        return throwUserNotCorrectError();
    }

    // force logout user if already login on another device
    await forceLogoutIfLogin(user.id);

    setUserDetailsRedis(user);
    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, roleName: user.roleName, userName: user.userName },
      jwtSecret
    );

    // checking transition password
    const isTransPasswordCreated = Boolean(user.transPassword);
    const forceChangePassword = !user.loginAt;

    if (!forceChangePassword) {
      userLoginAtUpdate(user.id);
    }
    // setting token in redis for checking if user already loggedin
    await internalRedis.hmset(user.id, { token: token });
    let isBetExist;
    if (user.roleName != userRoleConstant.user) {
      isBetExist = await getChildUsersSinglePlaceBet(user.id);

    }
    let userAuthType;
    if (user.isAuthenticatorEnable) {
      const deviceAuth = await getAuthenticator({ userId: user.id });
      userAuthType = deviceAuth.type;
      if (deviceAuth.type == authenticatorType.telegram) {
        const authId = await generateAuthToken();
        await setRedisKey(`${redisKeys.telegramToken}_${user.id}`, authId.hashedId, authenticatorExpiryTime);
        bot.sendMessage(deviceAuth.deviceId, __mf("telegramBot.sendAuth", { code: authId.randomId, name: user.userName }))
      }
    }
    // Return token and user information

    return SuccessResponse(
      {
        statusCode: 200,
        message: { msg: "auth.loginSuccess" },
        data: {
          token,
          isTransPasswordCreated: isTransPasswordCreated,
          roleName: roleName,
          forceChangePassword,
          userId: user?.id,
          isBetExist: isBetExist?.length > 0,
          isAuthenticator: user.isAuthenticatorEnable,
          authenticatorType: userAuthType
        },
      },
      req,
      res
    );
  } catch (error) {
    return ErrorResponse(
      {
        statusCode: 500,
        message: error.message,
      },
      req,
      res
    );
  }
};

// Function to handle user logout
exports.logout = async (req, res) => {
  try {
    // Get the user from the request object
    const user = req.user;

    // Remove the user's token from Redis using their ID as the key
    await internalRedis.del(user.id);

    if(user.isDemo){
      deleteDemoUser(user.id);
    }

    return SuccessResponse(
      {
        statusCode: 200,
        message: { msg: "auth.logoutSuccess" },
      },
      req,
      res
    );
  } catch (error) {
    // If an error occurs during the logout process, return an error response
    return ErrorResponse(
      {
        statusCode: 500,
        message: error.message,
      },
      req,
      res
    );
  }
};

exports.generateUserAuthToken = async (req, res) => {
  try {
    const user = req.user;
    const { type, password } = req.body;
    if (user.isDemo) {
      return ErrorResponse(
        {
          statusCode: 403,
          message: {
            msg: "auth.unauthorizeRole",
          },
        },
        req,
        res
      );
    }

    const isDeviceExist = await getAuthenticator({ userId: user.id }, ["id"]);

    if(isDeviceExist){
      return ErrorResponse(
        {
          statusCode: 403,
          message: {
            msg: "auth.deviceTokenExist",
          },
        },
        req,
        res
      );
    }

    let returnId;

    if (type == authenticatorType.app) {
      const authId = await generateAuthToken();
      await updateUserDataRedis(user.id, { [redisKeys.authenticatorToken]: authId.hashedId });
      returnId = authId.randomId;
    }

    else {
      const userData = await getUserById(user.id, ["id", "password"]);
      if (!bcrypt.compareSync(password, userData?.password)) {
        throw {
          message: { msg: "auth.invalidPass", keys: { type: "user" } },
          statusCode: 403,
        }
      }

      const authId = new Date().getTime();
      await setRedisKey(authId, user.id, teleAuthenticatorExpiryTime);
      returnId = authId;
    }

    return SuccessResponse(
      {
        statusCode: 200,
        data: returnId,
      },
      req,
      res
    );
  } catch (error) {
    return ErrorResponse(
      {
        statusCode: 500,
        message: error.message,
      },
      req,
      res
    );
  }
};

exports.connectUserAuthToken = async (req, res) => {
  try {
    const { userName, password, authToken, deviceId } = req.body;
    const user = await validateUser(userName, password);

    if (user?.error) {
      return ErrorResponse(
        {
          statusCode: 404,
          message: user.message,
        },
        req,
        res
      );
    }

    if (!user) {
      return ErrorResponse(
        {
          statusCode: 404,
          message: {
            msg: "notFound",
            keys: { name: "User" },
          },
        },
        req,
        res
      );
    }

    if (user.isDemo) {
      return ErrorResponse(
        {
          statusCode: 403,
          message: {
            msg: "auth.unauthorizeRole",
          },
        },
        req,
        res
      );
    }  

    await connectAppWithToken(authToken, deviceId, user);

    return SuccessResponse(
      {
        statusCode: 200,
        message: { msg: "created", keys: { type: "Authenticator" } },
      },
      req,
      res
    );
  } catch (error) {
    return ErrorResponse(
      {
        statusCode: 500,
        message: error.message,
      },
      req,
      res
    );
  }
};

exports.getAuthenticatorRefreshToken=async (req,res)=>{
  try {
    const { deviceId } = req.params;

    const authId = await generateAuthToken();

    await setRedisKey(`${deviceId}_${redisKeys.authenticatorToken}`, authId.hashedId, authenticatorExpiryTime);

    return SuccessResponse(
      {
        statusCode: 200,
        data: authId.randomId
      },
      req,
      res
    );
  } catch (error) {
    return ErrorResponse(
      {
        statusCode: 500,
        message: error.message,
      },
      req,
      res
    );
  }
}

exports.verifyAuthenticatorRefreshToken = async (req, res) => {
  try {
    const { id } = req.user;
    const { authToken } = req.body;

    const authDevice = await getAuthenticator({ userId: id }, ["deviceId", "id"]);
    if (!authDevice) {
      return ErrorResponse(
        {
          statusCode: 400,
          message: {
            msg: "auth.authNotExist",
          },
        },
        req,
        res
      );
    }
    if (authDevice.type == authenticatorType.app) {
      const redisAuthToken = await getRedisKey(`${authDevice.deviceId}_${redisKeys.authenticatorToken}`);
      if (!redisAuthToken) {
        return ErrorResponse(
          {
            statusCode: 403,
            message: {
              msg: "auth.authTokenExpired",
            },
          },
          req,
          res
        );
      }
      const isTokenMatch = await verifyAuthToken(authToken, redisAuthToken);

      if (!isTokenMatch) {
        return ErrorResponse(
          {
            statusCode: 403,
            message: {
              msg: "auth.authenticatorCodeNotMatch",
            },
          },
          req,
          res
        );
      }
    }
    else {
      const redisAuthToken = await getRedisKey(`${redisKeys.telegramToken}_${id}`);
      if (!redisAuthToken) {
        return ErrorResponse(
          {
            statusCode: 403,
            message: {
              msg: "auth.authTokenExpired",
            },
          },
          req,
          res
        );
      }
      const isTokenMatch = await verifyAuthToken(authToken, redisAuthToken);

      if (!isTokenMatch) {
        return ErrorResponse(
          {
            statusCode: 403,
            message: {
              msg: "auth.authenticatorCodeNotMatch",
            },
          },
          req,
          res
        );
      }
    }


    return SuccessResponse(
      {
        statusCode: 200,
      },
      req,
      res
    );
  } catch (error) {
    return ErrorResponse(
      {
        statusCode: 500,
        message: error.message,
      },
      req,
      res
    );
  }
}

exports.removeAuthenticator = async (req, res) => {
  try {
    const { id } = req.user;
    const { authToken } = req.body;

    const authDevice = await getAuthenticator({ userId: id }, ["deviceId", "id"]);
    if (!authDevice) {
      return ErrorResponse(
        {
          statusCode: 400,
          message: {
            msg: "auth.authNotExist",
          },
        },
        req,
        res
      );
    }

    if (authDevice.type == authenticatorType.app) {
      const redisAuthToken = await getRedisKey(`${authDevice.deviceId}_${redisKeys.authenticatorToken}`);

      const isTokenMatch = await verifyAuthToken(authToken, redisAuthToken);

      if (!isTokenMatch) {
        return ErrorResponse(
          {
            statusCode: 403,
            message: {
              msg: "auth.authenticatorCodeNotMatch",
            },
          },
          req,
          res
        );
      }
    }
    else{
      const redisAuthToken = await getRedisKey(`${redisKeys.telegramToken}_${id}`);

      const isTokenMatch = await verifyAuthToken(authToken, redisAuthToken);

      if (!isTokenMatch) {
        return ErrorResponse(
          {
            statusCode: 403,
            message: {
              msg: "auth.authenticatorCodeNotMatch",
            },
          },
          req,
          res
        );
      }
    }

    await deleteAuthenticator({ userId: id });
    await updateUser(id, { isAuthenticatorEnable: false });
    await forceLogoutIfLogin(id);

    return SuccessResponse(
      {
        statusCode: 200,
        success: true
      },
      req,
      res
    );
  } catch (error) {
    return ErrorResponse(
      {
        statusCode: 500,
        message: error.message,
      },
      req,
      res
    );
  }
}

exports.getAuthenticatorUsersList = async (req, res) => {
  try {
    const { deviceId } = req.params;
    
    const users = await getAuthenticators({ deviceId: deviceId, type: authenticatorType.app }, ["user.userName"])

    return SuccessResponse(
      {
        statusCode: 200,
        data: users
      },
      req,
      res
    );
  } catch (error) {
    return ErrorResponse(
      {
        statusCode: 500,
        message: error.message,
      },
      req,
      res
    );
  }
}

exports.getAuthenticatorUser = async (req, res) => {
  try {
    const { id } = req.user;
    
    const userAuth = await getAuthenticator({ userId:id })

    return SuccessResponse(
      {
        statusCode: 200,
        data: userAuth
      },
      req,
      res
    );
  } catch (error) {
    return ErrorResponse(
      {
        statusCode: 500,
        message: error.message,
      },
      req,
      res
    );
  }
}

exports.resendTelegramAuthToken = async (req, res) => {
  try {
    const { id } = req.user;

    const deviceAuth = await getAuthenticator({ userId: id });
    const authId = await generateAuthToken();
    await setRedisKey(`${redisKeys.telegramToken}_${user.id}`, authId.hashedId, authenticatorExpiryTime);
    bot.sendMessage(deviceAuth.deviceId, __mf("telegramBot.sendAuth", { code: authId.randomId, name: req.user.userName }))

    return SuccessResponse(
      {
        statusCode: 200,
        message: {
          msg: "auth.authCodeResend"
        }
      },
      req,
      res
    );
  } catch (error) {
    return ErrorResponse(
      {
        statusCode: 500,
        message: error.message,
      },
      req,
      res
    );
  }
}