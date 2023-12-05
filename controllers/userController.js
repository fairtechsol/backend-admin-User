const { userRoleConstant, transType, defaultButtonValue, sessiontButtonValue, buttonType, walletDescription } = require('../config/contants');
const { getUserById, addUser, getUserByUserName,updateUser, userBlockUnblock ,lockUnlockUserService} = require('../services/userService');
const { ErrorResponse, SuccessResponse } = require('../utils/response')
const { insertTransactions } = require('../services/transactionService')
const { insertButton } = require('../services/buttonService')
const bcrypt = require("bcryptjs");
const lodash = require('lodash')
const { forceLogoutIfLogin } = require("../services/commonService");
const internalRedis = require("../config/internalRedisConnection");

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
        downLevelCreditRefrence: creditRefrence + creator.downLevelCreditRefrence
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

// Controller function for locking/unlocking a user
exports.lockUnlockUser = async (req, res, next) => {
    try {
      // Extract relevant data from the request body and user object
      const { userId, block, type,transPassword } = req.body;
      const { id } = req.user;

      const isPasswordMatch = await checkTransactionPassword(
        id,
        transPassword
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
  
      // Fetch user details of the current user, including block information
      const userDetails = await getUserById(id, ["userBlock", "betBlock"]);
  
      // Fetch details of the user who is performing the block/unblock operation,
      // including the hierarchy and block information
      const blockingUserDetail = await getUserById(userId, [
        "createBy",
        "userBlock",
        "betBlock",
      ]);
  
      // Check if the current user is already blocked
      if (userDetails?.userBlock) {
        throw new Error("user.userBlockError");
      }
  
      // Check if the block type is 'betBlock' and the user is already bet-blocked
      if (type == blockType.betBlock && userDetails?.betBlock) {
        throw new Error("user.betBlockError");
      }
  
      // Check if the user performing the block/unblock operation has the right access
      if (blockingUserDetail?.createBy != id) {
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
      if (
        blockingUserDetail?.userBlock === block &&
        type === blockType.userBlock
      ) {
        return ErrorResponse(
          {
            statusCode: 400,
            message: {
              msg: "user.alreadyBlocked",
              keys: {
                name: "User",
                type: block ? "blocked" : "unblocked",
              },
            },
          },
          req,
          res
        );
      }
  
      // Check if the user is already bet-blocked or unblocked (prevent redundant operations)
      if (
        blockingUserDetail?.betBlock === block &&
        type === blockType.betBlock
      ) {
        return ErrorResponse(
          {
            statusCode: 400,
            message: {
              msg: "user.alreadyBlocked",
              keys: {
                name: "Bet",
                type: block ? "blocked" : "unblocked",
              },
            },
          },
          req,
          res
        );
      }
  
      // Perform the user block/unblock operation
      await userBlockUnblock(userId, id, block, type);
  
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
  const { transPassword } = req.body;

  const encryptTransPass = bcrypt.hashSync(transPassword, 10);
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
// exports.lockUnlockUser = async (req, res) => {
//   try {
//     const { userId, transPassword, userBlock, betBlock, createBy } = req.body;
//     let reqUserId = req.user?.id || createBy;
//     let loginUser = await getUserById(reqUserId, [
//       "id",
//       "userBlock",
//       "betBlock",
//       "roleName",
//     ]);
//     let updateUser = await getUserById(userId, [
//       "id",
//       "userBlock",
//       "betBlock",
//       "roleName",
//     ]);

//     if (!loginUser) {
//       throw {
//         message: {
//           msg: "notFound",
//           keys: { name: "Login User" },
//         },
//       };
//     }
//     if (!updateUser) {
//       throw {
//         message: {
//           msg: "notFound",
//           keys: { name: "Update User" },
//         },
//       };
//     }
//     if (loginUser.userBlock == true) {
//       throw new Error("user.userBlockError");
//     }
//     if (loginUser.betBlock == true && betBlock == false) {
//       throw new Error("user.betBlockError");
//     }
//     let result = await lockUnlockUserService(
//       loginUser,
//       updateUser,
//       userBlock,
//       betBlock
//     );
//     return SuccessResponse(
//       { statusCode: 200, message: { msg: "user.lock/unlockSuccessfully" } },
//       req,
//       res
//     );
//   } catch (err) {
//     return ErrorResponse(err, req, res);
//   }
// };
