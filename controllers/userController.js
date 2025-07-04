const { userRoleConstant, transType, defaultButtonValue, buttonType, walletDescription, fileType, socketData, report, matchWiseBlockType, betResultStatus, betType, sessiontButtonValue, oldBetFairDomain, partnershipPrefixByRole, uplinePartnerShipForAllUsers, casinoButtonValue, transactionType, permissions } = require('../config/contants');
const { getUserById, addUser, getUserByUserName, updateUser, getUser, getChildUser, getUsers, getFirstLevelChildUser, getChildsWithMergedUser, userBlockUnblock, betBlockUnblock, getCreditRefrence, getUserBalance, getChildsWithOnlyUserRole, getUserMatchLock, addUserMatchLock, deleteUserMatchLock, getMatchLockAllChild, getUserMarketLock, getAllUsersMarket, insertUserMarketLock, deleteUserMarketLock, getMarketLockAllChild, getUsersWithTotalUsersBalanceData, getGameLockForDetails, isAllChildDeactive, getParentsWithBalance, getChildUserBalanceSum, getFirstLevelChildUserWithPartnership, getUserDataWithUserBalance, getChildUserBalanceAndData, softDeleteAllUsers, getAllUsers, getUserListProcedure, getUserTotalBalanceProcedure } = require('../services/userService');
const { ErrorResponse, SuccessResponse } = require('../utils/response');
const { insertTransactions } = require('../services/transactionService');
const { insertButton } = require('../services/buttonService');
const { getPlacedBetTotalLossAmount } = require('../services/betPlacedService')
const bcrypt = require("bcryptjs");
const lodash = require('lodash');
const crypto = require('crypto');
const { forceLogoutUser, forceLogoutIfLogin, getUserProfitLossForUpperLevel, transactionPasswordAttempts, childIdquery, loginDemoUser } = require("../services/commonService");
const { getUserBalanceDataByUserId, getAllChildProfitLossSum, addInitialUserBalance, updateUserBalanceData } = require('../services/userBalanceService');
const { ILike, Not, In } = require('typeorm');
const FileGenerate = require("../utils/generateFile");
const { sendMessageToUser } = require('../sockets/socketManager');
const { hasUserInCache, updateUserDataRedis, getUserRedisKey } = require('../services/redis/commonfunction');
const { commissionReport, commissionMatchReport } = require('../services/commissionService');
const { logger } = require('../config/logger');
const bot = require('../config/telegramBot');
const { getAccessUserByUserName, getAccessUserWithPermission, getAccessUserById, updateAccessUser } = require('../services/accessUserService');
const { deleteAuthenticator } = require('../services/authService');

exports.getProfile = async (req, res) => {
  let reqUser = req.user || {};
  let userId = reqUser?.id
  if (req.query?.userId) {
    userId = req.query.userId;
  }
  let where = {
    id: userId,
  };
  let user;
  if (reqUser?.isAccessUser) {
    const mainUser = await getUser({ id: req.user.id }, ["roleName"])
    const userBal = await getUserBalanceDataByUserId(req.user.id)
    user = await getAccessUserWithPermission({ id: reqUser?.childId });
    if (user) {
      user.roleName = mainUser?.roleName;
      user.userBal = userBal;
    }
  }
  else {
    user = await getUserDataWithUserBalance(where);
  }
  let response = lodash.omit(user, ["password", "transPassword"])
  return SuccessResponse({ statusCode: 200, data: response }, req, res)
}

exports.isUserExist = async (req, res) => {
  let { userName } = req.query;

  const isUserExist = await getUserByUserName(userName);

  return SuccessResponse({ statusCode: 200, data: { isUserExist: Boolean(isUserExist) } }, req, res);
}

exports.createUser = async (req, res) => {
  try {
    const { userName, fullName, password, phoneNumber, city, roleName, myPartnership, createdBy, creditRefrence, remark, exposureLimit, maxBetLimit, minBetLimit, sessionCommission, matchComissionType, matchCommission, delayTime } = req.body;
    let reqUser = req.user || {};
    const creator = await getUserById(reqUser.id || createdBy);

    if (!creator)
      return ErrorResponse({ statusCode: 400, message: { msg: "notFound", keys: { name: "Login user" } } }, req, res);

    if (!checkUserCreationHierarchy(creator, roleName))
      return ErrorResponse({ statusCode: 400, message: { msg: "user.InvalidHierarchy" } }, req, res);

    creator.myPartnership = parseInt(myPartnership);

    const upperCaseUserName = userName?.toUpperCase();
    const userExist = (!!(await getUserByUserName(upperCaseUserName)) || !!(await getAccessUserByUserName(upperCaseUserName)));
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
      betBlockedBy: creator.betBlockedBy,
      userBlockedBy: creator.userBlockedBy,
      createBy: creator.id,
      creditRefrence: creditRefrence ? parseFloat(creditRefrence) : 0,
      exposureLimit: exposureLimit || creator.exposureLimit,
      maxBetLimit: maxBetLimit ?? creator.maxBetLimit,
      minBetLimit: minBetLimit ?? creator.minBetLimit,
      matchComissionType,
      sessionCommission,
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
    let { fullName, phoneNumber, city, id, remark, sessionCommission, matchComissionType, matchCommission } = req.body;
    let reqUser = req.user || {}
    let updateUser = await getUser({ id, createBy: reqUser.id }, ["id", "createBy", "fullName", "phoneNumber", "city", "sessionCommission", "matchComissionType", "matchCommission"]);
    if (!updateUser) return ErrorResponse({ statusCode: 400, message: { msg: "notFound", keys: { name: "User" } } }, req, res);

    updateUser.fullName = fullName ?? updateUser.fullName;
    updateUser.phoneNumber = phoneNumber ?? updateUser.phoneNumber;
    updateUser.city = city || updateUser.city;
    updateUser.sessionCommission = sessionCommission ?? updateUser.sessionCommission;
    updateUser.matchComissionType = matchComissionType;
    updateUser.matchCommission = matchCommission ?? updateUser.matchCommission;
    updateUser.remark = remark || updateUser.remark;
    updateUser = await addUser(updateUser);

    let response = lodash.pick(updateUser, ["fullName", "sessionCommission", "phoneNumber", "city", "matchComissionType", "matchCommission"])
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
const checkOldPassword = async (userId, oldPassword, isAccessUser = false) => {
  let user;
  if (isAccessUser) {
    user = await getAccessUserById(userId, ["password"]);
  }
  else {
    // Retrieve user's password from the database
    user = await getUserById(userId, ["password"]);
  }
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
const checkTransactionPassword = async (userId, oldTransactionPass, isAccessUser) => {
  // Retrieve user's transaction password from the database
  const user = isAccessUser ? (await getAccessUserById(userId, ["transPassword", "id"])) : (await getUserById(userId, ["transPassword", "id"]));
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
    const isAccessUser = req.user.isAccessUser;
    // If user is changing its password after login or logging in for the first time
    if (oldPassword && !transactionPassword) {
      // Check if the old password is correct
      const userId = isAccessUser ? req.user.childId : req.user.id;
      const isPasswordMatch = await checkOldPassword(userId, oldPassword, isAccessUser);

      if (!isPasswordMatch) {
        return ErrorResponse(
          {
            statusCode: 403,
            message: { msg: "auth.invalidPass", keys: { type: "old" } },
          }, req, res
        );
      }

      // Retrieve additional user information
      const user = isAccessUser ? await getAccessUserById(userId, ["loginAt", "id"]) : await getUserById(userId, ["loginAt", "roleName"]);

      // Update loginAt and generate new transaction password if conditions are met
      if (user.loginAt == null && user.roleName !== userRoleConstant.user) {
        const generatedTransPass = generateTransactionPass();
        if (isAccessUser) {
          await updateAccessUser({ id: userId }, {
            loginAt: new Date(),
            transPassword: bcrypt.hashSync(generatedTransPass, 10),
            password,
          });
        }
        else {
          await updateUser(userId, {
            loginAt: new Date(),
            transPassword: bcrypt.hashSync(generatedTransPass, 10),
            password,
          });
        }
        await forceLogoutUser(userId, true, isAccessUser, isAccessUser ? req.user.id : null);
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
      if (isAccessUser) {
        await updateAccessUser({ id: userId }, { loginAt: new Date(), password });
      }
      else {
        await updateUser(userId, { loginAt: new Date(), password });
      }
      await forceLogoutUser(userId, false, isAccessUser, isAccessUser ? req.user.id : null);

      return SuccessResponse(
        {
          statusCode: 200,
          message: { msg: "auth.passwordChanged" },
        },
        req,
        res
      );
    }

    if (isAccessUser && !req.user.permission?.[permissions.userPasswordChange]) {
      return ErrorResponse(
        {
          statusCode: 403,
          message: { msg: "auth.unauthorizeRole" },
        },
        req,
        res
      );
    }
    // if password is changed by parent of users
    const userId = req.body.userId;
    const loginUserId = isAccessUser ? req.user.childId : req.user.id;

    const user = isAccessUser ? (await getAccessUserById(loginUserId, ["transPassword", "id", "transactionPasswordAttempts", "createBy", "mainParentId", "parentId"])) : await getUserById(loginUserId, ["transPassword", "id", "transactionPasswordAttempts", "createBy", "superParentId"]);

    const isPasswordMatch = await checkTransactionPassword(
      user?.id,
      transactionPassword,
      isAccessUser
    );

    if (!isPasswordMatch) {

      const currDomain = `${process.env.GRPC_URL}`;

      if (currDomain != oldBetFairDomain) {
        await transactionPasswordAttempts(user, isAccessUser);
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
      if (isAccessUser) {
        await updateAccessUser({ id: loginUserId }, { transactionPasswordAttempts: 0 });
      } else {
        await updateUser(user.id, { transactionPasswordAttempts: 0 });
      }
    }

    if (!userId) {
      if (isAccessUser) {
        await updateAccessUser({ id: loginUserId }, { password });
      }
      else {
        await updateUser(loginUserId, {
          password,
        });
      }
      await forceLogoutUser(loginUserId, false, isAccessUser, isAccessUser ? req.user.id : null);
    } else {
      // Update loginAt, password, and reset transactionPassword, remvoe auth when change password by parent
      await updateUser(userId, {
        loginAt: null, password, transPassword: null, isAuthenticatorEnable: false
      });
      deleteAuthenticator({ userId: userId });
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

    if (parseFloat(amount) > loginUser.exposureLimit)
      return ErrorResponse({ statusCode: 400, message: { msg: "user.InvalidExposureLimit", keys: { amount: loginUser.exposureLimit } } }, req, res);


    let user = await getUser({ id: userId, createBy: reqUser.id }, ["id", "exposureLimit", "roleName"]);
    if (!user) return ErrorResponse({ statusCode: 400, message: { msg: "notFound", keys: { name: "User" } } }, req, res);


    amount = parseInt(amount);
    user.exposureLimit = amount
    let childUsers = await getChildUser(user.id)


    childUsers.map(async childObj => {
      let childUser = await getUserById(childObj.id);
      if (childUser.exposureLimit > amount || childUser.exposureLimit == 0) {
        await updateUser(childUser.id, { exposureLimit: amount });
      }
    });
    await updateUser(user.id, { exposureLimit: amount });
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
    const { type, userId, roleName, ...apiQuery } = req.query;
    let userRole = roleName || reqUser?.roleName;
    let where = {
      createBy: reqUser?.isAccessUser ? reqUser.id : (userId || reqUser.id),
      roleName: userRole
    };

    let partnershipCol = [...uplinePartnerShipForAllUsers[userRole], partnershipPrefixByRole[userRole]].map((item) => {
      return item + "Partnership";
    });
    let data = (await getUserListProcedure(where.createBy, partnershipCol, where.roleName, apiQuery?.limit, apiQuery?.page, apiQuery?.keyword, apiQuery?.userBlock?.slice(2), apiQuery?.betBlock?.slice(2), apiQuery.orVal ? true : null))?.[0]?.fetchuserlist || [];

    const domainUrl = process.env.GRPC_URL;

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
        ...(domainUrl == oldBetFairDomain ? [{ excelHeader: "S Com %", dbKey: "sessionCommission" }] : []),
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
      const total = data?.list?.reduce((prev, curr) => {
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
      data?.list?.unshift(total);

      const fileGenerate = new FileGenerate(type);
      const file = await fileGenerate.generateReport(data?.list, header, "Client List Report");
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


    return SuccessResponse(
      {
        statusCode: 200,
        message: { msg: "user.userList" },
        data: data,
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
      createBy: reqUser?.isAccessUser ? reqUser.id : (userId || reqUser.id),
      roleName: userRole
    };

    const totalBalance = await getUserTotalBalanceProcedure(where.createBy, where.roleName, apiQuery?.userBlock?.slice(2), apiQuery?.betBlock?.slice(2), apiQuery.orVal ? true : null)

    return SuccessResponse(
      {
        statusCode: 200,
        data: totalBalance?.[0]?.getusertotalbalance,
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
    let users = await getUsers(where, ["id", "userName", "userBlock", "betBlock"])
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
    await updateUserBalanceData(user.id, { profitLoss: previousCreditReference - amount, balance: 0 });
    // let newUserBalanceData = await updateUserBalanceByUserId(user.id, { profitLoss });
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

    await insertTransactions(transactionArray);
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
    const { id: loginId, roleName, isAccessUser, permission } = req.user;

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
    if (blockingUserDetail?.userBlock != userBlock && (!isAccessUser || (isAccessUser && permission[permissions.userLock]))) {
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
    if (blockingUserDetail?.betBlock != betBlock && (!isAccessUser || (isAccessUser && permission[permissions.betLock]))) {
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
    const { userId, matchId, type, block, operationToAll, roleName } = req.body;
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
  let { matchId, betId, sessionType } = req.query;
  let childUsers = await getMarketLockAllChild({ createBy: reqUser.id, id: Not(reqUser.id), matchId, betId, sessionType }, ['user.id AS id',
    'user.userName AS "userName"',
  ]);
  return SuccessResponse({
    statusCode: 200,
    data: childUsers,
  }, req, res);
}
exports.userMarketLock = async (req, res) => {
  try {
    const { userId, matchId, blockType, betId, sessionType, isLock, operationToAll } = req.body;
    let reqUser = req.user || {};
    let roleName = reqUser.roleName;

    if (!operationToAll) {
      let checkMarket = await getUserMarketLock({ userId, matchId, betId, createBy: reqUser.id, sessionType }, ['id'])
      if (isLock && checkMarket) {
        return ErrorResponse(
          { statusCode: 400, message: { msg: "user.alreadyLocked" } },
          req,
          res
        );
      }
      if (!isLock && !checkMarket) {
        return ErrorResponse(
          { statusCode: 400, message: { msg: "user.notLocked" } },
          req,
          res
        );
      }
    }

    let userIds;
    if (operationToAll) {
      let checkAlreadyLock = await getAllUsersMarket({ matchId, betId, createBy: reqUser.id, sessionType }, ['userId']);
      userIds = checkAlreadyLock.map(item => item.userId);
    }
    const childUsers = roleName == userRoleConstant.fairGameWallet ? await getAllUsers({}, ["id", "userName"]) : operationToAll ? await getChildsWithMergedUser(reqUser.id, userIds)
      : await getChildsWithOnlyUserRole(userId);

    const allChildUserIds = Array.from(
      new Set([
        ...childUsers.map((obj) => obj.id),
        ...(operationToAll ? [] : [userId]),
      ])
    );

    if (isLock) {
      let userMarketLockData = allChildUserIds.map((obj) => {
        return {
          userId: obj,
          matchId,
          createBy: reqUser.id,
          betId,
          sessionType,
          blockType
        }

      });
      await insertUserMarketLock(userMarketLockData);
    } else {
      await deleteUserMarketLock({ userId: In(allChildUserIds), matchId, createBy: reqUser.id, ...(betId ? { betId } : {}), ...(sessionType ? { sessionType } : {}) });
    }

    return SuccessResponse({
      statusCode: 200,
      message: { msg: "updated", keys: { name: "User" } },
    }, req, res);
  } catch (error) {
    logger.error({
      error: `Error while locking the user for specific market.`,
      stack: error.stack,
      message: error.message,
    });
    return ErrorResponse(error, req, res);
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

    let markets = {};
    const userProfitLossData = [];
    for (let element of users) {
      element.partnerShip = element[partnershipPrefixByRole[roleName] + "Partnership"];

      let currUserProfitLossData = {};
      let betsData = await getUserProfitLossForUpperLevel(element, matchId);
      Object.keys(betsData || {}).forEach((item) => {
        markets[item] = { betId: item, name: betsData[item]?.name };
        Object.keys(betsData[item].teams || {})?.forEach((teams) => {
          betsData[item].teams[teams].pl = {
            rate: betsData[item].teams?.[teams]?.pl,
            percent: parseFloat(parseFloat(parseFloat(betsData[item].teams?.[teams]?.pl).toFixed(2)) * parseFloat(element.partnerShip) / 100).toFixed(2)
          }
        })
      });
      // currUserProfitLossData = {
      //   teamRateA: betsData?.[redisKeys.userTeamARate + matchId] ? -parseFloat(betsData?.[redisKeys.userTeamARate + matchId]).toFixed(2) : 0, teamRateB: betsData?.[redisKeys.userTeamBRate + matchId] ? -parseFloat(betsData?.[redisKeys.userTeamBRate + matchId]).toFixed(2) : 0, teamRateC: betsData?.[redisKeys.userTeamCRate + matchId] ? -parseFloat(betsData?.[redisKeys.userTeamCRate + matchId]).toFixed(2) : 0,
      //   percentTeamRateA: betsData?.[redisKeys.userTeamARate + matchId] ? parseFloat(parseFloat(parseFloat(betsData?.[redisKeys.userTeamARate + matchId]).toFixed(2)) * parseFloat(element.partnerShip) / 100).toFixed(2) : 0, percentTeamRateB: betsData?.[redisKeys.userTeamBRate + matchId] ? parseFloat(parseFloat(parseFloat(betsData?.[redisKeys.userTeamBRate + matchId]).toFixed(2)) * parseFloat(element.partnerShip) / 100).toFixed(2) : 0, percentTeamRateC: betsData?.[redisKeys.userTeamCRate + matchId] ? parseFloat(parseFloat(parseFloat(betsData?.[redisKeys.userTeamCRate + matchId]).toFixed(2)) * parseFloat(element.partnerShip) / 100).toFixed(2) : 0
      // }

      currUserProfitLossData.userName = element?.userName;
      currUserProfitLossData.profitLoss = betsData;

      if (Object.keys(betsData || {}).length > 0) {
        userProfitLossData.push(currUserProfitLossData);
      }
    }

    return SuccessResponse(
      {
        statusCode: 200,
        data: { profitLoss: userProfitLossData, markets: Object.values(markets) }
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

exports.checkMatchLock = async (req, res) => {
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

exports.telegramBot = async (req, res) => {
  try {
    if (req.body) {
      // Process update from Telegram
      bot.processUpdate(req.body);
    }
    // Always respond with 200 OK to Telegram
    res.sendStatus(200);

  } catch (err) {
    return ErrorResponse(err, req, res);
  }
};