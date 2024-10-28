const {
  userRoleConstant,
  redisTimeOut,
  differLoginTypeByRoles,
  jwtSecret,
} = require("../config/contants");
const internalRedis = require("../config/internalRedisConnection");
const { ErrorResponse, SuccessResponse } = require("../utils/response");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const {
  getUserWithUserBalance,
  addUser,
} = require("../services/userService");
const { userLoginAtUpdate } = require("../services/authService");
const { forceLogoutIfLogin, findUserPartnerShipObj, settingBetsDataAtLogin, settingOtherMatchBetsDataAtLogin, settingRacingMatchBetsDataAtLogin, settingTournamentMatchBetsDataAtLogin, loginDemoUser, deleteDemoUser } = require("../services/commonService");
const { logger } = require("../config/logger");
const { updateUserDataRedis } = require("../services/redis/commonfunction");
const { getChildUsersSinglePlaceBet } = require("../services/betPlacedService");
const { insertTransactions } = require("../services/transactionService");
const { addInitialUserBalance } = require("../services/userBalanceService");
const { insertButton } = require("../services/buttonService");


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
          isBetExist: isBetExist?.length > 0
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


exports.loginWithDemoUser = async (req, res) => {
  try {
    const currTime = new Date().getTime();
    const upperCaseUserName = `DEMO${currTime}`;

    const hashedPassword = await bcrypt.hash(Math.floor(1000000000 + Math.random() * 9000000000), process.env.BCRYPTSALT || 10);

    const userData = {
      userName: upperCaseUserName,
      fullName: "DEMO",
      password: hashedPassword,
      roleName: userRoleConstant.user,
      userBlock: false,
      betBlock: false,
      creditRefrence: 1500,
      exposureLimit: 1500 * 1000,
      maxBetLimit: 1500 * 1000,
      minBetLimit: 1,
      superParentType: null,
      superParentId: null,
      delayTime: 5,
      loginAt: new Date(),
      isDemo: true
    };

    const insertUser = await addUser(userData);

    const transactionArray = [{
      actionBy: insertUser.id,
      searchId: insertUser.id,
      userId: insertUser.id,
      amount: 1500,
      transType: transType.add,
      closingBalance: 1500,
      description: walletDescription.demoUserCreate
    }];


    await insertTransactions(transactionArray);

    const insertUserBalanceData = {
      currentBalance: 1500,
      userId: insertUser.id,
      profitLoss: 0,
      myProfitLoss: 0,
      downLevelBalance: 0,
      exposure: 0
    };

    const balance = await addInitialUserBalance(insertUserBalanceData);

    const buttonValue = [{
      type: buttonType.MATCH,
      value: defaultButtonValue.buttons,
      createBy: insertUser.id
    }, {
      type: buttonType.SESSION,
      value: sessiontButtonValue.buttons,
      createBy: insertUser.id
    },
    {
      type: buttonType.CASINO,
      value: casinoButtonValue.buttons,
      createBy: insertUser.id
    }];
    await insertButton(buttonValue);

    const response = lodash.omit(insertUser, ["password", "transPassword"]);


    const token = await loginDemoUser({ ...response, userBal: balance });

    return SuccessResponse({
      statusCode: 200, data: {
        token,
        roleName: userRoleConstant.user,
        userId: insertUser?.id,
      }
    }, req, res);
  } catch (err) {
    return ErrorResponse(err, req, res);
  }
};