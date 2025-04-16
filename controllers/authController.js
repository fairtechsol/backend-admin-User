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
  updateUser,
  getUserById,
  getUserDataWithUserBalance,
} = require("../services/userService");
const { userLoginAtUpdate, getAuthenticator, deleteAuthenticator, getAuthenticators } = require("../services/authService");
const { forceLogoutIfLogin, findUserPartnerShipObj, settingBetsDataAtLogin, settingTournamentMatchBetsDataAtLogin, deleteDemoUser, connectAppWithToken } = require("../services/commonService");
const { logger } = require("../config/logger");
const { updateUserDataRedis, getRedisKey, setRedisKey } = require("../services/redis/commonfunction");
const { getChildUsersSinglePlaceBet } = require("../services/betPlacedService");
const { generateAuthToken, verifyAuthToken } = require("../utils/generateAuthToken");
const bot = require("../config/telegramBot");
const { __mf } = require("i18n");
const { getAccessUserWithPermission } = require("../services/accessUserService");
const { ILike } = require("typeorm");



// Function to validate a user by username and password
const validateUser = async (userName, password) => {
  // Find user by username and select specific fields
  const user = await getUserWithUserBalance(userName);
  const accessUser = await getAccessUserWithPermission({ userName: ILike(userName) });
  // Check if the user is found
  if (user || accessUser) {
    // Check if the provided password matches the hashed password in the database
    if (bcrypt.compareSync(password, user?.password || accessUser?.password)) {
      // If the passwords match, create a result object without the password field
      const { password, ...result } = user || accessUser;
      if (accessUser) {
        result.isAccessUser = true;
      }
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
  try {
    logger.info({ message: "Setting exposure at login time.", data: user });

    const setAndExpireUserData = async (id, data) => {
      await updateUserDataRedis(id, data);
      await internalRedis.expire(id, redisTimeOut);
    };

    const setDefaultUserData = async (userObj) => {
      const betData = await settingBetsDataAtLogin(userObj);
      const tournamentBetData = await settingTournamentMatchBetsDataAtLogin(userObj);
      const partnerShips = await findUserPartnerShipObj(userObj);

      return {
        exposure: userObj?.userBal?.exposure || 0,
        profitLoss: userObj?.userBal?.profitLoss || 0,
        myProfitLoss: userObj?.userBal?.myProfitLoss || 0,
        userName: userObj.userName,
        currentBalance: userObj?.userBal?.currentBalance || 0,
        roleName: userObj.roleName,
        ...(betData || {}),
        ...(tournamentBetData || {}),
        partnerShips,
      };
    };

    if (user.isAccessUser) {
      const userData = await getUserDataWithUserBalance({ id: user.mainParentId });
      const redisUserData = await internalRedis.hget(userData.id, "userName");

      if (!redisUserData) {
        const defaultData = await setDefaultUserData(userData);
        await setAndExpireUserData(userData.id, defaultData);
      } else {
        await internalRedis.expire(userData.id, redisTimeOut);
      }

      const accessUserData = await internalRedis.hget(user.id, "userName");
      if (!accessUserData) {
        await setAndExpireUserData(user.id, {
          userName: user.userName,
          permission: JSON.stringify(user.permission),
        });
      } else {
        await internalRedis.expire(user.id, redisTimeOut);
      }

    } else {
      const redisUserData = await internalRedis.hget(user.id, "userName");

      if (!redisUserData) {
        const defaultData = await setDefaultUserData(user);
        await setAndExpireUserData(user.id, defaultData);
      } else {
        await internalRedis.expire(user.id, redisTimeOut);
      }
    }

  } catch (err) {
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

    let { roleName } = user;
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

    if (!user.isAccessUser) {
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
    }
    else {
      if (loginType != userRoleConstant.admin) {
        return throwUserNotCorrectError();
      }
      const mainParent = await getUserById(user.mainParentId, ["roleName"]);
      roleName = mainParent?.roleName;
    }
    // force logout user if already login on another device
    await forceLogoutIfLogin(user.id);

    setUserDetailsRedis(user);
    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, roleName: roleName, userName: user.userName, isAuthenticatorEnable: user.isAuthenticatorEnable, ...(user.isAccessUser ? { mainParentId: user.mainParentId, isAccessUser: true } : {}) },
      jwtSecret
    );

    // checking transition password
    const isTransPasswordCreated = Boolean(user.transPassword);
    const forceChangePassword = !user.loginAt;

    if (!forceChangePassword) {
      userLoginAtUpdate(user.id);
    }

    if (user?.isAccessUser) {
      const mainUserData = await internalRedis.hget(user.mainParentId, "accessUser");

      await internalRedis.hmset(user.mainParentId, { accessUser: JSON.stringify([...JSON.parse(mainUserData || "[]"), user.id]) });

      await internalRedis.hmset(user.id, { token: token });
    }
    // setting token in redis for checking if user already loggedin
    await internalRedis.hmset(user.id, { token: token });
    let isBetExist;
    if (user.roleName != userRoleConstant.user) {
      isBetExist = await getChildUsersSinglePlaceBet(user.mainParentId);
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
          authenticatorType: userAuthType,
          permissions: user?.permission
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

    if (!user.isAccessUser) {
      const userAccessData = await internalRedis.hget(user.id, "accessUser");
      if (!userAccessData || !JSON.parse(userAccessData||"[]").length) {
        await internalRedis.del(user.id);
      }
      else {
        await internalRedis.hdel(user.id, "token");
      }
    } else {
      await internalRedis.del(user.childId);
      const mainUserData = await internalRedis.hget(user.id, "accessUser");
      await internalRedis.hmset(user.id, { accessUser: JSON.stringify(JSON.parse(mainUserData || "[]")?.filter((item) => item != user.childId)) });
    }

    if (user.isDemo) {
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

    if (isDeviceExist) {
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
        statusCode: error.statusCode || 500,
        message: error.message,
      },
      req,
      res
    );
  }
};

exports.getAuthenticatorRefreshToken = async (req, res) => {
  try {
    const { deviceId } = req.params;

    const authDevice = await getAuthenticator({ deviceId: deviceId }, ["id", "type"]);
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
    const user = req.user;

    const authDevice = await getAuthenticator({ userId: id }, ["deviceId", "id", "type"]);
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

    const token = jwt.sign(
      { id: user.id, roleName: user.roleName, userName: user.userName },
      jwtSecret
    );

    // setting token in redis for checking if user already loggedin
    await internalRedis.hmset(user.id, { token: token });

    return SuccessResponse(
      {
        statusCode: 200,
        data: token
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

    const authDevice = await getAuthenticator({ userId: id }, ["deviceId", "id", "type"]);
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
      bot.sendMessage(authDevice.deviceId, __mf("telegramBot.disabled"))

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

    const users = await getAuthenticators({ deviceId: deviceId, type: authenticatorType.app }, ["user.userName", "userAuthenticator.id", "user.id"])

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

    const userAuth = await getAuthenticator({ userId: id })

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
    await setRedisKey(`${redisKeys.telegramToken}_${id}`, authId.hashedId, authenticatorExpiryTime);
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