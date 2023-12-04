const { userRoleConstant, transType, defaultButtonValue, buttonType, walletDescription } = require('../config/contants');
const { getUserById, addUser, getUserByUserName, updateUser, getUser, getChildUser, getUsers, getFirstLevelChildUser, getUsersWithUserBalance } = require('../services/userService');
const { ErrorResponse, SuccessResponse } = require('../utils/response')
const { insertTransactions } = require('../services/transactionService')
const { insertButton } = require('../services/buttonService')
const bcrypt = require("bcryptjs");
const lodash = require('lodash')
const { forceLogoutIfLogin } = require("../services/commonService");
const internalRedis = require("../config/internalRedisConnection");
const { getUserBalanceDataByUserId, getAllchildsCurrentBalanceSum, getAllChildProfitLossSum, updateUserBalanceByUserid, addUserBalance } = require('../services/userBalanceService');

exports.createUser = async (req, res) => {
  try {
    let { userName, fullName, password, confirmPassword, phoneNumber, city, roleName, myPartnership, createdBy, creditRefrence, exposureLimit, maxBetLimit, minBetLimit } = req.body;
    let reqUser = req.user || {}
    let creator = await getUserById(reqUser.id || createdBy);
    if (!creator) return ErrorResponse({ statusCode: 400, message: { msg: "invalidData" } }, req, res);

    if (!checkUserCreationHierarchy(creator, roleName))
      return ErrorResponse({ statusCode: 400, message: { msg: "user.InvalidHierarchy" } }, req, res);
    creator.myPartnership = parseInt(myPartnership)
    userName = userName.toUpperCase();
    let userExist = await getUserByUserName(userName);
    if (userExist) return ErrorResponse({ statusCode: 400, message: { msg: "user.userExist" } }, req, res);

    if (exposureLimit && exposureLimit > creator.exposureLimit)
      return ErrorResponse({ statusCode: 400, message: { msg: "user.InvalidExposureLimit" } }, req, res);
    password = await bcrypt.hash(
      password,
      process.env.BCRYPTSALT
    );
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
      creditRefrence: creditRefrence ? creditRefrence : creator.creditRefrence,
      exposureLimit: exposureLimit ? exposureLimit : creator.exposureLimit,
      maxBetLimit: maxBetLimit ? maxBetLimit : creator.maxBetLimit,
      minBetLimit: minBetLimit ? minBetLimit : creator.minBetLimit
    }
    let partnerships = await calculatePartnership(userData, creator)
    userData = { ...userData, ...partnerships };
    let insertUser = await addUser(userData);
    let updateUser = {}
    if (creditRefrence) {
      updateUser = await addUser({
        id: creator.id,
        downLevelCreditRefrence: parseInt(creditRefrence) + parseInt(creator.downLevelCreditRefrence)
      })
    }
    let walletArray = [{
      actionBy: insertUser.createBy,
      searchId: insertUser.createBy,
      userId: insertUser.id,
      amount: 0,
      transType: transType.add,
      currentAmount: insertUser.creditRefer,
      description: walletDescription.userCreate
    }]
    if (insertUser.createdBy != insertUser.id) {
      walletArray.push({
        actionBy: insertUser.createBy,
        searchId: insertUser.id,
        userId: insertUser.id,
        amount: 0,
        transType: transType.withDraw,
        currentAmount: insertUser.creditRefer,
        description: walletDescription.userCreate
      });
    }

    const transactioninserted = await insertTransactions(walletArray);
    if (insertUser.roleName == userRoleConstant.user) {
      let buttonValue = [
        {
          type: buttonType.MATCH,
          value: defaultButtonValue.buttons,
          createBy: insertUser.id
        }
      ]
      let insertedButton = await insertButton(buttonValue)
    }
    let response = lodash.omit(insertUser, ["password", "transPassword"])
    return SuccessResponse({ statusCode: 200, message: { msg: "login" }, data: response }, req, res)
  } catch (err) {
    return ErrorResponse(err, req, res);
  }
};

exports.updateUser = async (req, res) => {
  try {
    let { sessionCommission, matchComissionType, matchCommission, id, createBy } = req.body;
    let reqUser = req.user || {}
    let updateUser = await getUser({ id, createBy }, ["id", "createBy", "sessionCommission", "matchComissionType", "matchCommission"])
    if (!updateUser) return ErrorResponse({ statusCode: 400, message: { msg: "invalidData" } }, req, res);
    updateUser.sessionCommission = sessionCommission ?? updateUser.sessionCommission;
    updateUser.matchCommission = matchCommission ?? updateUser.matchCommission;
    updateUser.matchComissionType = matchComissionType || updateUser.matchComissionType;
    updateUser = await addUser(updateUser);
    let response = lodash.pick(updateUser, ["sessionCommission", "matchCommission", "matchComissionType"])
    return SuccessResponse({ statusCode: 200, message: { msg: "login" }, data: response }, req, res)
  } catch (err) {
    return ErrorResponse(err, req, res);
  }
};


const calculatePartnership = async (userData, creator) => {
  let {
    fwPartnership,
    faPartnership,
    saPartnership,
    aPartnership,
    smPartnership,
    mPartnership,
  } = creator;

  if (userData.roleName == userRoleConstant.user) {
    return {
      fwPartnership,
      faPartnership,
      saPartnership,
      aPartnership,
      smPartnership,
      mPartnership,
    };
  }

  let setPartnership = {
    [userRoleConstant.fairGameWallet]: () => {
      fwPartnership = creator.myPartnership;
    },
    [userRoleConstant.fairGameAdmin]: () => {
      faPartnership = creator.myPartnership;
    },
    [userRoleConstant.superAdmin]: () => {
      saPartnership = creator.myPartnership;
    },
    [userRoleConstant.admin]: () => {
      aPartnership = creator.myPartnership;
    },
    [userRoleConstant.superMaster]: () => {
      smPartnership = creator.myPartnership;
    },
    [userRoleConstant.master]: () => {
      mPartnership = creator.myPartnership;
    },
    default: () => {
      return;
    },
  }(setPartnership[creator.roleName] || setPartnership["default"])();
  setPartnership = {
    [userRoleConstant.fairGameWallet]: {
      [userRoleConstant.fairGameAdmin]: () => {
        faPartnership = 100 - parseInt(creator.myPartnership);
      },
      [userRoleConstant.superAdmin]: () => {
        saPartnership = 100 - parseInt(creator.myPartnership);
      },
      [userRoleConstant.admin]: () => {
        aPartnership = 100 - parseInt(creator.myPartnership);
      },
      [userRoleConstant.superMaster]: () => {
        smPartnership = 100 - parseInt(creator.myPartnership);
      },
      [userRoleConstant.master]: () => {
        mPartnership = 100 - parseInt(creator.myPartnership);
      },
    },
    [userRoleConstant.fairGameAdmin]: {
      [userRoleConstant.superAdmin]: () => {
        saPartnership = 100 - parseInt(creator.myPartnership + fwPartnership);
      },
      [userRoleConstant.admin]: () => {
        aPartnership = 100 - parseInt(creator.myPartnership + fwPartnership);
      },
      [userRoleConstant.superMaster]: () => {
        smPartnership = 100 - parseInt(creator.myPartnership + fwPartnership);
      },
      [userRoleConstant.master]: () => {
        mPartnership = 100 - parseInt(creator.myPartnership + fwPartnership);
      },
    },
    [userRoleConstant.superAdmin]: {
      [userRoleConstant.admin]: () => {
        aPartnership =
          100 - parseInt(creator.myPartnership + fwPartnership + faPartnership);
      },
      [userRoleConstant.superMaster]: () => {
        smPartnership =
          100 - parseInt(creator.myPartnership + fwPartnership + faPartnership);
      },
      [userRoleConstant.master]: () => {
        mPartnership =
          100 - parseInt(creator.myPartnership + fwPartnership + faPartnership);
      },
    },
    [userRoleConstant.admin]: {
      [userRoleConstant.superMaster]: () => {
        smPartnership =
          100 -
          parseInt(
            creator.myPartnership +
            fwPartnership +
            faPartnership +
            saPartnership
          );
      },
      [userRoleConstant.master]: () => {
        mPartnership =
          100 -
          parseInt(
            creator.myPartnership +
            fwPartnership +
            faPartnership +
            saPartnership
          );
      },
    },
    [userRoleConstant.superMaster]: {
      [userRoleConstant.master]: () => {
        mPartnership =
          100 -
          parseInt(
            creator.myPartnership +
            fwPartnership +
            faPartnership +
            saPartnership +
            aPartnership
          );
      },
    },
    default: () => {
      return;
    },
  };
  if (typeof setPartnership[creator.roleName][userData.roleName] == "function")
    setPartnership[creator.roleName][userData.roleName]();
  else setPartnership["default"]();

  if (
    userData.roleName != userRoleConstant.expert &&
    fwPartnership +
    faPartnership +
    saPartnership +
    aPartnership +
    smPartnership +
    mPartnership !=
    100
  ) {
    throw new Error("user.partnershipNotValid");
  }
  return {
    fwPartnership,
    faPartnership,
    saPartnership,
    aPartnership,
    smPartnership,
    mPartnership,
  };
};

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
exports.insertWallet = async (req, res) => {
  try {
    let wallet = {
      userName: "fgWallet",
      fullName: "fair game wallet",
      password: "123456",
      phoneNumber: "1234567890",
      city: "india",
      roleName: userRoleConstant.fairGameWallet,
      userBlock: false,
      betBlock: false,
      createdBy: null,
      fwPartnership: 0,
      faPartnership: 0,
      saPartnership: 0,
      aPartnership: 0,
      smPartnership: 0,
      mPartnership: 0,
    };
    let user = await getUserByUserName(wallet.userName);
    if (user)
      return ErrorResponse(
        { statusCode: 400, message: { msg: "userExist" } },
        req,
        res
      );
    let insertUser = await addUser(wallet);
    return SuccessResponse(
      { statusCode: 200, message: { msg: "login" }, data: insertUser },
      req,
      res
    );
  } catch (err) {
    return ErrorResponse(err, req, res);
  }
};

const generateTransactionPass = () => {
  const randomNumber = Math.floor(100000 + Math.random() * 900000);
  return `${randomNumber}`;
};

// Function to handle user not found error response
const handleUserNotFound = () => ({
  error: true,
  message: {
    msg: "notFound",
    keys: { name: "User" },
  },
  statusCode: 404,
});

// Check old password against the stored password
const checkOldPassword = async (userId, oldPassword) => {
  // Retrieve user's password from the database
  const user = await getUserById(userId, ["password"]);
  if (!user) {
    // User not found, return error response
    return handleUserNotFound();
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
    return handleUserNotFound();
  }
  // Compare old transaction password with the stored transaction password
  return bcrypt.compareSync(oldTransactionPass, user.transPassword);
};

const forceLogoutUser = async (userId, stopForceLogout) => {
  await internalRedis.hdel(userId, "token");

  if (!stopForceLogout) {
    await forceLogoutIfLogin(userId);
  }
};

// API endpoint for changing password
exports.changePassword = async (req, res, next) => {
  try {
    // Destructure request body
    const {
      oldPassword,
      newPassword,
      transactionPassword,
      confirmPassword,
    } = req.body;

    // Check if the new password matches the confirmed password
    if (newPassword !== confirmPassword) {
      return ErrorResponse(
        {
          statusCode: 403,
          message: { msg: "user.confirmPasswordNotMatch" },
        },
        req,
        res
      );
    }

    // Hash the new password
    const password = bcrypt.hashSync(newPassword, 10);

    // If user is changing its password after login or logging in for the first time
    if (oldPassword && !transactionPassword) {
      // Check if the old password is correct
      const userId = req.user.id;
      const isPasswordMatch = await checkOldPassword(userId, oldPassword);

      // Handle error if user not found or old password is incorrect
      if (isPasswordMatch?.error) {
        return ErrorResponse(
          {
            statusCode: isPasswordMatch.statusCode,
            message: isPasswordMatch.message,
          },
          req,
          res
        );
      }

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

    // Handle error if user not found or transaction password is incorrect
    if (isPasswordMatch?.error) {
      return ErrorResponse(
        {
          statusCode: isPasswordMatch.statusCode,
          message: isPasswordMatch.message,
        },
        req,
        res
      );
    }

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

    // Update loginAt, password, and reset transactionPassword
    await updateUser(userId, {
      loginAt: null,
      password,
      transPassword: null,
    });
    await forceLogoutUser(userId);
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
    let { amount, userid, transPassword, createBy } = req.body

    let reqUser = req.user || {}
    let loginUser = await getUserById(createBy, ["id", "exposureLimit", "roleName"])
    let user = await getUser({ id: userid, createBy }, ["id", "exposureLimit", "roleName"])

    if (!user) return ErrorResponse({ statusCode: 400, message: { msg: "invalidData" } }, req, res);

    if (loginUser.exposureLimit < amount && loginUser.roleName != userRoleConstant.fairGameWallet) {
      return ErrorResponse({ statusCode: 400, message: { msg: "user.InvalidExposureLimit" } }, req, res);
    }
    amount = parseInt(amount);
    user.exposureLimit = amount
    let childUsers = await getChildUser(user.id)

    console.log(childUsers);

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
    let reqUser = req.user
    let { userName, roleName, offset, limit } = req.query
    // let loginUser = await getUserById(reqUser.id)
    let userRole = reqUser.roleName
    let where = {
      createBy : reqUser.id
    }
    if (userName) where.userName = ILike(`%${userName}%`);
    if (roleName) where.roleName = roleName;

    let relations = ['user']
    let users = await getUsersWithUserBalance(where, ["id", "userName", "roleName", "userBlock", "betBlock", "exposureLimit", "creditRefrence","totalComission"], offset, limit)

    let response = {
      count : 0,
      list : []
    }
    if(!users[1]){
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
  response.count = users[1]
  let partnershipCol = [];
        if (userRole == userRoleConstant.master) {
            partnershipCol = ['mPartnership', 'smPartnership', 'aPartnership', 'saPartnership', 'faPartnership', 'fwPartnership'];
        }
        if (userRole == userRoleConstant.superMaster) {
            partnershipCol = ['smPartnership', 'aPartnership', 'saPartnership', 'faPartnership', 'fwPartnership'];
        }
        if (userRole == userRoleConstant.admin) {
            partnershipCol = ['aPartnership', 'saPartnership', 'faPartnership', 'fwPartnership'];
        }
        if (userRole == userRoleConstant.superAdmin) {
            partnershipCol = ['saPartnership', 'faPartnership', 'fwPartnership'];
        }
        if (userRole == userRoleConstant.fairGameAdmin) {
            partnershipCol = ['faPartnership', 'fwPartnership'];
        }
        if (userRole == userRoleConstant.fairGameWallet || userRole == userRoleConstant.expert) {
            partnershipCol = ['fwPartnership'];
        }

  let data = await Promise.all(users[0].map(async element => {
    let d = {}
    d = {
      ...element,
      ...element.userBal
    };

    delete d.userBal
    d['percentProfitLoss'] = d['myProfitLoss'];
    let partner_ships = 100;
    if (partnershipCol && partnershipCol.length) {
        partner_ships = partnershipCol.reduce((partialSum, a) => partialSum + d[a], 0);
        d['percentProfitLoss'] = ((d['profitLoss'] / 100) * partner_ships).toFixed(2);
    }
      if (d.roleName != userRoleConstant.user) {
        d['available_balance'] = Number((d['currentBalance']).toFixed(2));
        let childUsers = await getChildUser(element.id)
        let allChildUserIds = childUsers.map(obj => obj.id)
        let balancesum = 0

        if(allChildUserIds.length){
        let allChildBalanceData =await getAllchildsCurrentBalanceSum(allChildUserIds)
        balancesum = parseFloat(allChildBalanceData.allchildscurrentbalancesum) ? parseFloat(allChildBalanceData.allchildscurrentbalancesum) : 0;            
        }
        
        d['balance'] =  Number(d['currentBalance'] + balancesum).toFixed(2);
    } else {
        d['available_balance'] = Number((d['currentBalance'] - d['exposure']).toFixed(2));
        d['balance'] = d['currentBalance'];
    }
    d['percentProfitLoss'] = d['myProfitLoss'];
    d['TotalComission'] = d['TotalComission']
    if (partnershipCol && partnershipCol.length) {
        let partner_ships = partnershipCol.reduce((partialSum, a) => partialSum + d[a], 0);
        d['percentProfitLoss'] = ((d['profitLoss'] / 100) * partner_ships).toFixed(2);
        d['TotalComission'] = ((d['TotalComission'] / 100) * partner_ships).toFixed(2) + '(' + partner_ships + '%)';
    }
    return d;
}))

response.list = data
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
    let reqUser = req.user || {}
    let { id } = req.query
    let loginUser = await getUserById(id)
    if (!loginUser) return ErrorResponse({ statusCode: 400, message: { msg: "invalidData" } }, req, res);

    let firstLevelChildUser = await getFirstLevelChildUser(loginUser.id)

    let firstLevelChildUserIds = await firstLevelChildUser.map(obj => obj.id)

    let childUsers = await getChildUser(loginUser.id)

    let allChildUserIds = childUsers.map(obj => obj.id)

    let userBalanceData = getUserBalanceDataByUserId(loginUser.id, ["id", "currentBalance", "profitLoss"])

    let FirstLevelChildBalanceData = getAllChildProfitLossSum(firstLevelChildUserIds)

    let allChildBalanceData = getAllchildsCurrentBalanceSum(allChildUserIds)

    let AggregateBalanceData = await Promise.all([userBalanceData, FirstLevelChildBalanceData, allChildBalanceData])

    userBalanceData = AggregateBalanceData[0] ? AggregateBalanceData[0] : {};
    FirstLevelChildBalanceData = AggregateBalanceData[1] ? AggregateBalanceData[1] : {};
    allChildBalanceData = AggregateBalanceData[2] ? AggregateBalanceData[2] : {};

    let response = {
      userCreditReference: parseFloat(loginUser.creditRefrence),
      downLevelOccupyBalance: allChildBalanceData.allchildscurrentbalancesum ? parseFloat(allChildBalanceData.allchildscurrentbalancesum) : 0,
      downLevelCreditReference: loginUser.downLevelCreditReference,
      availableBalance: userBalanceData.currentBalance ? parseFloat(userBalanceData.currentBalance) : 0,
      totalMasterBalance: (userBalanceData.currentBalance ? parseFloat(userBalanceData.currentBalance) : 0) + (allChildBalanceData.allchildscurrentbalancesum ? parseFloat(allChildBalanceData.allchildscurrentbalancesum) : 0),
      upperLevelBalance: userBalanceData.profitLoss ? userBalanceData.profitLoss : 0,
      downLevelProfitLoss: FirstLevelChildBalanceData.firstlevelchildsprofitlosssum ? FirstLevelChildBalanceData.firstlevelchildsprofitlosssum : 0,
      availableBalanceWithProfitLoss: ((userBalanceData.currentBalance ? parseFloat(userBalanceData.currentBalance) : 0) + (allChildBalanceData.allchildscurrentbalancesum ? parseFloat(allChildBalanceData.allchildscurrentbalancesum) : 0)) + (userBalanceData.profitLoss ? userBalanceData.profitLoss : 0),
      profitLoss: 0
    };
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
    return ErrorResponse(error, req, res);
  }
}

exports.setCreditReferrence = async (req, res, next) => {
  try {

    let { userId, amount, transactionPassword, remark, createBy } = req.body;
    let reqUser = req.user || { id: createBy };
    amount = parseFloat(amount);

    let loginUser = await getUserById(reqUser.id, ["id", "creditRefrence", "roleName"]);
    let user = await getUser({ id: userId, createBy: reqUser.id }, ["id", "creditRefrence", "roleName"]);
    if (!user) return ErrorResponse({ statusCode: 400, message: { msg: "invalidData" } }, req, res);

    let userBalance = await getUserBalanceDataByUserId(user.id);
    let previousCreditReference = user.creditRefrence
    let updateData = {
      creditRefrence: amount
    }
    
    if (userBalance) {
      let profitLoss = userBalance.profitLoss + previousCreditReference - amount;
      let newUserBalanceData = await updateUserBalanceByUserid(user.id, {profitLoss})
    } else {
      insertUserBalanceData = {
        currentBalance: 0,
        userId: user.id,
        profitLoss: previousCreditReference - amount,
        myProfitLoss: 0,
        downLevelBalance: 0,
        exposure: 0
      }
      insertUserBalanceData = await addUserBalance(insertUserBalanceData)

    }
    
    let walletArray = [{
      actionBy: reqUser.id,
      searchId: user.id,
      userId: user.id,
      amount: previousCreditReference,
      transType: transType.creditRefer,
      currentAmount: user.creditRefrence,
      description: "CREDIT REFRENCE " + remark
    }, {
      actionBy: reqUser.id,
      searchId: reqUser.id,
      userId: user.id,
      amount: previousCreditReference,
      transType: transType.creditRefer,
      currentAmount: user.creditRefrence,
      description: "CREDIT REFRENCE " + remark
    }]

    const transactioninserted = await insertTransactions(walletArray);
    await updateUser(user.id, updateData);
    return SuccessResponse(
      {
        statusCode: 200,
        message: { msg: "userBalance.BalanceAddedSuccessfully" },
        data: { user },
      },
      req,
      res
    );

  } catch (error) {
    return ErrorResponse(error, req, res);
  }

}