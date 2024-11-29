const { userRoleConstant, transType, defaultButtonValue, buttonType, walletDescription, fileType, socketData, report, matchWiseBlockType, betResultStatus, betType, sessiontButtonValue, oldBetFairDomain, redisKeys, partnershipPrefixByRole, uplinePartnerShipForAllUsers, casinoButtonValue, transactionType } = require('../config/contants');
const { getUserById, addUser, getUserByUserName, updateUser, getUser, getChildUser, getUsers, getFirstLevelChildUser, getUsersWithUserBalance, userBlockUnblock, betBlockUnblock, getUsersWithUsersBalanceData, getCreditRefrence, getUserBalance, getChildsWithOnlyUserRole, getUserMatchLock, addUserMatchLock, deleteUserMatchLock,getMatchLockAllChild, getUserMarketLock, addUserMarketLock, deleteUserMarketLock, getMarketLockAllChild,  getUsersWithTotalUsersBalanceData, getGameLockForDetails, isAllChildDeactive, getParentsWithBalance, getChildUserBalanceSum, getFirstLevelChildUserWithPartnership, getUserDataWithUserBalance, getChildUserBalanceAndData, softDeleteAllUsers, getAllUsers, } = require('../services/userService');
const { ErrorResponse, SuccessResponse } = require('../utils/response');
const { insertTransactions } = require('../services/transactionService');
const { insertButton } = require('../services/buttonService');
const { getTotalProfitLoss,  getPlacedBetTotalLossAmount } = require('../services/betPlacedService')
const bcrypt = require("bcryptjs");
const lodash = require('lodash');
const crypto = require('crypto');
const { forceLogoutUser, profitLossPercentCol, forceLogoutIfLogin, getUserProfitLossForUpperLevel, transactionPasswordAttempts, childIdquery, loginDemoUser } = require("../services/commonService");
const { getUserBalanceDataByUserId,  getAllChildProfitLossSum, updateUserBalanceByUserId, addInitialUserBalance } = require('../services/userBalanceService');
const { ILike, Not, In } = require('typeorm');
const FileGenerate = require("../utils/generateFile");
const { sendMessageToUser } = require('../sockets/socketManager');
const { hasUserInCache, updateUserDataRedis, getUserRedisKeys, getUserRedisKey } = require('../services/redis/commonfunction');
const { commissionReport, commissionMatchReport } = require('../services/commissionService');
const { logger } = require('../config/logger');

exports.getProfile = async (req, res) => {
  let reqUser = req.user || {};
  let userId = reqUser?.id
  if (req.query?.userId) {
    userId = req.query.userId;
  }
  let where = {
    id: userId,
  };
  let user = await getUsersWithUserBalance(where);
  let response = lodash.omit(user, ["password", "transPassword"])
  return SuccessResponse({ statusCode: 200, message: { msg: "user.profile" }, data: response }, req, res)
}

exports.isUserExist = async (req, res) => {
  let { userName } = req.query;

  const isUserExist = await getUserByUserName(userName);

  return SuccessResponse({ statusCode: 200, data: { isUserExist: Boolean(isUserExist) } }, req, res);
}

exports.createUser = async (req, res) => {
  try {
    const { userName, fullName, password, phoneNumber, city, roleName, myPartnership, createdBy, creditRefrence, remark, exposureLimit, maxBetLimit, minBetLimit,  matchComissionType, matchCommission, delayTime } = req.body;
    let reqUser = req.user || {};
    const creator = await getUserById(reqUser.id || createdBy);

    if (!creator)
      return ErrorResponse({ statusCode: 400, message: { msg: "notFound", keys: { name: "Login user" } } }, req, res);

    if (!checkUserCreationHierarchy(creator, roleName))
      return ErrorResponse({ statusCode: 400, message: { msg: "user.InvalidHierarchy" } }, req, res);

    creator.myPartnership = parseInt(myPartnership);

    const upperCaseUserName = userName?.toUpperCase();
    const userExist = await getUserByUserName(upperCaseUserName);
    if (userExist)
      return ErrorResponse({ statusCode: 400, message: { msg: "user.userExist" } }, req, res);

    if (creator.roleName !== userRoleConstant.fairGameWallet && exposureLimit > creator.exposureLimit)
      return ErrorResponse({ statusCode: 400, message: { msg: "user.InvalidExposureLimit", keys: { amount: creator.exposureLimit } } }, req, res);

    const hashedPassword = await bcrypt.hash(password, process.env.BCRYPTSALT || 10);

    const userData = {
      userName: upperCaseUserName,
      fullName,
      password: hashedPassword,
      phoneNumber,
      city,
      roleName,
      userBlock: creator.userBlock,
      betBlock: creator.betBlock,
      createBy: creator.id,
      creditRefrence: creditRefrence ? parseFloat(creditRefrence) : 0,
      exposureLimit: exposureLimit || creator.exposureLimit,
      maxBetLimit: maxBetLimit ?? creator.maxBetLimit,
      minBetLimit: minBetLimit ?? creator.minBetLimit,
      matchComissionType,
      matchCommission,
      superParentType: creator.superParentType,
      superParentId: creator.superParentId,
      remark,
      delayTime: delayTime || 5
    };

    const partnerships = await calculatePartnership(userData, creator);
    const userWithPartnership = { ...userData, ...partnerships };
    const insertUser = await addUser(userWithPartnership);

    if (creditRefrence) {
      await addUser({
        id: creator.id,
        downLevelCreditRefrence: parseInt(creator.downLevelCreditRefrence) + parseFloat(creditRefrence)
      });
    }

    const transactionArray = [{
      actionBy: insertUser.createBy,
      searchId: insertUser.createBy,
      userId: insertUser.id,
      amount: 0,
      transType: transType.add,
      closingBalance: insertUser.creditRefrence,
      description: walletDescription.userCreate,
      type: transactionType.withdraw
    }];
    if (insertUser.createdBy != insertUser.id) {
      transactionArray.push({
        actionBy: insertUser.createBy,
        searchId: insertUser.id,
        userId: insertUser.id,
        amount: 0,
        transType: transType.withDraw,
        closingBalance: insertUser.creditRefrence,
        description: walletDescription.userCreate,
        type: transactionType.withdraw
      });
    }

    await insertTransactions(transactionArray);

    const insertUserBalanceData = {
      currentBalance: 0,
      userId: insertUser.id,
      profitLoss: -(creditRefrence || 0),
      myProfitLoss: 0,
      downLevelBalance: 0,
      exposure: 0
    };

    await addInitialUserBalance(insertUserBalanceData);

    if (insertUser.roleName == userRoleConstant.user) {
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
    }

    const response = lodash.omit(insertUser, ["password", "transPassword"]);

    return SuccessResponse({ statusCode: 200, message: { msg: "created", keys: { type: "User" } }, data: response }, req, res);
  } catch (err) {
    return ErrorResponse(err, req, res);
  }
};

exports.updateUser = async (req, res) => {
  try {
    let { fullName, phoneNumber, city, id, remark, matchComissionType, matchCommission } = req.body;
    let reqUser = req.user || {}
    let updateUser = await getUser({ id, createBy: reqUser.id }, ["id", "createBy", "fullName", "phoneNumber", "city", "matchComissionType", "matchCommission"]);
    if (!updateUser) return ErrorResponse({ statusCode: 400, message: { msg: "notFound", keys: { name: "User" } } }, req, res);

    updateUser.fullName = fullName ?? updateUser.fullName;
    updateUser.phoneNumber = phoneNumber ?? updateUser.phoneNumber;
    updateUser.city = city || updateUser.city;
    updateUser.matchComissionType = matchComissionType || updateUser.matchComissionType;
    updateUser.matchCommission = matchCommission || updateUser.matchCommission;
    updateUser.remark = remark || updateUser.remark;
    updateUser = await addUser(updateUser);

    let response = lodash.pick(updateUser, ["fullName", "phoneNumber", "city", "matchComissionType", "matchCommission"])
    return SuccessResponse({ statusCode: 200, message: { msg: "updated", keys: { name: "User" } }, data: response }, req, res)
  } catch (err) {
    return ErrorResponse(err, req, res);
  }
};

exports.loginWithDemoUser = async (req, res) => {
  try {
    const currTime = new Date().getTime();
    const upperCaseUserName = `DEMO${currTime}`;

    const hashedPassword = await bcrypt.hash((Math.floor(1000000000 + Math.random() * 9000000000)).toString(), process.env.BCRYPTSALT || 10);

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
      description: walletDescription.demoUserCreate,
      type: transactionType.withdraw
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

const calculatePartnership = async (userData, creator) => {
  if (userData.roleName == userRoleConstant.fairGameWallet) {
    return {};
  }

  // user created by fairgame wallet
  let fwPartnership = creator.fwPartnership;
  let faPartnership = creator.faPartnership;
  let saPartnership = creator.saPartnership;
  let aPartnership = creator.aPartnership;
  let smPartnership = creator.smPartnership;
  let mPartnership = creator.mPartnership;
  let agPartnership = creator.agPartnership;

  switch (creator.roleName) {
    case (userRoleConstant.fairGameWallet): {
      fwPartnership = creator.myPartnership;
      break;
    }
    case (userRoleConstant.fairGameAdmin): {
      faPartnership = creator.myPartnership;
      break;
    }
    case (userRoleConstant.superAdmin): {
      saPartnership = creator.myPartnership;
      break;
    }
    case (userRoleConstant.admin): {
      aPartnership = creator.myPartnership;
      break;
    }
    case (userRoleConstant.superMaster): {
      smPartnership = creator.myPartnership;
      break;
    }
    case (userRoleConstant.master): {
      mPartnership = creator.myPartnership;
      break;
    }
    case (userRoleConstant.agent): {
      agPartnership = creator.myPartnership;
      break;
    }
  }

  switch (creator.roleName) {
    case (userRoleConstant.fairGameWallet): {
      switch (userData.roleName) {
        case (userRoleConstant.fairGameAdmin): {
          faPartnership = 100 - parseInt(creator.myPartnership);
          break;
        }
        case (userRoleConstant.superAdmin): {
          saPartnership = 100 - parseInt(creator.myPartnership);
          break;
        }
        case (userRoleConstant.admin): {
          aPartnership = 100 - parseInt(creator.myPartnership);
          break;
        }
        case (userRoleConstant.superMaster): {
          smPartnership = 100 - parseInt(creator.myPartnership);
          break;
        }
        case (userRoleConstant.master): {
          mPartnership = 100 - parseInt(creator.myPartnership);
          break;
        }
        case (userRoleConstant.agent): {
          agPartnership = 100 - parseInt(creator.myPartnership);
          break;
        }
        default: {
          fwPartnership = parseInt(creator.fwPartnership);
          break;
        }
      }
    }
      break;
    case (userRoleConstant.fairGameAdmin): {
      switch (userData.roleName) {
        case (userRoleConstant.superAdmin): {
          saPartnership = 100 - parseInt(creator.myPartnership + fwPartnership);
          break;
        }
        case (userRoleConstant.admin): {
          aPartnership = 100 - parseInt(creator.myPartnership + fwPartnership);
          break;
        }
        case (userRoleConstant.superMaster): {
          smPartnership = 100 - parseInt(creator.myPartnership + fwPartnership);
          break;
        }
        case (userRoleConstant.master): {
          mPartnership = 100 - parseInt(creator.myPartnership + fwPartnership);
          break;
        }
        case (userRoleConstant.agent): {
          agPartnership = 100 - parseInt(creator.myPartnership + fwPartnership);
          break;
        }
        default: {
          faPartnership = parseInt(creator.faPartnership);
        }
      }
    }
      break;
    case (userRoleConstant.superAdmin): {
      switch (userData.roleName) {
        case (userRoleConstant.admin): {
          aPartnership = 100 - parseInt(creator.myPartnership + fwPartnership + faPartnership);
          break;
        }
        case (userRoleConstant.superMaster): {
          smPartnership = 100 - parseInt(creator.myPartnership + fwPartnership + faPartnership);
          break;
        }
        case (userRoleConstant.master): {
          mPartnership = 100 - parseInt(creator.myPartnership + fwPartnership + faPartnership);
          break;
        }
        case (userRoleConstant.agent): {
          agPartnership = 100 - parseInt(creator.myPartnership + fwPartnership + faPartnership);
          break;
        }
        default: {
          saPartnership = parseInt(creator.saPartnership);
        }
      }
    }
      break;
    case (userRoleConstant.admin): {
      switch (userData.roleName) {
        case (userRoleConstant.superMaster): {
          smPartnership = 100 - parseInt(creator.myPartnership + fwPartnership + faPartnership + saPartnership);
          break;
        }
        case (userRoleConstant.master): {
          mPartnership = 100 - parseInt(creator.myPartnership + fwPartnership + faPartnership + saPartnership);
          break;
        }
        case (userRoleConstant.agent): {
          agPartnership = 100 - parseInt(creator.myPartnership + fwPartnership + faPartnership + saPartnership);
          break;
        }
        default: {
          aPartnership = parseInt(creator.aPartnership);
        }
      }
    }
      break;
    case (userRoleConstant.superMaster): {
      switch (userData.roleName) {
        case (userRoleConstant.master): {
          mPartnership = 100 - parseInt(creator.myPartnership + fwPartnership + faPartnership + saPartnership + aPartnership);
          break;
        }
        case (userRoleConstant.agent): {
          agPartnership = 100 - parseInt(creator.myPartnership + fwPartnership + faPartnership + saPartnership + aPartnership);
          break;
        }
        default: {
          smPartnership = parseInt(creator.smPartnership);
        }
      }
    }
      break;
    case (userRoleConstant.master): {
      switch (userData.roleName) {
        case (userRoleConstant.agent): {
          agPartnership = 100 - parseInt(creator.myPartnership + fwPartnership + faPartnership + saPartnership + aPartnership + smPartnership);
          break;
        }
        default: {
          mPartnership = parseInt(creator.mPartnership);
        }
      }
    }
      break;
      case (userRoleConstant.agent): {
        switch (userData.roleName) {
          default: {
            agPartnership = parseInt(creator.agPartnership);
          }
        }
      }
        break;
  }

  if (userData.roleName != userRoleConstant.expert && fwPartnership + faPartnership + saPartnership + aPartnership + smPartnership + mPartnership + agPartnership != 100) {
    throw new Error("user.partnershipNotValid");
  }
  return {
    fwPartnership,
    faPartnership,
    saPartnership,
    aPartnership,
    smPartnership,
    mPartnership,
    agPartnership
  }
}

const checkUserCreationHierarchy = (creator, createUserRoleName) => {
  const hierarchyArray = Object.values(userRoleConstant)
  let creatorIndex = hierarchyArray.indexOf(creator.roleName)
  if (creatorIndex == -1) return false
  let index = hierarchyArray.indexOf(createUserRoleName)
  if (index == -1) return false
  if (index < creatorIndex) return false;
  if (createUserRoleName == userRoleConstant.expert && creator.roleName !== userRoleConstant.fairGameAdmin) {
    return false
  }
  return true

}

function generateTransactionPass() {
  return crypto.randomInt(0, 999999).toString().padStart(6, '0');
}

// Check old password against the stored password
const checkOldPassword = async (userId, oldPassword) => {
  // Retrieve user's password from the database
  const user = await getUserById(userId, ["password"]);
  if (!user) {
    // User not found, return error response
    throw {
      msg: "notFound",
      keys: { name: "User" },
    };
  }
  // Compare old password with the stored password
  return bcrypt.compareSync(oldPassword, user.password);
};

// Check old transaction password against the stored transaction password
const checkTransactionPassword = async (userId, oldTransactionPass) => {
  // Retrieve user's transaction password from the database
  const user = await getUserById(userId, ["transPassword", "id"]);
  if (!user) {
    // User not found, return error response
    throw {
      msg: "notFound",
      keys: { name: "User" },
    };
  }
  if (!user.transPassword) {
    // User not found, return error response
    throw {
      msg: "TransactionPasswordNotExist"
    };
  }
  // Compare old transaction password with the stored transaction password
  return bcrypt.compareSync(oldTransactionPass, user.transPassword);
};

// API endpoint for changing password
exports.changePassword = async (req, res, next) => {
  try {
    // Destructure request body
    const {
      oldPassword,
      newPassword,
      transactionPassword
    } = req.body;

    // Hash the new password
    const password = bcrypt.hashSync(newPassword, 10);

    // If user is changing its password after login or logging in for the first time
    if (oldPassword && !transactionPassword) {
      // Check if the old password is correct
      const userId = req.user.id;
      const isPasswordMatch = await checkOldPassword(userId, oldPassword);


      if (!isPasswordMatch) {
        return ErrorResponse(
          {
            statusCode: 403,
            message: { msg: "auth.invalidPass", keys: { type: "old" } },
          },
          req,
          res
        );
      }

      // Retrieve additional user information
      const user = await getUserById(userId, ["loginAt", "roleName"]);

      // Update loginAt and generate new transaction password if conditions are met
      if (user.loginAt == null && user.roleName !== userRoleConstant.user) {
        const generatedTransPass = generateTransactionPass();
        await updateUser(userId, {
          loginAt: new Date(),
          transPassword: bcrypt.hashSync(generatedTransPass, 10),
          password,
        });
        await forceLogoutUser(userId, true);
        return SuccessResponse(
          {
            statusCode: 200,
            message: { msg: "auth.passwordChanged" },
            data: { transactionPassword: generatedTransPass },
          },
          req,
          res
        );
      }

      // Update only the password if conditions are not met
      await updateUser(userId, { loginAt: new Date(), password });
      await forceLogoutUser(userId);

      return SuccessResponse(
        {
          statusCode: 200,
          message: { msg: "auth.passwordChanged" },
        },
        req,
        res
      );
    }
    // if password is changed by parent of users
    const userId = req.body.userId;

    const user = await getUserById(req.user.id, ["transPassword", "id", "transactionPasswordAttempts", "createBy", "superParentId"]);

    const isPasswordMatch = await checkTransactionPassword(
      req.user.id,
      transactionPassword
    );

    if (!isPasswordMatch) {

      const currDomain = `${req.protocol}://${req.get('host')}`;

      if (currDomain != oldBetFairDomain) {
        await transactionPasswordAttempts(user);
      }
      return ErrorResponse(
        {
          statusCode: 403,
          message: { msg: "auth.invalidPass", keys: { type: "transaction" } },
          data: { attemptsLeft: 11 - (user.transactionPasswordAttempts + 1) }
        },
        req,
        res
      );
    }

    if (user?.transactionPasswordAttempts > 0) {
      await updateUser(user.id, { transactionPasswordAttempts: 0 });
    }

    if (!userId) {
      // Update loginAt, password, and reset transactionPassword
      await updateUser(req.user.id, {
        password,
      });
      await forceLogoutUser(req.user.id);
    } else {
      // Update loginAt, password, and reset transactionPassword
      await updateUser(userId, {
        loginAt: null,
        password,
        transPassword: null,
      });
      await forceLogoutUser(userId);
    }
    return SuccessResponse(
      {
        statusCode: 200,
        message: { msg: "auth.passwordChanged" },
      },
      req,
      res
    );
  } catch (error) {
    // Log any errors that occur
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

exports.setExposureLimit = async (req, res, next) => {
  try {
    let { amount, userId } = req.body

    let reqUser = req.user || {}
    let loginUser = await getUserById(reqUser.id, ["id", "exposureLimit", "roleName"]);
    if (!loginUser) return ErrorResponse({ statusCode: 400, message: { msg: "notFound", keys: { name: "Login user" } } }, req, res);

    if ( parseFloat(amount) > loginUser.exposureLimit)
      return ErrorResponse({ statusCode: 400, message: { msg: "user.InvalidExposureLimit" , keys: { amount: loginUser.exposureLimit }} }, req, res);


    let user = await getUser({ id: userId, createBy: reqUser.id }, ["id", "exposureLimit", "roleName"]);
    if (!user) return ErrorResponse({ statusCode: 400, message: { msg: "notFound", keys: { name: "User" } } }, req, res);


    amount = parseInt(amount);
    user.exposureLimit = amount
    let childUsers = await getChildUser(user.id)


    childUsers.map(async childObj => {
      let childUser = await getUserById(childObj.id);
      if (childUser.exposureLimit > amount || childUser.exposureLimit == 0) {
        await updateUser(childUser.id,{exposureLimit : amount});
      }
    });
    await updateUser(user.id,{exposureLimit : amount});
    return SuccessResponse(
      {
        statusCode: 200,
        message: { msg: "user.ExposurelimitSet" },
        data: {
          user: {
            id: user.id,
            exposureLimit: user.exposureLimit
          }
        },
      },
      req,
      res
    );
  } catch (error) {
    return ErrorResponse(error, req, res);
  }
}

exports.userList = async (req, res, next) => {
  try {
    let reqUser = req.user;
    // let loginUser = await getUserById(reqUser.id)
    const { type, userId, roleName, ...apiQuery } = req.query;
    let userRole = roleName || reqUser?.roleName;
    let where = {
      createBy: userId || reqUser.id,
      roleName: Not(userRole)
    };

    let users = await getUsersWithUsersBalanceData(where, apiQuery);

    let response = {
      count: 0,
      list: [],
    };
    if (!users[1]) {
      return SuccessResponse(
        {
          statusCode: 200,
          message: { msg: "user.userList" },
          data: response,
        },
        req,
        res
      );
    }
    response.count = users[1];
    let partnershipCol = [];
    if (userRole == userRoleConstant.agent) {
      partnershipCol = [
        "agPartnership",
        "mPartnership",
        "smPartnership",
        "aPartnership",
        "saPartnership",
        "faPartnership",
        "fwPartnership",
      ];
    }
    if (userRole == userRoleConstant.master) {
      partnershipCol = [
        "mPartnership",
        "smPartnership",
        "aPartnership",
        "saPartnership",
        "faPartnership",
        "fwPartnership",
      ];
    }
    if (userRole == userRoleConstant.superMaster) {
      partnershipCol = [
        "smPartnership",
        "aPartnership",
        "saPartnership",
        "faPartnership",
        "fwPartnership",
      ];
    }
    if (userRole == userRoleConstant.admin) {
      partnershipCol = [
        "aPartnership",
        "saPartnership",
        "faPartnership",
        "fwPartnership",
      ];
    }
    if (userRole == userRoleConstant.superAdmin) {
      partnershipCol = ["saPartnership", "faPartnership", "fwPartnership"];
    }
    if (userRole == userRoleConstant.fairGameAdmin) {
      partnershipCol = ["faPartnership", "fwPartnership"];
    }
    if (userRole == userRoleConstant.fairGameWallet || userRole == userRoleConstant.expert) {
      partnershipCol = ["fwPartnership"];
    }
    const domainUrl = `${req.protocol}://${req.get("host")}`;

    let data = await Promise.all(
      users[0].map(async (element) => {

        if (element?.roleName != userRoleConstant.user) {
          element.userBal['exposure'] = 0;
        }

        element['percentProfitLoss'] = element.userBal['myProfitLoss'];
        let partner_ships = 100;
        if (partnershipCol && partnershipCol.length) {
          partner_ships = partnershipCol.reduce((partialSum, a) => partialSum + element[a], 0);
          element['percentProfitLoss'] = ((element.userBal['profitLoss'] / 100) * partner_ships).toFixed(2);
        }
        if (element.roleName != userRoleConstant.user) {
          element['availableBalance'] = Number((parseFloat(element.userBal['currentBalance'])).toFixed(2)) - Number(parseFloat(element.userBal["exposure"]).toFixed(2));
          let childUsersBalances = await getChildUserBalanceSum(element.id);

          let balanceSum = childUsersBalances?.[0]?.balance;
          element['balance'] = Number((parseFloat(balanceSum || 0)).toFixed(2));
        } else {
          element['availableBalance'] = Number((parseFloat(element.userBal['currentBalance']) - element.userBal['exposure']).toFixed(2));
          element['balance'] = element.userBal['currentBalance'];
        }
        element['percentProfitLoss'] = element.userBal['myProfitLoss'];
        element['commission'] = element.userBal['totalCommission']
        if (partnershipCol && partnershipCol.length) {
          let partnerShips = partnershipCol.reduce((partialSum, a) => partialSum + element[a], 0);
          element['percentProfitLoss'] = ((element.userBal['profitLoss'] / 100) * partnerShips).toFixed(2);
          element['commission'] = (element.userBal['totalCommission']).toFixed(2) + '(' + partnerShips + '%)';
          element['upLinePartnership'] = partnerShips;
        }

        // if (element?.roleName != userRoleConstant.user && domainUrl != oldBetFairDomain) {
        //   element.exposureLimit="NA";
        // }
        return element;
      })
    );

    if (type) {
      const header = [
        { excelHeader: "User Name", dbKey: "userName" },
        { excelHeader: "Role", dbKey: "roleName" },
        { excelHeader: "Credit Ref", dbKey: "creditRefrence" },
        { excelHeader: "Balance", dbKey: "balance" },
        { excelHeader: "Client P/L", dbKey: "userBal.profitLoss" },
        { excelHeader: "% P/L", dbKey: "percentProfitLoss" },
        { excelHeader: "Comission", dbKey: "commission" },
        { excelHeader: "Exposure", dbKey: "userBal.exposure" },
        { excelHeader: "Available Balance", dbKey: "availableBalance" },
        { excelHeader: "UL", dbKey: "userBlock" },
        { excelHeader: "BL", dbKey: "betBlock" },
        { excelHeader: "Match Com Type", dbKey: "matchComissionType" },
        { excelHeader: "M Com %", dbKey: "matchCommission" },
        { excelHeader: "Exposure Limit", dbKey: "exposureLimit" },
        ...(type == fileType.excel
          ? [
            {
              excelHeader: "FairGameWallet Partnership",
              dbKey: "fwPartnership",
            },
            {
              excelHeader: "FairGameAdmin Partnership",
              dbKey: "faPartnership",
            },
            { excelHeader: "SuperAdmin Partnership", dbKey: "saPartnership" },
            { excelHeader: "Admin Partnership", dbKey: "aPartnership" },
            {
              excelHeader: "SuperMaster Partnership",
              dbKey: "smPartnership",
            },
            { excelHeader: "Master Partnership", dbKey: "mPartnership" },
            { excelHeader: "Agent Partnership", dbKey: "agPartnership" },
            { excelHeader: "Full Name", dbKey: "fullName" },
            { excelHeader: "City", dbKey: "city" },
            { excelHeader: "Phone Number", dbKey: "phoneNumber" },
          ]
          : []),
      ];
      const total = data?.reduce((prev, curr) => {
        prev["creditRefrence"] = (prev["creditRefrence"] || 0) + (curr["creditRefrence"] || 0);
        prev["balance"] = (prev["balance"] || 0) + (curr["balance"] || 0);
        prev["availableBalance"] = (prev["availableBalance"] || 0) + (curr["availableBalance"] || 0);

        if (prev["userBal"]) {
          prev["userBal"] = {
            profitLoss: (prev["userBal"]["profitLoss"] || 0) + (curr["userBal"]["profitLoss"] || 0),
            exposure: (prev["userBal"]["exposure"] || 0) + (curr["userBal"]["exposure"] || 0)
          }
        }
        else {
          prev["userBal"] = {
            profitLoss: (curr["userBal"]["profitLoss"] || 0),
            exposure: (curr["userBal"]["exposure"] || 0),
          }
        }
        return prev
      }, {});
      data?.unshift(total);

      const fileGenerate = new FileGenerate(type);
      const file = await fileGenerate.generateReport(data, header, "Client List Report");
      const fileName = `accountList_${new Date()}`

      return SuccessResponse(
        {
          statusCode: 200,
          message: { msg: "user.userList" },
          data: { file: file, fileName: fileName },
        },
        req,
        res
      );
    }

    response.list = data;


    return SuccessResponse(
      {
        statusCode: 200,
        message: { msg: "user.userList" },
        data: response,
      },
      req,
      res
    );
  } catch (error) {
    logger.error({
      message: "error at user list",
      context: error.message,
      stake: error.stack
    })
    return ErrorResponse(error, req, res);
  }
}

exports.getTotalUserListBalance = async (req, res, next) => {
  try {
    let reqUser = req.user;

    const { type, userId, roleName, ...apiQuery } = req.query;
    let userRole = roleName || reqUser?.roleName;
    let where = {
      createBy: userId || reqUser.id,
      roleName: Not(userRole)
    };

    let queryColumns = `SUM(user.creditRefrence) as "totalCreditReference", SUM(UB.profitLoss) as profitSum,SUM(UB.downLevelBalance) as "downLevelBalance", SUM(UB.currentBalance) as "availableBalance",SUM(CASE WHEN user.roleName = 'user' THEN UB.exposure ELSE 0 END) AS "totalExposure",SUM(UB.totalCommission) as totalCommission`;

    switch (userRole) {
      case (userRoleConstant.fairGameWallet):
      case (userRoleConstant.expert): {
        queryColumns = queryColumns + `, ROUND(SUM(UB.profitLoss / 100 * (user.fwPartnership)), 2) as percentProfitLoss`;
        break;
      }
      case (userRoleConstant.fairGameAdmin): {
        queryColumns = queryColumns + `, ROUND(SUM(UB.profitLoss / 100 * (user.faPartnership + user.fwPartnership)), 2) as percentProfitLoss`;
        break;
      }
      case (userRoleConstant.superAdmin): {
        queryColumns = queryColumns + `, ROUND(SUM(UB.profitLoss / 100 * (user.saPartnership + user.faPartnership + user.fwPartnership )), 2) as percentProfitLoss`;
        break;
      }
      case (userRoleConstant.admin): {
        queryColumns = queryColumns + `, ROUND(SUM(UB.profitLoss / 100 * (user.aPartnership + user.saPartnership + user.faPartnership + user.fwPartnership )), 2) as percentProfitLoss`;
        break;
      }
      case (userRoleConstant.superMaster): {
        queryColumns = queryColumns + `, ROUND(SUM(UB.profitLoss / 100 * (user.smPartnership + user.aPartnership + user.saPartnership + user.faPartnership + user.fwPartnership )), 2) as percentProfitLoss`;
        break;
      }
      case (userRoleConstant.master): {
        queryColumns = queryColumns + `, ROUND(SUM(UB.profitLoss / 100 * (user.mPartnership + user.smPartnership + user.aPartnership + user.saPartnership + user.faPartnership + user.fwPartnership )), 2) as percentProfitLoss`;
        break;
      }
      case (userRoleConstant.agent): {
        queryColumns = queryColumns + `, ROUND(SUM(UB.profitLoss / 100 * (user.agPartnership + user.mPartnership + user.smPartnership + user.aPartnership + user.saPartnership + user.faPartnership + user.fwPartnership )), 2) as percentProfitLoss`;
        break;
      }
    }
    let childUserBalanceWhere="";

    if(apiQuery.userBlock){
      childUserBalanceWhere = `AND "p"."userBlock" = ${apiQuery?.userBlock?.slice(2)}`
    }

    const totalBalance = await getUsersWithTotalUsersBalanceData(where, apiQuery, queryColumns);

    let childUsersBalances = await getChildUserBalanceSum(userId || reqUser.id, true, childUserBalanceWhere);

    totalBalance.currBalance = childUsersBalances?.[0]?.balance;
    totalBalance.availableBalance = parseFloat(totalBalance.availableBalance || 0) - parseFloat(totalBalance.totalExposure || 0);

    return SuccessResponse(
      {
        statusCode: 200,
        data: totalBalance,
      },
      req,
      res
    );
  } catch (error) {
    logger.error({
      message: "Error in user list total balance.",
      context: error.message,
      stake: error.stack
    });
    return ErrorResponse(error, req, res);
  }
}

exports.userSearchList = async (req, res, next) => {
  try {
    let { userName, createdBy, isUser } = req.query
    if (!userName) {
      return SuccessResponse(
        {
          statusCode: 200,
          message: { msg: "user.userList" },
          data: { users: [], count: 0 },
        },
        req,
        res
      );
    }
    let where = {};
    if (userName) where.userName = ILike(`%${userName}%`);
    if (createdBy) {
      where.createBy = createdBy;
      where.id = Not(req.user.id);
    }
    else {
      const childIds = await getChildUser(req.user.id);
      where.id = In(childIds?.map((item) => item.id));
    }
    if (isUser) {
      where.roleName = userRoleConstant.user;
    }
    let users = await getUsers(where, ["id", "userName","userBlock","betBlock"])
    let response = {
      users: users[0],
      count: users[1]
    }
    return SuccessResponse(
      {
        statusCode: 200,
        message: { msg: "user.userList" },
        data: response,
      },
      req,
      res
    );
  } catch (error) {
    return ErrorResponse(error, req, res);
  }
}

exports.userBalanceDetails = async (req, res, next) => {
  try {
    // Retrieve user information from the request
    const { user: reqUser } = req;
    const userId = req.query?.id || reqUser?.id;

    // Fetch details of the logged-in user
    const loginUser = await getUserById(userId);

    // Ensure the user exists and matches the logged-in user
    if (!loginUser || userId !== loginUser.id) {
      return ErrorResponse(
        {
          statusCode: 400,
          message: { msg: "notFound", keys: { name: "User" } }
        },
        req,
        res
      );
    }

    // Retrieve first-level child users and their IDs
    const firstLevelChildUsers = await getFirstLevelChildUser(loginUser.id);
    const firstLevelChildUserIds = firstLevelChildUsers.map(user => user.id);

    // Fetch user balance data
    const userBalanceData = getUserBalanceDataByUserId(loginUser.id, ["id", "currentBalance", "profitLoss", "myProfitLoss"]);

    // Fetch profit/loss sum for first-level child users
    const firstLevelChildBalanceData = getAllChildProfitLossSum(firstLevelChildUserIds, reqUser.roleName);

    // Fetch balance data for all child users
    const allChildBalanceData = getChildUserBalanceSum(userId, true);

    // Wait for all promises to settle
    const [userBalance, firstLevelChildBalance, allChildBalance] = await Promise.allSettled([userBalanceData, firstLevelChildBalanceData, allChildBalanceData]);

    // Calculate various balance-related metrics
    const response = {
      userCreditReference: parseFloat(loginUser?.creditRefrence),
      downLevelOccupyBalance: parseFloat(allChildBalance?.value?.[0]?.balance || 0),
      downLevelCreditReference: loginUser?.downLevelCreditRefrence,
      availableBalance: parseFloat(userBalance?.value?.currentBalance || 0),
      totalMasterBalance: parseFloat(userBalance?.value?.currentBalance || 0) + parseFloat(allChildBalance.value?.[0]?.balance || 0),
      upperLevelBalance: -parseFloat((parseFloat(userBalance?.value?.profitLoss) * parseFloat(uplinePartnerShipForAllUsers[loginUser.roleName]?.reduce((prev, curr) => {
        return (parseFloat(loginUser[`${curr}Partnership`]) + prev);
      }, 0)) / 100).toFixed(2)),
      downLevelProfitLoss: -parseFloat((parseFloat(firstLevelChildBalance?.value?.firstlevelchildsprofitlosssum || 0) + parseFloat((parseFloat(firstLevelChildBalance?.value?.profitLoss) * parseFloat(uplinePartnerShipForAllUsers[loginUser.roleName]?.reduce((prev, curr) => {
        return (parseFloat(loginUser[`${curr}Partnership`]) + prev);
      }, 0)) / 100).toFixed(2))).toFixed(2)),
      availableBalanceWithProfitLoss: ((parseFloat(userBalance?.value?.currentBalance || 0) + parseFloat(-firstLevelChildBalance?.value?.firstlevelchildsprofitlosssum || 0))),
      profitLoss: -firstLevelChildBalance?.value?.firstlevelchildsprofitlosssum || 0,
      totalProfitLossUpperlevel: parseFloat(userBalance?.value?.profitLoss || 0),
      totalProfitLossDownlevel: parseFloat(firstLevelChildBalance?.value?.profitLoss),
      upperLevelProfitLossPercent: parseFloat(uplinePartnerShipForAllUsers[loginUser.roleName]?.reduce((prev, curr) => {
        return (parseFloat(loginUser[`${curr}Partnership`]) + prev);
      }, 0))
    };

    // Send success response
    return SuccessResponse(
      {
        statusCode: 200,
        message: { msg: "user.UserBalanceFetchSuccessfully" },
        data: { response },
      },
      req,
      res
    );
  } catch (error) {
    // Handle errors and send error response
    return ErrorResponse(error, req, res);
  }
};

exports.setCreditReferrence = async (req, res, next) => {
  try {

    let { userId, amount, transactionPassword, remark } = req.body;
    let reqUser = req.user;
    amount = parseFloat(amount);

    let loginUser = await getUserById(reqUser.id, ["id", "creditRefrence", "downLevelCreditRefrence", "roleName"]);
    if (!loginUser) return ErrorResponse({ statusCode: 400, message: { msg: "notFound", keys: { name: "Login user" } } }, req, res);

    let user = await getUser({ id: userId, createBy: reqUser.id }, ["id", "creditRefrence", "roleName"]);
    if (!user) return ErrorResponse({ statusCode: 400, message: { msg: "notFound", keys: { name: "User" } } }, req, res);

    let userBalance = await getUserBalanceDataByUserId(user.id);
    if (!userBalance)
      return ErrorResponse({ statusCode: 400, message: { msg: "notFound", keys: { name: "User balance" } } }, req, res);
    let previousCreditReference = parseFloat(user.creditRefrence)
    let updateData = {
      creditRefrence: amount
    }

    let profitLoss = parseFloat(userBalance.profitLoss) + previousCreditReference - amount;
    let newUserBalanceData = await updateUserBalanceByUserId(user.id, { profitLoss });
    const userExistRedis = await hasUserInCache(user.id);

    if (userExistRedis) {

      await updateUserDataRedis(user.id, { profitLoss });
    }

    let transactionArray = [{
      actionBy: reqUser.id,
      searchId: user.id,
      userId: user.id,
      amount: previousCreditReference,
      transType: transType.creditRefer,
      closingBalance: amount,
      description: "CREDIT REFRENCE " + (remark || '')
    }, {
      actionBy: reqUser.id,
      searchId: reqUser.id,
      userId: user.id,
      amount: previousCreditReference,
      transType: transType.creditRefer,
      closingBalance: amount,
      description: "CREDIT REFRENCE " + (remark || '')
    }]

    const transactioninserted = await insertTransactions(transactionArray);
    let updateLoginUser = {
      downLevelCreditRefrence: parseInt(loginUser.downLevelCreditRefrence) - previousCreditReference + amount
    }
    await updateUser(user.id, updateData);
    await updateUser(loginUser.id, updateLoginUser);
    updateData["id"] = user.id
    return SuccessResponse(
      {
        statusCode: 200,
        message: { msg: "updated", keys: { name: "Credit reference" } },
        data: updateData,
      },
      req,
      res
    );

  } catch (error) {
    return ErrorResponse(error, req, res);
  }

}

// Controller function for locking/unlocking a user
exports.lockUnlockUser = async (req, res, next) => {
  try {
    // Extract relevant data from the request body and user object
    const { userId, betBlock, userBlock } = req.body;
    const { id: loginId,roleName } = req.user;

    // Fetch user details of the current user, including block information
    const userDetails = await getUserById(loginId, ["userBlock", "betBlock"]);

    // Fetch details of the user who is performing the block/unblock operation,
    // including the hierarchy and block information
    const blockingUserDetail = await getUserById(userId, [
      "createBy",
      "userBlock",
      "betBlock",
      "userBlockedBy",
      "betBlockedBy"
    ]);

    // Check if the current user is already blocked
    if (userDetails?.userBlock) {
      throw { message: { msg: "user.userBlockError" } };
    }

    // Check if the block type is 'betBlock' and the user is already bet-blocked
    if (!betBlock && userDetails?.betBlock) {
      throw { message: { msg: "user.betBlockError" } };
    }

    // Check if the user performing the block/unblock operation has the right access
    if (blockingUserDetail?.createBy != loginId && roleName != userRoleConstant.superAdmin) {
      return ErrorResponse(
        {
          statusCode: 403,
          message: { msg: "user.blockCantAccess" },
        },
        req,
        res
      );
    }

    if (blockingUserDetail?.userBlock && loginId != blockingUserDetail?.userBlockedBy && !userBlock) {
      return ErrorResponse(
        {
          statusCode: 400,
          message: {
            msg: "user.blockedBySomeOneElse",
            keys: { name: "user" }
          },
        },
        req,
        res
      );
    }
    if (blockingUserDetail?.betBlock && loginId != blockingUserDetail?.betBlockedBy && !betBlock) {
      return ErrorResponse(
        {
          statusCode: 400,
          message: {
            msg: "user.blockedBySomeOneElse",
            keys: { name: "user's bet" }
          },
        },
        req,
        res
      );
    }

    // Check if the user is already blocked or unblocked (prevent redundant operations)
    if (blockingUserDetail?.userBlock != userBlock) {
      // Perform the user block/unblock operation
      const blockedUsers = await userBlockUnblock(userId, loginId, userBlock);
      //   if blocktype is user and its block then user would be logout by socket
      if (userBlock) {
        blockedUsers?.[0]?.forEach((item) => {
          forceLogoutUser(item?.id);
        });
      }
    }

    // Check if the user is already bet-blocked or unblocked (prevent redundant operations)
    if (blockingUserDetail?.betBlock != betBlock) {
      // Perform the bet block/unblock operation

      const blockedBets = await betBlockUnblock(userId, loginId, betBlock);

      blockedBets?.[0]?.filter((item) => item?.roleName == userRoleConstant.user)?.forEach((item) => {
        sendMessageToUser(item?.id, socketData.betBlockEvent, {
          betBlock: betBlock,
        });
      });
    }

    // Return success response
    return SuccessResponse(
      { statusCode: 200, message: { msg: "user.lock/unlockSuccessfully" } },
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

exports.generateTransactionPassword = async (req, res) => {
  const { id } = req.user;
  const { transactionPassword } = req.body;

  const encryptTransPass = bcrypt.hashSync(transactionPassword, 10);
  await updateUser(id, {
    transPassword: encryptTransPass,
  });

  return SuccessResponse(
    {
      statusCode: 200,
      message: {
        msg: "updated",
        keys: { name: "Transaction Password" },
      },
    },
    req,
    res
  );
};

exports.generalReport = async (req, res) => {
  try {
    let usersData, total, message
    let reqUser = req.user


    if (req.query.type === report.queryType) {
      message = "user.credit/refrence"

      usersData = await getCreditRefrence({ createBy: reqUser.id, id: Not(reqUser.id) }, ["id", "roleName", "createBy", "userName", "creditRefrence"])

      total = usersData.reduce(function (tot, arr) {
        const creditRefValue = parseFloat(arr.creditRefrence);
        return tot + creditRefValue;
      }, 0)
    } else {
      message = "user.balance"

      usersData = await getUserBalance({ createBy: reqUser.id, id: Not(reqUser.id) }, ['user.id', 'user.userName', 'user.phoneNumber', "userBalances.id", "userBalances.currentBalance", "userBalances.userId"
      ])
      total = usersData.reduce(function (tot, arr) {
        const current = parseFloat(arr.userBal.currentBalance);
        return tot + current;
      }, 0)
    }
    return SuccessResponse(
      {
        statusCode: 200, message: { msg: message }, data: { usersData, total: total, },
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

exports.totalProfitLoss = async (req, res) => {
  try {
    let { userId, startDate, endDate, matchId } = req.body;
    let user, totalLoss
    let queryColumns = ``;
    let where = {}

    if (!userId) {
      userId = req.user.id
    }
    if (matchId) {
      where.matchId = matchId
    }

    user = await getUserById(userId);
    if (!user)
      return ErrorResponse(
        { statusCode: 400, message: { msg: "invalidData" } },
        req,
        res
      );
    queryColumns = profitLossPercentCol(user, queryColumns);
    totalLoss = `(Sum(CASE WHEN placeBet.result = 'LOSS' then ROUND(placeBet.lossAmount / 100 * ${queryColumns}, 2) ELSE 0 END) - Sum(CASE WHEN placeBet.result = 'WIN' then ROUND(placeBet.winAmount / 100 * ${queryColumns}, 2) ELSE 0 END)) as "totalLoss"`;

    if (user && user.roleName == userRoleConstant.user) {
      where.createBy = In([userId])
      totalLoss = `(Sum(CASE WHEN placeBet.result = 'WIN' then ROUND(placeBet.winAmount / 100 * ${queryColumns}, 2) ELSE 0 END) - Sum(CASE WHEN placeBet.result = 'LOSS' then ROUND(placeBet.lossAmount / 100 * ${queryColumns}, 2) ELSE 0 END)) as "totalLoss"`;
    }

    totalLoss = `SUM(CASE WHEN placeBet.result = 'WIN' AND placeBet.marketType = 'matchOdd' THEN ROUND(placeBet.winAmount / 100, 2) ELSE 0 END) as "totalDeduction", ` + totalLoss;
    let subQuery = await childIdquery(user)
    const result = await getTotalProfitLoss(where, startDate, endDate, totalLoss, subQuery)
    return SuccessResponse(
      {
        statusCode: 200, data: { result },
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

exports.getMatchLockAllChild = async (req, res) => {
  let reqUser = req.user;
  let matchId = req.query.matchId;
  let childUsers = await getMatchLockAllChild(reqUser.id, matchId);
  return SuccessResponse({
    statusCode: 200,
    data: childUsers,
  }, req, res);
}

exports.userMatchLock = async (req, res) => {
  try {
    const { userId, matchId, type, block,operationToAll, roleName } = req.body;
    let reqUser = req.user || {};

    if (roleName == userRoleConstant.fairGameAdmin || roleName == userRoleConstant.fairGameWallet) {
      reqUser.id = userId;
      reqUser.roleName = roleName;
    }

    const childUsers = roleName == userRoleConstant.fairGameWallet ? await getAllUsers({}, ["id", "userName"]) : roleName == userRoleConstant.fairGameAdmin ? await getAllUsers({ superParentId: userId }, ["id", "userName"]) : await getChildUser(userId);
    const allChildUserIds = [...childUsers.map(obj => obj.id), ...(operationToAll ? [] : [userId])];

    let returnData;
    for (const blockUserId of allChildUserIds) {
      returnData = await userBlockUnlockMatch(blockUserId, matchId, reqUser, block, type);
    }

    let allChildMatchDeactive = true;
    let allChildSessionDeactive = true;

    const allDeactive = await isAllChildDeactive({ createBy: reqUser.id, id: Not(reqUser.id) }, ['userMatchLock.id'], matchId);
    allDeactive.forEach(ob => {
      if (!ob.userMatchLock_id || !ob.userMatchLock_matchLock) {
        allChildMatchDeactive = false;
      }
      if (!ob.userMatchLock_id || !ob.userMatchLock_sessionLock) {
        allChildSessionDeactive = false;
      }
    });

    return SuccessResponse({
      statusCode: 200,
      message: { msg: "updated", keys: { name: "User" } },
      data: { returnData, allChildMatchDeactive, allChildSessionDeactive },
    }, req, res);
  } catch (error) {
    return ErrorResponse(error, req, res);
  }
  async function userBlockUnlockMatch(userId, matchId, reqUser, block, type) {
    let userAlreadyBlockExit = await getUserMatchLock({ userId, matchId, blockBy: reqUser.id });

    if (!userAlreadyBlockExit) {
      if (!block) {
        throw { message: { msg: "notUnblockFirst" } };
      }

      const object = {
        userId,
        matchId,
        blockBy: reqUser.id,
        matchLock: type == matchWiseBlockType.match && block,
        sessionLock: type != matchWiseBlockType.match && block
      };

      addUserMatchLock(object);
      return object;
    }

    if (type == matchWiseBlockType.match) {
      userAlreadyBlockExit.matchLock = block;
    } else {
      userAlreadyBlockExit.sessionLock = block;
    }

    if (!block && !(userAlreadyBlockExit.matchLock || userAlreadyBlockExit.sessionLock)) {
      deleteUserMatchLock({ id: userAlreadyBlockExit.id });
      return userAlreadyBlockExit;
    }

    addUserMatchLock(userAlreadyBlockExit);
    return userAlreadyBlockExit;
  }

}

// userMarketLock
exports.getMarketLockAllChild = async (req, res) => {
  let reqUser = req.user;
  let matchId = req.query.matchId;
  let betId = req.query.betId;
//   let childUsers = await getMarketLockAllChild({id: reqUser.id, matchId, betId},['user.id','user.userName','user.fullName',"user.autoBlock"
// ]);
let childUsers = await getMarketLockAllChild({createBy:reqUser.id, id: Not(reqUser.id), matchId, betId},['user.id AS id',
'user.userName AS userName',
'user.fullName AS fullName'
]);
  return SuccessResponse({
    statusCode: 200,
    data: childUsers,
  }, req, res);
}

exports.userMarketLock = async (req, res) => {
  try {
    const { userId, matchId, blockType = "", betId = "", sessionType } = req.body;
    let reqUser = req.user || {};
    let roleName = reqUser.roleName;
    let isLock = true; 
    let checkMarket = await getUserMarketLock({ userId, matchId, betId, blockType, blockBy: reqUser.id })

    if (isLock && checkMarket) {
      return ErrorResponse(
        { statusCode: 400, message: { msg: "alreadyLocked" } },
        req,
        res
      );
    }
    if (!isLock && !checkMarket) {
      return ErrorResponse(
        { statusCode: 400, message: { msg: "notLocked" } },
        req,
        res
      );
    }

    const childUsers = roleName == userRoleConstant.fairGameWallet ? await getAllUsers({}, ["id", "userName"]) : await getChildsWithOnlyUserRole(userId);
    const allChildUserIds = Array.from(
      new Set([...childUsers.map((obj) => obj.id), userId])
    );

    let returnData;
    for (const blockUserId of allChildUserIds) {
      returnData = await userBlockUnlockMarket(blockUserId, matchId, reqUser, betId, sessionType, blockType);
    }


    return SuccessResponse({
      statusCode: 200,
      message: { msg: "updated", keys: { name: "User" } },
      data: { returnData },
    }, req, res);
  } catch (error) {
    return ErrorResponse(error, req, res);
  }

  async function userBlockUnlockMarket(userId, matchId, reqUser, betId, sessionType, blockType) {
    let userAlreadyLockExit = await getUserMarketLock({ userId, matchId, blockType, blockBy: reqUser.id });

    if (!userAlreadyLockExit) {
      const object = {
        userId,
        matchId,
        blockBy: reqUser.id,
        betId,
        sessionType,
        blockType
      };
      addUserMarketLock(object);
      return object;
    }else{
      deleteUserMarketLock({ id: userAlreadyLockExit.id });
      return userAlreadyLockExit;
    }
  }
}

exports.checkChildDeactivate = async (req, res) => {
  const { matchId } = req.query;
  let reqUser = req.user;
  let allChildMatchDeactive = true;
  let allChildSessionDeactive = true;
  let allDeactive = await isAllChildDeactive({ createBy: reqUser.id, id: Not(reqUser.id) }, ['userMatchLock.id', 'userMatchLock.matchLock', 'userMatchLock.sessionLock'], matchId);
  allDeactive.forEach(ob => {
    if (!ob.userMatchLock_id) {
      allChildMatchDeactive = false;
      allChildSessionDeactive = false;
    } else {
      if (!ob.userMatchLock_matchLock) {
        allChildMatchDeactive = false;
      }
      if (!ob.userMatchLock_sessionLock) {
        allChildSessionDeactive = false;
      }
    }
  })

  return SuccessResponse({
    statusCode: 200,
    message: { msg: "updated", keys: { name: "User unlock" } },
    data: { allChildMatchDeactive, allChildSessionDeactive },
  }, req, res);
}

exports.getUserDetailsForParent = async (req, res) => {
  try {
    const { userId } = req.query;
    let returnObj = {};
    returnObj.userLock = await getParentsWithBalance(userId);
    returnObj.userDetails = await getUserBalance({ id: userId }, ["user.id", "user.userName", "user.userBlock", "user.betBlock", "user.exposureLimit", "user.creditRefrence", "userBalances.exposure", "userBalances.currentBalance"]);
    returnObj.gameLock = await getGameLockForDetails({ userId }, ["userMatchLock", "blockByUser.userName", "match.title"]);
    returnObj.betPlaced = await getPlacedBetTotalLossAmount({ createBy: userId, result: betResultStatus.PENDING, betType: In([betType.NO, betType.YES]) });

    return SuccessResponse({
      statusCode: 200,
      data: returnObj,
    }, req, res);
  } catch (error) {
    return ErrorResponse(error, req, res);
  }
}

exports.getCommissionReportsMatch = async (req, res) => {
  try {
    const { userId } = req.params;
    let commissionReportData = [];

    const userData = await getUserById(userId, ["id", "roleName"]);

    let queryColumns = ``;

    switch (userData.roleName) {
      case (userRoleConstant.fairGameWallet):

      case (userRoleConstant.fairGameAdmin): {
        queryColumns = ` parentuser.fwPartnership`;
        break;
      }
      case (userRoleConstant.superAdmin): {
        queryColumns = ` parentuser.faPartnership + parentuser.fwPartnership `;
        break;
      }
      case (userRoleConstant.admin): {
        queryColumns = ` parentuser.saPartnership + parentuser.faPartnership + parentuser.fwPartnership `;
        break;
      }
      case (userRoleConstant.superMaster): {
        queryColumns = ` parentuser.aPartnership + parentuser.saPartnership + parentuser.faPartnership + parentuser.fwPartnership`;
        break;
      }
      case (userRoleConstant.master): {
        queryColumns = ` parentuser.smPartnership + parentuser.aPartnership + parentuser.saPartnership + parentuser.faPartnership + parentuser.fwPartnership `;
        break;
      }
      case (userRoleConstant.agent): {
        queryColumns = ` parentuser.mPartnership + parentuser.smPartnership + parentuser.aPartnership + parentuser.saPartnership + parentuser.faPartnership + parentuser.fwPartnership`;
        break;
      }
      case (userRoleConstant.user): {
        queryColumns = `parentuser.agPartnership + parentuser.mPartnership + parentuser.smPartnership + parentuser.aPartnership + parentuser.saPartnership + parentuser.faPartnership + parentuser.fwPartnership`;
        break;
      }
    }

    if (!userData) {
      return ErrorResponse({ statusCode: 404, message: { msg: "notFound", keys: { name: "User" } } }, req, res)
    }

    commissionReportData = await commissionReport(userId, req.query, queryColumns);

    return SuccessResponse({ statusCode: 200, data: commissionReportData, }, req, res);

  } catch (error) {
    logger.error({
      context: `error in get commission report`,
      error: error.message,
      stake: error.stack,
    });
    return ErrorResponse(error, req, res);
  }
}

exports.getCommissionBetPlaced = async (req, res) => {
  try {
    const { userId } = req.params;
    const { matchId } = req.query;
    let commissionReportData = [];

    const userData = await getUserById(userId, ["id", "roleName"]);

    let queryColumns = ``;

    switch (userData.roleName) {
      case (userRoleConstant.fairGameWallet):

      case (userRoleConstant.fairGameAdmin): {
        queryColumns = ` parentuser.fwPartnership`;
        break;
      }
      case (userRoleConstant.superAdmin): {
        queryColumns = ` parentuser.faPartnership + parentuser.fwPartnership `;
        break;
      }
      case (userRoleConstant.admin): {
        queryColumns = ` parentuser.saPartnership + parentuser.faPartnership + parentuser.fwPartnership `;
        break;
      }
      case (userRoleConstant.superMaster): {
        queryColumns = ` parentuser.aPartnership + parentuser.saPartnership + parentuser.faPartnership + parentuser.fwPartnership`;
        break;
      }
      case (userRoleConstant.master): {
        queryColumns = ` parentuser.smPartnership + parentuser.aPartnership + parentuser.saPartnership + parentuser.faPartnership + parentuser.fwPartnership `;
        break;
      }
      case (userRoleConstant.agent): {
        queryColumns = ` parentuser.mPartnership + parentuser.smPartnership + parentuser.aPartnership + parentuser.saPartnership + parentuser.faPartnership + parentuser.fwPartnership`;
        break;
      }
      case (userRoleConstant.user): {
        queryColumns = `parentuser.agPartnership + parentuser.mPartnership + parentuser.smPartnership + parentuser.aPartnership + parentuser.saPartnership + parentuser.faPartnership + parentuser.fwPartnership`;
        break;
      }
    }

    if (!userData) {
      return ErrorResponse({ statusCode: 404, message: { msg: "notFound", keys: { name: "User" } } }, req, res)
    }

    commissionReportData = await commissionMatchReport(userId, matchId, queryColumns);

    return SuccessResponse({ statusCode: 200, data: commissionReportData, }, req, res);

  } catch (error) {
    logger.error({
      context: `error in get commission report of bet places`,
      error: error.message,
      stake: error.stack,
    });
    return ErrorResponse(error, req, res);
  }
}

exports.getUserProfitLossForMatch = async (req, res, next) => {
  try {
    const { matchId } = req.params;
    const { id, roleName } = req.user;

    const users = await getFirstLevelChildUserWithPartnership(id, partnershipPrefixByRole[roleName] + "Partnership");

    const userProfitLossData = [];
    for (let element of users) {
      element.partnerShip = element[partnershipPrefixByRole[roleName] + "Partnership"];

      let currUserProfitLossData = {};
      let betsData = await getUserProfitLossForUpperLevel(element, matchId);
      currUserProfitLossData = {
        teamRateA: betsData?.[redisKeys.userTeamARate + matchId] ? -parseFloat(betsData?.[redisKeys.userTeamARate + matchId]).toFixed(2) : 0, teamRateB: betsData?.[redisKeys.userTeamBRate + matchId] ? -parseFloat(betsData?.[redisKeys.userTeamBRate + matchId]).toFixed(2) : 0, teamRateC: betsData?.[redisKeys.userTeamCRate + matchId] ? -parseFloat(betsData?.[redisKeys.userTeamCRate + matchId]).toFixed(2) : 0,
        percentTeamRateA: betsData?.[redisKeys.userTeamARate + matchId] ? parseFloat(parseFloat(parseFloat(betsData?.[redisKeys.userTeamARate + matchId]).toFixed(2)) * parseFloat(element.partnerShip) / 100).toFixed(2) : 0, percentTeamRateB: betsData?.[redisKeys.userTeamBRate + matchId] ? parseFloat(parseFloat(parseFloat(betsData?.[redisKeys.userTeamBRate + matchId]).toFixed(2)) * parseFloat(element.partnerShip) / 100).toFixed(2) : 0, percentTeamRateC: betsData?.[redisKeys.userTeamCRate + matchId] ? parseFloat(parseFloat(parseFloat(betsData?.[redisKeys.userTeamCRate + matchId]).toFixed(2)) * parseFloat(element.partnerShip) / 100).toFixed(2) : 0
      }

      currUserProfitLossData.userName = element?.userName;

      if (currUserProfitLossData.teamRateA || currUserProfitLossData.teamRateB || currUserProfitLossData.teamRateC) {
        userProfitLossData.push(currUserProfitLossData);
      }
    }

    return SuccessResponse(
      {
        statusCode: 200,
        data: userProfitLossData
      },
      req,
      res
    );
  } catch (error) {
    logger.error({
      error: `Error at get user profit loss match.`,
      stack: error.stack,
      message: error.message,
    });
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

exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const userData = await getUserDataWithUserBalance({ id: id });

    if (!userData) {
      return ErrorResponse(
        { statusCode: 400, message: { msg: "notFound", keys: { name: "User" } } },
        req,
        res
      );
    }
    if (parseFloat(userData?.userBal?.exposure || 0) != 0 || parseFloat(userData?.userBal?.currentBalance || 0) != 0 || parseFloat(userData?.userBal?.profitLoss || 0) != 0 || parseFloat(userData.creditRefrence || 0) != 0 || parseFloat(userData?.userBal?.totalCommission || 0) != 0) {
      return ErrorResponse(
        {
          statusCode: 400, message: {
            msg: "settleAccount", keys: {
              name: "your"
            }
          }
        },
        req,
        res
      );
    }

    const childUsers = await getChildUserBalanceAndData(id);

    for (let childData of childUsers) {
      if (parseFloat(childData?.exposure || 0) != 0 || parseFloat(childData?.currentBalance || 0) != 0 || parseFloat(childData?.profitLoss || 0) != 0 || parseFloat(childData.creditRefrence || 0) != 0 || parseFloat(childData?.totalCommission || 0) != 0) {
        return ErrorResponse(
          {
            statusCode: 400, message: {
              msg: "settleAccount", keys: {
                name: childData?.userName
              }
            }
          },
          req,
          res
        );
      }

      forceLogoutIfLogin(childData.id);

    }
    await softDeleteAllUsers(id);

    return SuccessResponse(
      {
        statusCode: 200,
        message: { "msg": "deleted", keys: { name: "User" } }
      },
      req,
      res
    );
  }
  catch (error) {
    logger.error({
      context: `error in delete user`,
      error: error.message,
      stake: error.stack,
    });
    return ErrorResponse(error, req, res);
  }
}

exports.checkOldPasswordData = async (req, res) => {
  try {
    const { id } = req.user;
    const { oldPassword } = req.body;
    let isOldPassword = await checkOldPassword(id, oldPassword);

    return SuccessResponse({ statusCode: 200, data: { isPasswordMatch: isOldPassword } }, req, res);

  } catch (error) {
    logger.error({ message: "Error in checking old password.", stack: error?.stack, context: error?.message });
    return ErrorResponse(error, req, res);
  }
}

exports.checkMatchLock=async (req,res)=>{
  try {
    const { matchId } = req.query;
    const { id } = req.user;

    const userPartnershipData = await getUserRedisKey(id, "partnerShips");
    const userPartnership = JSON.parse(userPartnershipData);
    let parentKeys = [];
    Object.values(partnershipPrefixByRole)?.forEach((item) => {
      if (userPartnership[`${item}PartnershipId`] && userPartnership[`${item}PartnershipId`] != id) {
        parentKeys.push(userPartnership[`${item}PartnershipId`]);
      }
    });

    let blockObj = {
      match: {
        parentBlock: false,
        selfBlock: false
      },
      session: {
        parentBlock: false,
        selfBlock: false
      }
    };

    blockObj.match.parentBlock = !!(await getUserMatchLock({ userId: id, matchId, blockBy: In(parentKeys), sessionLock: false }));
    blockObj.match.selfBlock = !!(await getUserMatchLock({ userId: id, matchId, blockBy: id, sessionLock: false }));

    blockObj.session.parentBlock = !!(await getUserMatchLock({ userId: id, matchId, blockBy: In(parentKeys), sessionLock: true }));
    blockObj.session.selfBlock = !!(await getUserMatchLock({ userId: id, matchId, blockBy: id, sessionLock: true }));

    return SuccessResponse({ statusCode: 200, data: blockObj }, req, res);

  } catch (error) {
    logger.error({ message: "Error in check match lock.", stack: error?.stack, context: error?.message });
    return ErrorResponse(error, req, res);
  }
}