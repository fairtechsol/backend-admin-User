const { userRoleConstant, transType, defaultButtonValue, buttonType, walletDescription, fileType, socketData, report, matchWiseBlockType, betResultStatus, betType, sessiontButtonValue, oldBetFairDomain } = require('../config/contants');
const { getUserById, addUser, getUserByUserName, updateUser, getUser, getChildUser, getUsers, getFirstLevelChildUser, getUsersWithUserBalance, userBlockUnblock, betBlockUnblock, getUsersWithUsersBalanceData, getCreditRefrence, getUserBalance, getChildsWithOnlyUserRole, getUserMatchLock, addUserMatchLock, deleteUserMatchLock, getMatchLockAllChild, getUsersWithTotalUsersBalanceData, getGameLockForDetails, isAllChildDeactive, getParentsWithBalance, getChildUserBalanceSum, } = require('../services/userService');
const { ErrorResponse, SuccessResponse } = require('../utils/response');
const { insertTransactions } = require('../services/transactionService');
const { insertButton } = require('../services/buttonService');
const { getTotalProfitLoss, findAllPlacedBet, getPlacedBetTotalLossAmount } = require('../services/betPlacedService')
const bcrypt = require("bcryptjs");
const lodash = require('lodash');
const { forceLogoutUser, profitLossPercentCol } = require("../services/commonService");
const { getUserBalanceDataByUserId, getAllChildCurrentBalanceSum, getAllChildProfitLossSum, updateUserBalanceByUserId, addInitialUserBalance } = require('../services/userBalanceService');
const { ILike, Not, In } = require('typeorm');
const FileGenerate = require("../utils/generateFile");
const { sendMessageToUser } = require('../sockets/socketManager');
const { hasUserInCache, updateUserDataRedis } = require('../services/redis/commonfunction');
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
    let { userName, fullName, password, phoneNumber, city, roleName, myPartnership, createdBy, creditRefrence, remark, exposureLimit, maxBetLimit, minBetLimit, sessionCommission, matchComissionType, matchCommission } = req.body;
    let reqUser = req.user || {};
    let creator = await getUserById(reqUser.id || createdBy);
    if (!creator) return ErrorResponse({ statusCode: 400, message: { msg: "notFound", keys: { name: "Login user" } } }, req, res);

    if (!checkUserCreationHierarchy(creator, roleName))
      return ErrorResponse({ statusCode: 400, message: { msg: "user.InvalidHierarchy" } }, req, res);
    creator.myPartnership = parseInt(myPartnership)
    userName = userName.toUpperCase();
    let userExist = await getUserByUserName(userName);
    if (userExist) return ErrorResponse({ statusCode: 400, message: { msg: "user.userExist" } }, req, res);
    if (creator.roleName != userRoleConstant.fairGameWallet) {
      if (exposureLimit && exposureLimit > creator.exposureLimit)
        return ErrorResponse({ statusCode: 400, message: { msg: "user.InvalidExposureLimit" } }, req, res);
    }
    password = await bcrypt.hash(
      password,
      process.env.BCRYPTSALT || 10
    );

    creditRefrence = creditRefrence ? parseFloat(creditRefrence) : 0;
    exposureLimit = exposureLimit ? exposureLimit : creator.exposureLimit;
    maxBetLimit = maxBetLimit ?? creator.maxBetLimit;
    minBetLimit = minBetLimit ?? creator.minBetLimit;
    let userData = {
      userName,
      fullName,
      password,
      phoneNumber,
      city,
      roleName,
      userBlock: creator.userBlock,
      betBlock: creator.betBlock,
      createBy: creator.id,
      creditRefrence: creditRefrence,
      exposureLimit: exposureLimit,
      maxBetLimit: maxBetLimit,
      minBetLimit: minBetLimit,
      sessionCommission,
      matchComissionType,
      matchCommission,
      superParentType: creator.superParentType,
      superParentId: creator.superParentId,
      remark: remark
    }
    let partnerships = await calculatePartnership(userData, creator)
    userData = { ...userData, ...partnerships };
    let insertUser = await addUser(userData);
    let updateUser = {}
    if (creditRefrence) {
      updateUser = await addUser({
        id: creator.id,
        downLevelCreditRefrence: creditRefrence + parseInt(creator.downLevelCreditRefrence)
      })
    }
    let transactionArray = [{
      actionBy: insertUser.createBy,
      searchId: insertUser.createBy,
      userId: insertUser.id,
      amount: 0,
      transType: transType.add,
      closingBalance: insertUser.creditRefrence,
      description: walletDescription.userCreate
    }]
    if (insertUser.createdBy != insertUser.id) {
      transactionArray.push({
        actionBy: insertUser.createBy,
        searchId: insertUser.id,
        userId: insertUser.id,
        amount: 0,
        transType: transType.withDraw,
        closingBalance: insertUser.creditRefrence,
        description: walletDescription.userCreate
      });
    }

    const transactioninserted = await insertTransactions(transactionArray);
    let insertUserBalanceData = {
      currentBalance: 0,
      userId: insertUser.id,
      profitLoss: -creditRefrence,
      myProfitLoss: 0,
      downLevelBalance: 0,
      exposure: 0
    }
    insertUserBalanceData = await addInitialUserBalance(insertUserBalanceData)
    if (insertUser.roleName == userRoleConstant.user) {
      let buttonValue = [
        {
          type: buttonType.MATCH,
          value: defaultButtonValue.buttons,
          createBy: insertUser.id
        },
        {
          type: buttonType.SESSION,
          value: sessiontButtonValue.buttons,
          createBy: insertUser.id
        }
      ]
      let insertedButton = await insertButton(buttonValue)
    }
    let response = lodash.omit(insertUser, ["password", "transPassword"])
    return SuccessResponse({ statusCode: 200, message: { msg: "created", keys: { type: "User" } }, data: response }, req, res)
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
    updateUser.sessionCommission = sessionCommission || updateUser.sessionCommission;
    updateUser.matchComissionType = matchComissionType || updateUser.matchComissionType;
    updateUser.matchCommission = matchCommission || updateUser.matchCommission;
    updateUser.remark= remark || updateUser.remark;
    updateUser = await addUser(updateUser);

    let response = lodash.pick(updateUser, ["fullName", "phoneNumber", "city", "sessionCommission", "matchComissionType", "matchCommission"])
    return SuccessResponse({ statusCode: 200, message: { msg: "updated", keys: { name: "User" } }, data: response }, req, res)
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

const generateTransactionPass = () => {
  const randomNumber = Math.floor(100000 + Math.random() * 900000);
  return `${randomNumber}`;
};

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


    const isPasswordMatch = await checkTransactionPassword(
      req.user.id,
      transactionPassword
    );



    if (!isPasswordMatch) {
      return ErrorResponse(
        {
          statusCode: 403,
          message: { msg: "auth.invalidPass", keys: { type: "transaction" } },
        },
        req,
        res
      );
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
    let { amount, userId, transPassword } = req.body

    let reqUser = req.user || {}
    let loginUser = await getUserById(reqUser.id, ["id", "exposureLimit", "roleName"]);
    if (!loginUser) return ErrorResponse({ statusCode: 400, message: { msg: "notFound", keys: { name: "Login user" } } }, req, res);

    let user = await getUser({ id: userId, createBy: reqUser.id }, ["id", "exposureLimit", "roleName"]);
    if (!user) return ErrorResponse({ statusCode: 400, message: { msg: "notFound", keys: { name: "User" } } }, req, res);

    
    amount = parseInt(amount);
    user.exposureLimit = amount
    let childUsers = await getChildUser(user.id)


    childUsers.map(async childObj => {
      let childUser = await getUserById(childObj.id);
      if (childUser.exposureLimit > amount || childUser.exposureLimit == 0) {
        childUser.exposureLimit = amount;
        await addUser(childUser);
      }
    });
    await addUser(user)
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
          element['upLinePartnership'] =  partnerShips;
        }

        if (element?.roleName != userRoleConstant.user && domainUrl != oldBetFairDomain) {
          element.exposureLimit="NA";
        }
        return element;
      })
    );

    if (type) {
      const header = [
        { excelHeader: "User Name", dbKey: "userName" },
        { excelHeader: "Role", dbKey: "roleName" },
        { excelHeader: "Credit Ref", dbKey: "creditRefrence" },
        { excelHeader: "Balance", dbKey: "balance" },
        { excelHeader: "Client P/L", dbKey: "profit_loss" },
        { excelHeader: "% P/L", dbKey: "percentProfitLoss" },
        { excelHeader: "Comission", dbKey: "commission" },
        { excelHeader: "Exposure", dbKey: "exposure" },
        { excelHeader: "Available Balance", dbKey: "availableBalance" },
        { excelHeader: "UL", dbKey: "userBlock" },
        { excelHeader: "BL", dbKey: "betBlock" },
        { excelHeader: "S Com %", dbKey: "sessionCommission" },
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

      const fileGenerate = new FileGenerate(type);
      const file = await fileGenerate.generateReport(data, header);
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

    let queryColumns = `SUM(user.creditRefrence) as "totalCreditReference", SUM(UB.profitLoss) as profitSum,SUM(UB.downLevelBalance) as "downLevelBalance", SUM(UB.currentBalance) as "availableBalance",SUM(UB.exposure) as "totalExposure",SUM(UB.totalCommission) as totalCommission`;

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

    const totalBalance = await getUsersWithTotalUsersBalanceData(where, apiQuery, queryColumns);

    let childUsersBalances = await getChildUserBalanceSum(userId || reqUser.id);

    totalBalance.currBalance = childUsersBalances?.[0]?.balance;
    totalBalance.availableBalance = parseFloat(totalBalance.availableBalance||0) - parseFloat(totalBalance.totalExposure||0);

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
    let { userName, createdBy } = req.query
    if (!userName || userName.length < 0) {
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

    let users = await getUsers(where, ["id", "userName"])
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
    const firstLevelChildBalanceData = getAllChildProfitLossSum(firstLevelChildUserIds);

    // Fetch balance data for all child users
    const allChildBalanceData = getChildUserBalanceSum(userId);

    // Wait for all promises to settle
    const [userBalance, firstLevelChildBalance, allChildBalance] = await Promise.allSettled([userBalanceData, firstLevelChildBalanceData, allChildBalanceData]);

    // Calculate various balance-related metrics
    const response = {
      userCreditReference: parseFloat(loginUser?.creditRefrence),
      downLevelOccupyBalance: parseFloat(allChildBalance?.value?.balance || 0),
      downLevelCreditReference: loginUser?.downLevelCreditRefrence,
      availableBalance: parseFloat(userBalance?.value?.currentBalance || 0),
      totalMasterBalance: parseFloat(userBalance?.value?.currentBalance || 0) + parseFloat(allChildBalance.value.balance || 0),
      upperLevelBalance: parseFloat(loginUser?.creditRefrence) - parseFloat(userBalance?.value?.currentBalance || 0) + parseFloat(allChildBalance?.value?.balance || 0),
      downLevelProfitLoss: -firstLevelChildBalance?.value?.firstlevelchildsprofitlosssum || 0,
      availableBalanceWithProfitLoss: ((parseFloat(userBalance?.value?.currentBalance || 0) + parseFloat(userBalance?.value?.myProfitLoss || 0))),
      profitLoss: userBalance?.value?.myProfitLoss || 0
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
    const { id: loginId } = req.user;



    // Fetch user details of the current user, including block information
    const userDetails = await getUserById(loginId, ["userBlock", "betBlock"]);

    // Fetch details of the user who is performing the block/unblock operation,
    // including the hierarchy and block information
    const blockingUserDetail = await getUserById(userId, [
      "createBy",
      "userBlock",
      "betBlock",
    ]);

    // Check if the current user is already blocked
    if (userDetails?.userBlock) {
      throw { msg: "user.userBlockError" };
    }

    // Check if the block type is 'betBlock' and the user is already bet-blocked
    if (!betBlock && userDetails?.betBlock) {
      throw { msg: "user.betBlockError" };
    }

    // Check if the user performing the block/unblock operation has the right access
    if (blockingUserDetail?.createBy != loginId) {
      return ErrorResponse(
        {
          statusCode: 403,
          message: { msg: "user.blockCantAccess" },
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
    queryColumns = await profitLossPercentCol(user, queryColumns);
    totalLoss = `(Sum(CASE WHEN placeBet.result = 'LOSS' then ROUND(placeBet.lossAmount / 100 * ${queryColumns}, 2) ELSE 0 END) - Sum(CASE WHEN placeBet.result = 'WIN' then ROUND(placeBet.winAmount / 100 * ${queryColumns}, 2) ELSE 0 END)) as "totalLoss"`;

    if (user && user.roleName == userRoleConstant.user) {
      where.createBy = In([userId])
      totalLoss = `(Sum(CASE WHEN placeBet.result = 'WIN' then ROUND(placeBet.winAmount / 100 * ${queryColumns}, 2) ELSE 0 END) - Sum(CASE WHEN placeBet.result = 'LOSS' then ROUND(placeBet.lossAmount / 100 * ${queryColumns}, 2) ELSE 0 END)) as "totalLoss"`;

    } else {
      let childsId = await getChildsWithOnlyUserRole(req.user.id);
      childsId = childsId.map(item => item.id)
      if (!childsId.length) {
        return SuccessResponse({
          statusCode: 200, message: { msg: "fetched", keys: { type: "Profit loss" } }, data: {
            result: []
          }
        }, req, res)
      }
      where.createBy = In(childsId)
    }
    const result = await getTotalProfitLoss(where, startDate, endDate, totalLoss)
    return SuccessResponse(
      {
        statusCode: 200, message: { msg: "fetched", keys: { type: "Total profit loss" } }, data: { result, },
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
  let childUsers = await getMatchLockAllChild(reqUser.id);
  return SuccessResponse({
    statusCode: 200,
    data: childUsers,
  }, req, res);
}

exports.userMatchLock = async (req, res) => {
  try {
    let { userId, matchId, type, block, operationToAll, isFromWallet = false } = req.body;
    let reqUser = req.user;
    if(isFromWallet){
      reqUser.id = userId;
    }
    if (operationToAll) {
      userId = reqUser.id;
    }
    let childUsers = await getChildUser(userId);
    let allChildUserIds = childUsers.map(obj => obj.id);
    if (!operationToAll) {
      allChildUserIds.push(userId);
    }
    if(isFromWallet){
      if(allChildUserIds.includes(userId)){
        allChildUserIds.push(userId);
      }
    }

    let returnData;
    for (let i = 0; i < allChildUserIds.length; i++) {
      let blockUserId = allChildUserIds[i];
      returnData = await userBlockUnlockMatch(blockUserId, matchId, reqUser, block, type, isFromWallet);
    }
    let allChildMatchDeactive = true;
    let allChildSessionDeactive = true;
    let allDeactive = await isAllChildDeactive({ createBy: reqUser.id, id: Not(reqUser.id) }, ['userMatchLock.id'], matchId);
    allDeactive.map(ob => {
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
      message: { msg: "updated", keys: { name: "User" } },
      data: { returnData, allChildMatchDeactive, allChildSessionDeactive },
    }, req, res);
  } catch (error) {
    return ErrorResponse(error, req, res);
  }

  async function userBlockUnlockMatch(userId, matchId, reqUser, block, type, isFromWallet) {
    let userAlreadyBlockExit = await getUserMatchLock({ userId, matchId, blockBy: reqUser.id, isWalletLock: isFromWallet });
    if (!userAlreadyBlockExit && !block) {
      throw { msg: "notUnblockFirst" };
    }

    if (!userAlreadyBlockExit && block) {
      let object = {
        userId, matchId,
        blockBy: reqUser.id,
        isWalletLock: isFromWallet
      };
      if (type == matchWiseBlockType.match) {
        object.matchLock = true;
      } else {
        object.sessionLock = true;
      }
      addUserMatchLock(object);
      return object;
    }

    if (type == matchWiseBlockType.match) {
      userAlreadyBlockExit.matchLock = block;
    } else {
      userAlreadyBlockExit.sessionLock = block;
    }

    if (!block) {
      if (!(userAlreadyBlockExit.matchLock || userAlreadyBlockExit.sessionLock)) {
        deleteUserMatchLock({ id: userAlreadyBlockExit.id });
        return userAlreadyBlockExit;
      }
    }

    addUserMatchLock(userAlreadyBlockExit);
    return userAlreadyBlockExit;
  }
}

exports.checkChildDeactivate = async (req, res) => {
  const { matchId } = req.query;
  let reqUser = req.user;
  let allChildMatchDeactive = true;
  let allChildSessionDeactive = true;
  let allDeactive = await isAllChildDeactive({ createBy: reqUser.id, id: Not(reqUser.id) }, ['userMatchLock.id', 'userMatchLock.matchLock', 'userMatchLock.sessionLock'], matchId);
  allDeactive.map(ob => {
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

    const userData = await getUserById(userId, ["id"]);
    if (!userData) {
      return ErrorResponse({ statusCode: 404, message: { msg: "notFound", keys: { name: "User" } } }, req, res)
    }

    commissionReportData = await commissionReport(userId, req.query);

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

    

    const userData = await getUserById(userId, ["id","roleName"]);

    let queryColumns = ``;

    switch (userData.roleName) {
      case (userRoleConstant.fairGameWallet):
      
      case (userRoleConstant.fairGameAdmin): {
        queryColumns =  ` parentuse.fwPartnership`;
        break;
      }
      case (userRoleConstant.superAdmin): {
        queryColumns =` parentuse.faPartnership + parentuse.fwPartnership `;
        break;
      }
      case (userRoleConstant.admin): {
        queryColumns = ` parentuse.saPartnership + parentuse.faPartnership + parentuse.fwPartnership `;
        break;
      }
      case (userRoleConstant.superMaster): {
        queryColumns =` parentuse.aPartnership + parentuse.saPartnership + parentuse.faPartnership + parentuse.fwPartnership`;
        break;
      }
      case (userRoleConstant.master): {
        queryColumns = ` parentuse.smPartnership + parentuse.aPartnership + parentuse.saPartnership + parentuse.faPartnership + parentuse.fwPartnership `;
        break;
      }
      case (userRoleConstant.agent): {
        queryColumns = ` parentuse.mPartnership + parentuse.smPartnership + parentuse.aPartnership + parentuse.saPartnership + parentuse.faPartnership + parentuse.fwPartnership`;
        break;
      }
    }

    if (!userData) {
      return ErrorResponse({ statusCode: 404, message: { msg: "notFound", keys: { name: "User" } } }, req, res)
    }
    
    commissionReportData = await commissionMatchReport(userId, matchId,queryColumns);

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