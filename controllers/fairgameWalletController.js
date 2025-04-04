const { IsNull, In, ILike, Not } = require("typeorm");
const {
  transType,
  walletDescription,
  userRoleConstant,
  socketData,
  betType,
  betResultStatus,
  redisKeys,
  partnershipPrefixByRole,
  marketBetType,
  buttonType,
  defaultButtonValue,
  sessiontButtonValue,
  casinoButtonValue,
  cardGameType,
  transactionType,
  matchOddName,
} = require("../config/contants");
const { logger } = require("../config/logger");
const {  addNewBet,  updatePlaceBet, getTotalProfitLoss, getAllMatchTotalProfitLoss, getBetsProfitLoss, getSessionsProfitLoss, getBetsWithMatchId, findAllPlacedBet, getUserWiseProfitLoss, getTotalProfitLossRacing, getAllRacinMatchTotalProfitLoss, getMultipleAccountCardMatchProfitLoss, getMatchBetPlaceWithUserCard, getTotalProfitLossCard, getAllCardMatchTotalProfitLoss, getBetCountData, getUserSessionsProfitLoss } = require("../services/betPlacedService");
const {
  forceLogoutUser,
  profitLossPercentCol,
  getUserProfitLossForUpperLevel,
  forceLogoutIfLogin,
  insertBulkTransactions,
  childIdquery,
  parseRedisData,
  calculateProfitLossForCardMatchToResult,
  findUserPartnerShipObj,
} = require("../services/commonService");
const {
  updateDomainData,
  addDomainData,
  getDomainDataByDomain,
  getDomainDataByUserId,
} = require("../services/domainDataService");
const { updateUserDataRedis, hasUserInCache, getUserRedisData, deleteKeyFromUserRedis, incrementValuesRedis, deleteHashKeysByPattern } = require("../services/redis/commonfunction");
const { insertTransactions } = require("../services/transactionService");
const {
  addInitialUserBalance,
  getUserBalanceDataByUserId,
  getAllUsersBalanceSum,
  updateUserBalanceData,
} = require("../services/userBalanceService");
const {
  addUser,
  getUser,
  getChildUser,
  getUserById,
  updateUser,
  getUserByUserName,
  userBlockUnblock,
  betBlockUnblock,
  getParentsWithBalance,
  getChildsWithOnlyUserRole,
  getChildUserBalanceSum,
  getAllUsersBalanceSumByFgId,
  getAllUsers,
  updateUserExposureLimit,
  getChildUserBalanceAndData,
  getMultipleUsersWithUserBalances,
  getUserDataWithUserBalance,
  softDeleteAllUsers,
  deleteUserByDirectParent,
  getUsersByWallet,
  getUserDataWithUserBalanceDeclare,
  getChildsWithOnlyMultiUserRole,
} = require("../services/userService");
const { sendMessageToUser, broadcastEvent } = require("../sockets/socketManager");
const { ErrorResponse, SuccessResponse } = require("../utils/response");
const { insertButton } = require("../services/buttonService");
const { CardWinOrLose } = require("../services/cardService/cardWinAccordingToBet");
const { CardResultTypeWin } = require("../services/cardService/winCardAccordingToTransaction");
const { getVirtualCasinoExposureSum } = require("../services/virtualCasinoBetPlacedsService");

exports.createSuperAdmin = async (req, res) => {
  try {
    const {
      userName,
      fullName,
      password,
      phoneNumber,
      city,
      betBlock,
      userBlock,
      roleName,
      fwPartnership,
      faPartnership,
      saPartnership,
      aPartnership,
      smPartnership,
      mPartnership,
      agPartnership,
      id,
      creditRefrence,
      exposureLimit,
      maxBetLimit,
      minBetLimit,
      domain,
      isOldFairGame,
      matchComissionType,
      matchCommission,
      superParentType,
      superParentId,
      remark,
      delayTime,
      sessionCommission,
      betBlockedBy,
      userBlockedBy
    } = req.body;

    const isUserPresent = await getUserByUserName(userName, ["id"]);
    let isDomainExist;
    if (!isOldFairGame) {
      isDomainExist = await getDomainDataByDomain(domain?.domain);
    }
    if (isUserPresent) {
      return ErrorResponse(
        {
          statusCode: 400,
          message: {
            msg: "user.userExist",
          },
        },
        req,
        res
      );
    }

    if (!isOldFairGame && isDomainExist) {
      return ErrorResponse(
        {
          statusCode: 400,
          message: {
            msg: "alreadyExist",
            keys: {
              name: "Domain",
            },
          },
        },
        req,
        res
      );
    }

    if (roleName != userRoleConstant.superAdmin && !isOldFairGame) {
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

    if (!isOldFairGame) {
      await addDomainData({
        ...domain,
        userName,
        userId: id,
      });
    }
    let userData = {
      userName,
      fullName,
      password,
      phoneNumber,
      city,
      betBlock,
      userBlock,
      betBlockedBy,
      userBlockedBy,
      roleName,
      fwPartnership,
      faPartnership,
      saPartnership,
      aPartnership,
      smPartnership,
      mPartnership,
      agPartnership,
      id,
      creditRefrence,
      exposureLimit,
      maxBetLimit,
      minBetLimit,
      createBy: id,
      superParentType,
      superParentId,
      remark,
      delayTime: delayTime || 5,
      ...(isOldFairGame ? {
        matchComissionType,
        matchCommission,
        sessionCommission
      } : {})
    };
    let insertUser = await addUser(userData);

    let transactionArray = [
      {
        actionBy: id,
        searchId: id,
        userId: id,
        amount: 0,
        transType: transType.add,
        closingBalance: creditRefrence,
        description: walletDescription.userCreate,
        type: transactionType.withdraw
      },
    ];

    await insertTransactions(transactionArray);
    let insertUserBalanceData = {
      currentBalance: 0,
      userId: insertUser.id,
      profitLoss: -creditRefrence,
      myProfitLoss: 0,
      downLevelBalance: 0,
      exposure: 0,
      type: transactionType.withdraw
    };
    insertUserBalanceData = await addInitialUserBalance(insertUserBalanceData);
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
        },
        {
          type: buttonType.CASINO,
          value: casinoButtonValue.buttons,
          createBy: insertUser.id
        }
      ]
      await insertButton(buttonValue)
    }

    return SuccessResponse(
      {
        statusCode: 200,
        message: {
          msg: "created",
          keys: {
            name: "Super admin",
          },
        },
      },
      req,
      res
    );
  } catch (err) {
    return ErrorResponse(err, req, res);
  }
};

exports.updateSuperAdmin = async (req, res) => {
  try {
    let { user, domain, id, isOldFairGame } = req.body;

    if (!isOldFairGame) {
      let isDomainData = await getDomainDataByUserId(id, ["id"]);
      if (!isDomainData) {
        return ErrorResponse(
          { statusCode: 400, message: { msg: "invalidData" } },
          req,
          res
        );
      }

      await updateDomainData(id, domain);
    }
    await updateUser(id, user);

    return SuccessResponse(
      {
        statusCode: 200,
        message: {
          msg: "update",
          keys: {
            name: "User",
          },
        },
      },
      req,
      res
    );
  } catch (err) {
    return ErrorResponse(err, req, res);
  }
};

exports.updateSuperAdminBalance = async (req, res) => {
  try {
    let { userId, transactionType, amount, remark } = req.body;
    amount = parseFloat(amount);

    let user = await getUser({ id: userId }, ["id"]);
    const userExistRedis = await hasUserInCache(user.id);
    if (!user)
      return ErrorResponse(
        { statusCode: 400, message: { msg: "invalidData" } },
        req,
        res
      );

    let userBalanceData = await getUserBalanceDataByUserId(user.id);

    if (!userBalanceData)
      return ErrorResponse(
        { statusCode: 400, message: { msg: "invalidData" } },
        req,
        res
      );
    let updateData = {}
    if (transactionType == transType.add) {
      updateData = {
        currentBalance: parseFloat(userBalanceData.currentBalance) + parseFloat(amount),
        profitLoss: parseFloat(userBalanceData.profitLoss) + parseFloat(amount),
      }

      let updateMyProfitLoss = parseFloat(amount);
      if (parseFloat(userBalanceData.myProfitLoss) + parseFloat(amount) > 0) {
        updateMyProfitLoss = userBalanceData.myProfitLoss
        updateData.myProfitLoss = 0;
      }
      else {
        updateData.myProfitLoss = parseFloat(userBalanceData.myProfitLoss) + parseFloat(amount);
      }

      // await updateUserBalanceByUserId(user.id, updateData);
      await updateUserBalanceData(user.id, { 
        profitLoss: parseFloat(amount), 
        myProfitLoss: updateMyProfitLoss, 
        exposure: 0, 
        totalCommission: 0, 
        balance: parseFloat(amount)});
      if (userExistRedis) {
        await updateUserDataRedis(user.id, updateData);
      }
    } else if (transactionType == transType.withDraw) {
      if (amount > userBalanceData.currentBalance)
        return ErrorResponse(
          {
            statusCode: 400,
            message: { msg: "userBalance.insufficientBalance" },
          },
          req,
          res
        );
      updateData = {
        currentBalance: parseFloat(userBalanceData.currentBalance) - parseFloat(amount),
        profitLoss: parseFloat(userBalanceData.profitLoss) - parseFloat(amount),
      }

      let updateMyProfitLoss = -parseFloat(amount);
      if (parseFloat(userBalanceData.myProfitLoss) - parseFloat(amount) < 0) {
        updateMyProfitLoss = -userBalanceData.myProfitLoss
        updateData.myProfitLoss = 0;
      }
      else {
        updateData.myProfitLoss = parseFloat(userBalanceData.myProfitLoss) - parseFloat(amount);
      }

      // await updateUserBalanceByUserId(user.id, updateData);
      await updateUserBalanceData(user.id, { 
        profitLoss: -parseFloat(amount), 
        myProfitLoss: updateMyProfitLoss, 
        exposure: 0, 
        totalCommission: 0, 
        balance: -parseFloat(amount)});
      if (userExistRedis) {

        await updateUserDataRedis(user.id, updateData);
      }
    } else {
      return ErrorResponse(
        { statusCode: 400, message: { msg: "invalidData" } },
        req,
        res
      );
    }

    let transactionArray = [
      {
        actionBy: userId,
        searchId: userId,
        userId: userId,
        amount: transactionType == transType.add ? amount : -amount,
        transType: transactionType,
        closingBalance: updateData.currentBalance,
        description: remark,
        type: transactionType.withdraw
      },
    ];

    await insertTransactions(transactionArray);
    sendMessageToUser(userId, socketData.userBalanceUpdateEvent, updateData);
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
};

exports.setExposureLimitSuperAdmin = async (req, res, next) => {
  try {
    let { exposureLimit, id } = req.body;

    let user = await getUser({ id }, ["id", "exposureLimit"]);

    if (!user)
      return ErrorResponse(
        { statusCode: 400, message: { msg: "invalidData" } },
        req,
        res
      );

    exposureLimit = parseInt(exposureLimit);
    user.exposureLimit = exposureLimit;
    let childUsers = await getChildUser(user.id);

    childUsers.map(async (childObj) => {
      let childUser = await getUserById(childObj.id);
      if ( childUser.exposureLimit > exposureLimit || childUser.exposureLimit == 0 ) {
        childUser.exposureLimit = exposureLimit;
        await updateUser(childUser.id, { exposureLimit: exposureLimit });
      }
    });
    await updateUser(user.id, { exposureLimit: exposureLimit });
    return SuccessResponse(
      {
        statusCode: 200,
        message: { msg: "user.ExposurelimitSet" },
      },
      req,
      res
    );
  } catch (error) {
    return ErrorResponse(error, req, res);
  }
};

exports.setExposureLimitByFGAdmin = async (req, res, next) => {
  try {
    let { exposureLimit, id, roleName } = req.body;

    exposureLimit = parseInt(exposureLimit);
    let childUsers = await getAllUsers(roleName == userRoleConstant.fairGameAdmin ? { superParentId: id } : {}, ["id", "exposureLimit"]);

    const childUsersId = childUsers.map((childObj) => {
      return childObj.id;

    });


    await updateUserExposureLimit(exposureLimit, childUsersId);


    return SuccessResponse(
      {
        statusCode: 200,
        message: { msg: "user.ExposurelimitSet" },
      },
      req,
      res
    );
  } catch (error) {
    console.log(error);
    logger.error({
      error: `Error in exposure limit.`,
      stack: error.stack,
      message: error.message,
    });
    return ErrorResponse(error, req, res);
  }
};

exports.setCreditReferrenceSuperAdmin = async (req, res, next) => {
  try {
    let { userId, amount, remark } = req.body;
    amount = parseFloat(amount);
    let user = await getUser({ id: userId }, [
      "id",
      "creditRefrence",
      "roleName",
    ]);
    if (!user)
      return ErrorResponse(
        { statusCode: 400, message: { msg: "invalidData" } },
        req,
        res
      );

    let userBalance = await getUserBalanceDataByUserId(user.id);
    if (!userBalance)
      return ErrorResponse(
        { statusCode: 400, message: { msg: "invalidData" } },
        req,
        res
      );
    let previousCreditReference = user.creditRefrence;
    let updateData = {
      creditRefrence: amount,
    };

    let profitLoss = userBalance.profitLoss + previousCreditReference - amount;
    await updateUserBalanceData(user.id, { profitLoss: previousCreditReference - amount, balance: 0 });
    // await updateUserBalanceByUserId(user.id, { profitLoss });
    const userExistRedis = await hasUserInCache(user.id);

    if (userExistRedis) {
      await updateUserDataRedis(user.id, { profitLoss });
    }

    let transactionArray = [
      {
        actionBy: user.id,
        searchId: user.id,
        userId: user.id,
        amount: previousCreditReference,
        transType: transType.creditRefer,
        closingBalance: updateData.creditRefrence,
        description: "CREDIT REFRENCE " + remark,
        type: transactionType.withdraw
      },
    ];

    await insertTransactions(transactionArray);
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
};

exports.lockUnlockSuperAdmin = async (req, res, next) => {
  try {
    // Extract relevant data from the request body and user object
    const { userId, betBlock, userBlock, loginId } = req.body;

    // Fetch details of the user who is performing the block/unblock operation,
    // including the hierarchy and block information
    const blockingUserDetail = await getUserById(userId, [
      "createBy",
      "userBlock",
      "betBlock",
      "userBlockedBy",
      "betBlockedBy"
    ]);

    if (!blockingUserDetail) {
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
    if (blockingUserDetail?.userBlock != userBlock && userBlock != null) {
      // Perform the user block/unblock operation
      const blockedUsers = await userBlockUnblock(userId, loginId, userBlock);
      //   if blocktype is user and its block then user would be logout by socket
      if (userBlock) {
        blockedUsers?.[0]?.forEach(async (item) => {
          await forceLogoutUser(item?.id);
        });
      }
    }

    // Check if the user is already bet-blocked or unblocked (prevent redundant operations)
    if (blockingUserDetail?.betBlock != betBlock && betBlock != null) {
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

// API endpoint for changing password
exports.changePasswordSuperAdmin = async (req, res, next) => {
  try {
    // Destructure request body
    const { userId, password } = req.body;

    const userDetail = await getUserById(userId, ["id"]);

    if (!userDetail) {
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

    // Update loginAt, password, and reset transactionPassword
    await updateUser(userId, {
      loginAt: null,
      password,
      transPassword: null,
    });

    // deleting token for logout
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

exports.getVirtualBetExposures = async (req, res) => {
  try {
    let { roleName, userId } = req.query;
    let bets = [];
      if (roleName == userRoleConstant.user) {
        bets = await getVirtualCasinoExposureSum({ userId: userId, settled: false });
      }
      else {
        const users = await getChildsWithOnlyMultiUserRole((await getAllUsers(roleName == userRoleConstant.fairGameAdmin ? { superParentId: userId } : {})).map((item) => item.id));
        bets = await getVirtualCasinoExposureSum({ userId: In(users.map((item) => item.id)), settled: false, });
      }
    
    let result = {
      exposure: Math.abs(bets?.count?.totalAmount || 0),
      match: bets?.list?.reduce((prev,curr) => {
        prev[curr.gameName] = { ...curr, totalAmount: Math.abs(curr.totalAmount) };
        return prev;
      },{})
    }
    return SuccessResponse({
      statusCode: 200, message: { msg: "fetched", keys: { type: "Bet" } }, data: result
    }, req, res)
  } catch (err) {
    logger.error({
      error: "Error in get bet for wallet",
      stack: err.stack,
      message: err.message,
    })
    return ErrorResponse(err, req, res);

  }

};

exports.totalProfitLossWallet = async (req, res) => {
  try {
    let { user, startDate, endDate, matchId, searchId, partnerShipRoleName } = req.body;
    user = user || req.user;
    partnerShipRoleName = partnerShipRoleName || req.user?.roleName;
    let totalLoss;
    let queryColumns = ``;
    let where = {}


    if (matchId) {
      where.matchId = matchId
    }

    if (!user) {
      return ErrorResponse(
        { statusCode: 400, message: { msg: "invalidData" } },
        req,
        res
      );
    }
    queryColumns = await getQueryColumns(user, partnerShipRoleName);
    totalLoss = `(Sum(CASE WHEN placeBet.result = 'LOSS' then ROUND(placeBet.lossAmount / 100 * ${queryColumns}, 2) ELSE 0 END) - Sum(CASE WHEN placeBet.result = 'WIN' then ROUND(placeBet.winAmount / 100 * ${queryColumns}, 2) ELSE 0 END)) as "totalLoss"`;

    if (user.roleName == userRoleConstant.user) {
      totalLoss = '-' + totalLoss;
    }
    totalLoss = `SUM(CASE WHEN placeBet.result = 'WIN' AND placeBet.bettingName = '${matchOddName}' THEN ROUND(placeBet.winAmount / 100, 2) ELSE 0 END) as "totalDeduction", ` + totalLoss;
    let subQuery = await childIdquery(user, searchId);
    const result = await getTotalProfitLoss(where, startDate, endDate, totalLoss, subQuery);
    const racingReport = await getTotalProfitLossRacing(where, startDate, endDate, totalLoss, subQuery);
    return SuccessResponse(
      {
        statusCode: 200, data: [...result, ...racingReport]
      },
      req,
      res
    );
  } catch (error) {
    logger.error({
      context: `error in get total profit loss`,
      error: error.message,
      stake: error.stack,
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

exports.totalProfitLossByMatch = async (req, res) => {
  try {
    let { user, type, startDate, endDate, searchId, partnerShipRoleName, page, limit, isRacing } = req.body;
    user = user || req.user;
    partnerShipRoleName = partnerShipRoleName || req.user?.roleName;

    let queryColumns = ``;
    let where = {
      eventType: type
    }

    if (!user) {
      return ErrorResponse(
        { statusCode: 400, message: { msg: "invalidData" } },
        req,
        res
      );
    }
    queryColumns = await getQueryColumns(user, partnerShipRoleName);
    let rateProfitLoss = `(Sum(CASE WHEN placeBet.result = '${betResultStatus.LOSS}' and (placeBet.marketBetType = '${marketBetType.MATCHBETTING}' or placeBet.marketBetType = '${marketBetType.RACING}') then ROUND(placeBet.lossAmount / 100 * ${queryColumns}, 2) ELSE 0 END) - Sum(CASE WHEN placeBet.result = '${betResultStatus.WIN}' and (placeBet.marketBetType = '${marketBetType.MATCHBETTING}' or placeBet.marketBetType = '${marketBetType.RACING}') then ROUND(placeBet.winAmount / 100 * ${queryColumns}, 2) ELSE 0 END)) as "rateProfitLoss"`;
    let sessionProfitLoss = `(Sum(CASE WHEN placeBet.result = '${betResultStatus.LOSS}' and (placeBet.marketBetType = '${marketBetType.SESSION}') then ROUND(placeBet.lossAmount / 100 * ${queryColumns}, 2) ELSE 0 END) - Sum(CASE WHEN placeBet.result = '${betResultStatus.WIN}' and (placeBet.marketBetType = '${marketBetType.SESSION}' ) then ROUND(placeBet.winAmount / 100 * ${queryColumns}, 2) ELSE 0 END)) as "sessionProfitLoss"`;

    if (req?.user?.roleName == userRoleConstant.user) {
      rateProfitLoss = '-' + rateProfitLoss;
      sessionProfitLoss = '-' + sessionProfitLoss;
    }
    let totalDeduction = `SUM(CASE WHEN placeBet.result = 'WIN' AND placeBet.bettingName = '${matchOddName}' THEN ROUND(placeBet.winAmount / 100, 2) ELSE 0 END) as "totalDeduction"`;
    let subQuery = await childIdquery(user, searchId);
    let result, count;
    if (isRacing) {
      const data = await getAllRacinMatchTotalProfitLoss(where, startDate, endDate, [sessionProfitLoss, rateProfitLoss, totalDeduction], page, limit, subQuery);
      result = data.result;
      count = data.count;
    }
    else {
      const data = await getAllMatchTotalProfitLoss(where, startDate, endDate, [sessionProfitLoss, rateProfitLoss, totalDeduction], page, limit, subQuery);
      result = data.result;
      count = data.count;
    }

    return SuccessResponse(
      {
        statusCode: 200, data: { result, count }
      },
      req,
      res
    );
  } catch (error) {
    logger.error({
      context: `error in get total domain wise profit loss`,
      error: error.message,
      stake: error.stack,
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

exports.totalProfitLossCardsWallet = async (req, res) => {
  try {
    let { user, startDate, endDate, runnerId, searchId, partnerShipRoleName } = req.body;
    user = user || req.user;
    partnerShipRoleName = partnerShipRoleName || req.user?.roleName;
    let totalLoss;
    let queryColumns = ``;
    let where = {}


    if (runnerId) {
      where.runnerId = runnerId
    }

    if (!user) {
      return ErrorResponse(
        { statusCode: 400, message: { msg: "invalidData" } },
        req,
        res
      );
    }
    queryColumns = await getQueryColumns(user, partnerShipRoleName);
    totalLoss = `(Sum(CASE WHEN placeBet.result = 'LOSS' then ROUND(placeBet.lossAmount / 100 * ${queryColumns}, 2) ELSE 0 END) - Sum(CASE WHEN placeBet.result = 'WIN' then ROUND(placeBet.winAmount / 100 * ${queryColumns}, 2) ELSE 0 END)) as "totalLoss"`;

    if (user.roleName == userRoleConstant.user) {
      totalLoss = '-' + totalLoss;
    }
    let subQuery = await childIdquery(user, searchId)
    const result = await getTotalProfitLossCard(where, startDate, endDate, totalLoss, subQuery);
    return SuccessResponse(
      {
        statusCode: 200, data: result
      },
      req,
      res
    );
  } catch (error) {
    logger.error({
      context: `error in get total profit loss cards.`,
      error: error.message,
      stake: error.stack,
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

exports.totalProfitLossByRoundCards = async (req, res) => {
  try {
    let { user, matchId, startDate, endDate, searchId, partnerShipRoleName } = req.body;
    user = user || req.user;
    partnerShipRoleName = partnerShipRoleName || req.user?.roleName;

    let queryColumns = ``;
    let where = {
      matchId: matchId
    }

    if (!user) {
      return ErrorResponse(
        { statusCode: 400, message: { msg: "invalidData" } },
        req,
        res
      );
    }
    queryColumns = await getQueryColumns(user, partnerShipRoleName);
    let rateProfitLoss = `(Sum(CASE WHEN placeBet.result = '${betResultStatus.LOSS}' and (placeBet.betType = '${betType.BACK}' or placeBet.betType = '${betType.LAY}') then ROUND(placeBet.lossAmount / 100 * ${queryColumns}, 2) ELSE 0 END) - Sum(CASE WHEN placeBet.result = '${betResultStatus.WIN}' and (placeBet.betType = '${betType.BACK}' or placeBet.betType = '${betType.LAY}') then ROUND(placeBet.winAmount / 100 * ${queryColumns}, 2) ELSE 0 END)) as "rateProfitLoss"`;

    if (req?.user?.roleName == userRoleConstant.user) {
      rateProfitLoss = '-' + rateProfitLoss;
    }
    let subQuery = await childIdquery(user, searchId);

    const data = await getAllCardMatchTotalProfitLoss(where, startDate, endDate, [rateProfitLoss],subQuery);
    const result = data.result;

    return SuccessResponse(
      {
        statusCode: 200, data: { result }
      },
      req,
      res
    );
  } catch (error) {
    logger.error({
      context: `error in get total domain wise profit loss`,
      error: error.message,
      stake: error.stack,
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

exports.getCardResultBetProfitLoss = async (req, res) => {
  try {
    let { user, runnerId, searchId, partnerShipRoleName } = req.body;
    user = user || req.user;
    partnerShipRoleName = partnerShipRoleName || req.user?.roleName;
    let where = {};
    let queryColumns = ``;

    if (runnerId) {
      where.runnerId = runnerId;
    }

    if (!user) {
      return ErrorResponse(
        { statusCode: 400, message: { msg: "invalidData" } },
        req,
        res
      );
    }
    queryColumns = await getQueryColumns(user, partnerShipRoleName);
    let totalLoss = `(Sum(CASE WHEN placeBet.result = '${betResultStatus.LOSS}' then ROUND(placeBet.lossAmount / 100 * ${queryColumns}, 2) ELSE 0 END) - Sum(CASE WHEN placeBet.result = '${betResultStatus.WIN}' then ROUND(placeBet.winAmount / 100 * ${queryColumns}, 2) ELSE 0 END)) as "totalLoss"`;

    if (req?.user?.roleName == userRoleConstant.user) {
      totalLoss = '-' + totalLoss;
    }
    let subQuery = await childIdquery(user, searchId);
    const domainUrl = `${req.protocol}://${req.get('host')}`;

    const result = await getBetsProfitLoss(where, totalLoss, subQuery, domainUrl);
    return SuccessResponse(
      {
        statusCode: 200, data: result
      },
      req,
      res
    );
  } catch (error) {
    logger.error({
      context: `Error in get card bet profit loss.`,
      error: error.message,
      stake: error.stack,
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

exports.getResultBetProfitLoss = async (req, res) => {
  try {
    let { user, matchId, betId, isSession, searchId, partnerShipRoleName } = req.body;
    user = user || req.user;
    partnerShipRoleName = partnerShipRoleName || req.user?.roleName;

    let queryColumns = ``;
    let where = { marketBetType: isSession ? marketBetType.SESSION : In([marketBetType.MATCHBETTING, marketBetType.RACING]) };

    if (matchId) {
      where.matchId = matchId;
    }
    if (betId) {
      where.betId = betId;
    }

    if (!user) {
      return ErrorResponse(
        { statusCode: 400, message: { msg: "invalidData" } },
        req,
        res
      );
    }
    queryColumns = await getQueryColumns(user, partnerShipRoleName);
    let totalLoss = `(Sum(CASE WHEN placeBet.result = '${betResultStatus.LOSS}' then ROUND(placeBet.lossAmount / 100 * ${queryColumns}, 2) ELSE 0 END) - Sum(CASE WHEN placeBet.result = '${betResultStatus.WIN}' then ROUND(placeBet.winAmount / 100 * ${queryColumns}, 2) ELSE 0 END)) as "totalLoss"`;

    if (req?.user?.roleName == userRoleConstant.user) {
      totalLoss = '-' + totalLoss;
    }
    let subQuery = await childIdquery(user, searchId);
    const domainUrl = `${req.protocol}://${req.get('host')}`;

    const result = await getBetsProfitLoss(where, totalLoss, subQuery, domainUrl);
    return SuccessResponse(
      {
        statusCode: 200, data: result
      },
      req,
      res
    );
  } catch (error) {
    logger.error({
      context: `Error in get bet profit loss.`,
      error: error.message,
      stake: error.stack,
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

exports.getSessionBetProfitLoss = async (req, res) => {
  try {
    let { user, matchId, searchId, partnerShipRoleName } = req.body;
    user = user || req.user;
    partnerShipRoleName = partnerShipRoleName || req.user?.roleName;

    let queryColumns = ``;
    let where = { marketBetType: marketBetType.SESSION, matchId: matchId };


    if (!user) {
      return ErrorResponse(
        { statusCode: 400, message: { msg: "invalidData" } },
        req,
        res
      );
    }
    queryColumns = await getQueryColumns(user, partnerShipRoleName);
    let totalLoss = `(Sum(CASE WHEN placeBet.result = '${betResultStatus.LOSS}' then ROUND(placeBet.lossAmount / 100 * ${queryColumns}, 2) ELSE 0 END) - Sum(CASE WHEN placeBet.result = '${betResultStatus.WIN}' then ROUND(placeBet.winAmount / 100 * ${queryColumns}, 2) ELSE 0 END)) as "totalLoss"`;

    if (req?.user?.roleName == userRoleConstant.user) {
      totalLoss = '-' + totalLoss;
    }
    let subQuery = await childIdquery(user, searchId);
    const result = await getSessionsProfitLoss(where, totalLoss, subQuery);
    return SuccessResponse(
      {
        statusCode: 200, data: result
      },
      req,
      res
    );
  } catch (error) {
    logger.error({
      context: `Error in get session profit loss.`,
      error: error.message,
      stake: error.stack,
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
const getQueryColumns = async (user, partnerShipRoleName) => {
  return partnerShipRoleName ? await profitLossPercentCol({ roleName: partnerShipRoleName }) : await profitLossPercentCol(user);
}

exports.getQueryColumns=getQueryColumns;

exports.getUserWiseTotalProfitLoss = async (req, res) => {
  try {
    let { user, matchId, searchId, userIds, partnerShipRoleName, runnerId } = req.body;
    user = user || req.user;

    let queryColumns = ``;
    let where = {};

    if (matchId) {
      where.matchId = matchId;
    }
    if(runnerId){
      where.runnerId = runnerId;
    }

    if (!user) {
      return ErrorResponse(
        { statusCode: 400, message: { msg: "invalidData" } },
        req,
        res
      );
    }
    queryColumns = await profitLossPercentCol(partnerShipRoleName ? { roleName: partnerShipRoleName } : user, queryColumns);
    let totalLoss = `(-Sum(CASE WHEN placeBet.result = '${betResultStatus.LOSS}' then ROUND(placeBet.lossAmount / 100 * ${queryColumns}, 2) ELSE 0 END) + Sum(CASE WHEN placeBet.result = '${betResultStatus.WIN}' then ROUND(placeBet.winAmount / 100 * ${queryColumns}, 2) ELSE 0 END)) as "totalLoss"`;
    let rateProfitLoss = `(Sum(CASE WHEN placeBet.result = '${betResultStatus.LOSS}' and (placeBet.marketBetType = '${marketBetType.MATCHBETTING}' or placeBet.marketBetType = '${marketBetType.RACING}') then ROUND(placeBet.lossAmount / 100 * ${queryColumns}, 2) ELSE 0 END) - Sum(CASE WHEN placeBet.result = '${betResultStatus.WIN}' and (placeBet.marketBetType = '${marketBetType.MATCHBETTING}' or placeBet.marketBetType = '${marketBetType.RACING}') then ROUND(placeBet.winAmount / 100 * ${queryColumns}, 2) ELSE 0 END)) as "rateProfitLoss"`;
    let sessionProfitLoss = `(Sum(CASE WHEN placeBet.result = '${betResultStatus.LOSS}' and (placeBet.marketBetType = '${marketBetType.SESSION}') then ROUND(placeBet.lossAmount / 100 * ${queryColumns}, 2) ELSE 0 END) - Sum(CASE WHEN placeBet.result = '${betResultStatus.WIN}' and (placeBet.marketBetType = '${marketBetType.SESSION}') then ROUND(placeBet.winAmount / 100 * ${queryColumns}, 2) ELSE 0 END)) as "sessionProfitLoss"`;

    if (req?.user?.roleName == userRoleConstant.user) {
      rateProfitLoss = "-" + rateProfitLoss;
      sessionProfitLoss = "-" + sessionProfitLoss;
    }

    const getAllDirectUsers = searchId ?
      await getAllUsers({
        id: searchId,
      })
      : userIds ?
        await getAllUsers({
          id: In(userIds?.split(",")),
        })
        : (user.roleName == userRoleConstant.fairGameWallet || user.roleName == userRoleConstant.fairGameAdmin) ?
          await getUsersByWallet({
            superParentId: user.id,
            isDemo: false
          })
          :
          await getAllUsers({
            createBy: user.id,
            id: Not(user.id)
          });
    let result = [];
    for (let directUser of getAllDirectUsers) {
      let childrenId = await getChildsWithOnlyUserRole(directUser.id);

      childrenId = childrenId.map(item => item.id);
      if (!childrenId.length) {
        continue;
      }
      where.createBy = In(childrenId);

      const userData = await getUserWiseProfitLoss(where, [totalLoss, rateProfitLoss, sessionProfitLoss]);
      if (userData.totalLoss != null && userData.totalLoss != undefined) {
        result.push({ ...userData, userId: directUser.id, roleName: directUser.roleName, matchId: matchId, userName: directUser.userName });
      }
    }

    return SuccessResponse(
      {
        statusCode: 200, data: result
      },
      req,
      res
    );
  } catch (error) {
    logger.error({
      context: `Error in get bet profit loss.`,
      error: error.message,
      stake: error.stack,
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

exports.getBetCount = async (req, res) => {
  try {
    const parentId = req.query.parentId;
    const matchId = req.query.matchId;
    const result = await getBetsWithMatchId((parentId ? ` AND user.superParentId = '${parentId}'` : ""), (matchId ? { matchId: matchId } : {}));
    return SuccessResponse(
      {
        statusCode: 200, data: result
      },
      req,
      res
    );
  } catch (error) {
    logger.error({
      context: `Error in get bet count.`,
      error: error.message,
      stake: error.stack,
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

exports.getAllUserBalance = async (req, res) => {
  try {

    const { roleName } = req.query;
    const { id } = req.params;
    let balanceSum = {};
    if (roleName == userRoleConstant.fairGameWallet) {
      const demoUserId = await getAllUsers({ isDemo: true }, ["id"]);
      let childUsersBalances = await getAllUsersBalanceSum({ userId: Not(In(demoUserId?.map((item) => item?.id))) });
      balanceSum[id] = parseFloat(parseFloat(childUsersBalances?.balance).toFixed(2));
    }
    else if (roleName == userRoleConstant.fairGameAdmin) {
      let childUsersBalances = await getAllUsersBalanceSumByFgId(id);
      balanceSum[id] = parseFloat(parseFloat(childUsersBalances?.balance).toFixed(2));
    }
    else {
      balanceSum = {};
      for (let item of id?.split(",")) {
        let childUsersBalances = await getChildUserBalanceSum(item);
        balanceSum[item] = parseFloat(parseFloat(childUsersBalances?.[0]?.balance).toFixed(2));
      };
    }

    return SuccessResponse(
      {
        statusCode: 200, data: { balance: balanceSum }
      },
      req,
      res
    );
  } catch (error) {
    logger.error({
      context: `Error in get all user balance.`,
      error: error.message,
      stake: error.stack,
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

exports.getUsersProfitLoss = async (req, res) => {
  try {
    const { userIds } = req.query;
    const { matchId } = req.params;

    const resUserData = [];
    let markets = {};

    for (let userData of userIds?.split("|")) {
      userData = JSON.parse(userData);
      let userProfitLossData = {};


      let betsData = await getUserProfitLossForUpperLevel(userData, matchId);
      // userProfitLossData = {
      //   teamRateA: betsData?.[redisKeys.userTeamARate + matchId] ? -parseFloat(betsData?.[redisKeys.userTeamARate + matchId]).toFixed(2) : 0, teamRateB: betsData?.[redisKeys.userTeamBRate + matchId] ? -parseFloat(betsData?.[redisKeys.userTeamBRate + matchId]).toFixed(2) : 0, teamRateC: betsData?.[redisKeys.userTeamCRate + matchId] ? -parseFloat(betsData?.[redisKeys.userTeamCRate + matchId]).toFixed(2) : 0,
      //   percentTeamRateA: betsData?.[redisKeys.userTeamARate + matchId] ? parseFloat(parseFloat(parseFloat(betsData?.[redisKeys.userTeamARate + matchId]).toFixed(2)) * parseFloat(userData.partnerShip) / 100).toFixed(2) : 0, percentTeamRateB: betsData?.[redisKeys.userTeamBRate + matchId] ? parseFloat(parseFloat(parseFloat(betsData?.[redisKeys.userTeamBRate + matchId]).toFixed(2)) * parseFloat(userData.partnerShip) / 100).toFixed(2) : 0, percentTeamRateC: betsData?.[redisKeys.userTeamCRate + matchId] ? parseFloat(parseFloat(parseFloat(betsData?.[redisKeys.userTeamCRate + matchId]).toFixed(2)) * parseFloat(userData.partnerShip) / 100).toFixed(2) : 0
      // }
      Object.keys(betsData || {}).forEach((item) => {
        markets[item]={ betId: item, name: betsData[item]?.name };
        Object.keys(betsData[item].teams || {})?.forEach((teams) => {
          betsData[item].teams[teams].pl = {
            rate: betsData[item].teams?.[teams]?.pl,
            percent: parseFloat(parseFloat(parseFloat(betsData[item].teams?.[teams]?.pl).toFixed(2)) * parseFloat(userData.partnerShip) / 100).toFixed(2)
          }
        })
      });
      userProfitLossData.userName = userData?.userName;
      userProfitLossData.profitLoss = betsData;

      if (Object.keys(betsData || {}).length > 0) {
        resUserData.push(userProfitLossData);
      }
    }
    return SuccessResponse(
      {
        statusCode: 200, data: { profitLoss: resUserData, markets: Object.values(markets) }
      },
      req,
      res
    );
  } catch (error) {
    logger.error({
      context: `Error in get profit loss user data.`,
      error: error.message,
      stake: error.stack,
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

exports.checkUserBalance = async (req, res) => {
  try {
    const { roleName, id } = req.body;

    if (roleName == userRoleConstant.fairGameAdmin) {
      const childUsers = await getMultipleUsersWithUserBalances({ superParentId: id });
      for (let childData of childUsers) {
        if (parseFloat(childData?.exposure || 0) != 0 || parseFloat(childData?.currentBalance || 0) != 0 || parseFloat(childData?.profitLoss || 0) != 0 || parseFloat(childData.creditRefrence || 0) != 0 || parseFloat(childData?.totalCommission || 0) != 0) {
          return ErrorResponse(
            { statusCode: 400, message: { msg: "settleAccount", keys: { name: childData?.userName } } }, req, res);
        }
        forceLogoutIfLogin(childData.id);
      }
    }
    else {
      const userData = await getUserDataWithUserBalance({ id: id });

      if (!userData) {
        return ErrorResponse({ statusCode: 400, message: { msg: "notFound", keys: { name: "User" } } }, req, res);
      }
      if (parseFloat(userData.userBal?.exposure || 0) != 0 || parseFloat(userData.userBal?.currentBalance || 0) != 0 || parseFloat(userData.userBal?.profitLoss || 0) != 0 || parseFloat(userData.creditRefrence || 0) != 0 || parseFloat(userData.userBal?.totalCommission || 0) != 0) {
        return ErrorResponse({ statusCode: 400, message: { msg: "settleAccount", keys: { name: "your" } } }, req, res);
      }

      const childUsers = await getChildUserBalanceAndData(id);
      for (let childData of childUsers) {
        if (parseFloat(childData?.exposure || 0) != 0 || parseFloat(childData?.currentBalance || 0) != 0 || parseFloat(childData?.profitLoss || 0) != 0 || parseFloat(childData.creditRefrence || 0) != 0 || parseFloat(childData?.totalCommission || 0) != 0) {
          return ErrorResponse({ statusCode: 400, message: { msg: "settleAccount", keys: { name: childData?.userName } } }, req, res);
        }
        forceLogoutIfLogin(childData.id);
      }
    }

    return SuccessResponse({ statusCode: 200 }, req, res);
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

exports.deleteWalletUsers = async (req, res) => {
  try {
    const { id } = req.params;
    const { roleName } = req.body;

    if (roleName == userRoleConstant.fairGameAdmin) {
      await deleteUserByDirectParent(id);
    }
    else {
      await softDeleteAllUsers(id);
    }

    return SuccessResponse({ statusCode: 200 }, req, res);
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

exports.getAllChildSearchList = async (req, res) => {
  try {
    const { roleName, userName, id, isUser } = req.query;

    let users = [];
    if (roleName == userRoleConstant.fairGameAdmin) {
      users = await getAllUsers({ superParentId: id, userName: ILike(`%${userName}%`), ...(isUser ? { roleName: userRoleConstant.user } : {}) }, ["id", "userName", "betBlock", "userBlock"]);
    }
    else {
      users = await getAllUsers({ userName: ILike(`%${userName}%`), isDemo: false, ...(isUser ? { roleName: userRoleConstant.user } : {}) }, ["id", "userName", "betBlock", "userBlock"]);
    }

    return SuccessResponse({ statusCode: 200, data: users }, req, res);
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

exports.declarCardMatchResult = async (req, res) => {
  try {
    const { result, matchDetails, type } = req.body;
    // await updatePlaceBet({ result: betResultStatus.PENDING, runnerId: Not(result?.mid), eventType: matchDetails?.type }, { result: betResultStatus.TIE });
    const betPlaced = await getMatchBetPlaceWithUserCard({ runnerId: result?.mid, result: betResultStatus.PENDING, });

    if (betPlaced?.length <= 0) {
      return SuccessResponse(
        {
          statusCode: 200,
          message: { msg: "bet.resultDeclared" },
          data: { fwProfitLoss: 0, faAdminCal: { userData: {} }, superAdminData: {} },
        }, req, res
      );
    }

    logger.info({
      message: "Card match result declared.",
      data: {
        result,
      },
    });

    let updateRecords = [];
    const userData = new Set();
    for (let item of betPlaced) {
      if (result.result == "noresult") {
        item.result = betResultStatus.TIE;
        item.lossAmount = item.lossAmount;
        item.winAmount = item.winAmount;
        updateRecords.push(item);
        userData.add(item?.user?.id);
      }
      else {
        const calculatedBetPlaceData = new CardWinOrLose(type, item?.teamName, result, item?.betType, item).getCardGameProfitLoss()
        item.result = calculatedBetPlaceData.result;
        item.lossAmount = calculatedBetPlaceData.lossAmount;
        item.winAmount = calculatedBetPlaceData.winAmount;
        updateRecords.push(item);
        userData.add(item?.user?.id);
      }

    }

    await addNewBet(updateRecords);


    let users = await getUserDataWithUserBalanceDeclare({ id: In([...userData]) });

    let upperUserObj = {};
    let bulkWalletRecord = [];

    const profitLossData = await calculateProfitLossCardMatchForUserDeclare(
      users,
      matchDetails?.id,
      0,
      socketData.cardResult,
      bulkWalletRecord,
      upperUserObj,
      result,
      matchDetails
    );

    insertBulkTransactions(bulkWalletRecord);
    logger.info({
      message: "Upper user for this bet.",
      data: { upperUserObj },
    });

    for (let [key, value] of Object.entries(upperUserObj)) {
      let parentUser = await getUserBalanceDataByUserId(key);

      let parentUserRedisData = await getUserRedisData(parentUser.userId);

      let parentProfitLoss = parentUser?.profitLoss || 0;
      if (parentUserRedisData?.profitLoss) {
        parentProfitLoss = parseFloat(parentUserRedisData.profitLoss);
      }
      let parentMyProfitLoss = parentUser?.myProfitLoss || 0;
      if (parentUserRedisData?.myProfitLoss) {
        parentMyProfitLoss = parseFloat(parentUserRedisData.myProfitLoss);
      }
      let parentExposure = parentUser?.exposure || 0;
      if (parentUserRedisData?.exposure) {
        parentExposure = parseFloat(parentUserRedisData?.exposure);
      }

      parentUser.profitLoss = parentProfitLoss + value?.["profitLoss"];
      parentUser.myProfitLoss = parentMyProfitLoss - value["myProfitLoss"];
      parentUser.exposure = parentExposure - value["exposure"];
      if (parentUser.exposure < 0) {
        logger.info({
          message: "Exposure in negative for user: ",
          data: {
            matchId: matchDetails?.id,
            parentUser,
          },
        });
        value["exposure"] += parentUser.exposure;
        parentUser.exposure = 0;
      }


      await updateUserBalanceData(key, {
        balance: 0,
        profitLoss: value?.["profitLoss"],
        myProfitLoss: -value["myProfitLoss"],
        exposure: -value["exposure"],
      });

      logger.info({
        message: "Declare result db update for parent ",
        data: {
          parentUser,
        },
      });
      if (parentUserRedisData?.exposure) {
        await incrementValuesRedis(key, {
          profitLoss: value?.["profitLoss"],
          myProfitLoss: -value["myProfitLoss"],
          exposure: -value["exposure"],
        });
        await deleteHashKeysByPattern(key, result?.mid + "*");
        await deleteKeyFromUserRedis(key, `${redisKeys.userMatchExposure}${result?.mid}`);

      }

      sendMessageToUser(key, socketData.matchResult, {
        ...parentUser,
        matchId: matchDetails?.id,
        betType: type
      });
    }
    // insertBulkCommissions(commissionReport);
    broadcastEvent(socketData.declaredMatchResultAllUser, { matchId: matchDetails?.id, gameType: type });
    return SuccessResponse(
      {
        statusCode: 200,
        message: { msg: "bet.resultDeclared" },
        data: profitLossData,
      },
      req,
      res
    );
  } catch (error) {
    logger.error({
      error: `Error at declare card match result for the user.`,
      stack: error.stack,
      message: error.message,
    });
    // Handle any errors and return an error response
    return ErrorResponse(error, req, res);
  }
};

const calculateProfitLossCardMatchForUserDeclare = async (users, matchId, fwProfitLoss, redisEventName, bulkWalletRecord, upperUserObj, result, matchData) => {

  let faAdminCal = {
    userData: {}
  };
  let superAdminData = {};

  for (let user of users) {
    user = { user: user };
    let getWinAmount = 0;
    let getLossAmount = 0;
    let profitLoss = 0;
    let userRedisData = await getUserRedisData(user.user.id);
    let getMultipleAmount = await getMultipleAccountCardMatchProfitLoss(result?.mid, user.user.id);

    Object.keys(getMultipleAmount)?.forEach((item) => {
      getMultipleAmount[item] = parseRedisData(item, getMultipleAmount);
    });

    let maxLoss = 0;
    logger.info({ message: "Updated users", data: user.user });
   
    // check if data is already present in the redis or not
    if (userRedisData?.[`${redisKeys.userMatchExposure}${result?.mid}`]) {
      maxLoss = (Math.abs(parseFloat(userRedisData?.[`${redisKeys.userMatchExposure}${result?.mid}`]))) || 0;
    }
    else {
      let resultData;
      if ([cardGameType.lucky7, cardGameType.lucky7eu].includes(matchData?.type)&&result?.result!="noresult") {
        const { desc } = result;
        const resultSplit = desc?.split("||")?.map((item) => (item.replace(/\s+/g, '')?.toLowerCase()));
        resultData = resultSplit?.[0]?.replace(/\s+/g, '')?.toLowerCase() == "tie" ? 7 : 0;
      }
      // if data is not available in the redis then get data from redis and find max loss amount for all placed bet by user
      let redisData = await calculateProfitLossForCardMatchToResult(user.user?.id, result?.mid, matchData?.type, null, null, resultData);
      maxLoss = redisData?.exposure;
    }

    user.user.userBalance.exposure = user.user.userBalance.exposure - maxLoss;

    logger.info({
      message: "Update user exposure.",
      data: user.user.userBalance.exposure
    });

    getWinAmount = getMultipleAmount.winAmount;
    getLossAmount = getMultipleAmount.lossAmount;

    profitLoss = parseFloat(getWinAmount.toString()) - parseFloat(getLossAmount.toString());

    fwProfitLoss = parseFloat(fwProfitLoss.toString()) + parseFloat(((-profitLoss * user.user.fwPartnership) / 100).toString());

    let userOriginalProfitLoss = profitLoss;

    const userCurrBalance = Number(user.user.userBalance.currentBalance + profitLoss).toFixed(2);
    let userBalanceData = {
      currentBalance: userCurrBalance,
      profitLoss: user.user.userBalance.profitLoss + profitLoss,
      myProfitLoss: user.user.userBalance.myProfitLoss + profitLoss,
      exposure: user.user.userBalance.exposure
    }

    await updateUserBalanceData(user.user.id, {
      profitLoss: profitLoss,
      myProfitLoss: profitLoss,
      exposure: -maxLoss,
    });

    if (userRedisData?.exposure) {

      await incrementValuesRedis(user.user.id, {
        profitLoss: profitLoss,
        myProfitLoss: profitLoss,
        exposure: -maxLoss,
        currentBalance: profitLoss
      });
    }

    sendMessageToUser(user.user.id, redisEventName, { ...user.user, matchId, userBalanceData });

    let currBal = user.user.userBalance.currentBalance;

    const transactions = [
      {
        winAmount: parseFloat(getMultipleAmount.winAmount),
        lossAmount: parseFloat(getMultipleAmount.lossAmount),
        type: "MATCH ODDS"
      }
    ];

    transactions.forEach((item, uniqueId) => {
      currBal = currBal + item.winAmount - item.lossAmount;

      bulkWalletRecord.push({
        type: transactionType.casino,
        matchId: matchId,
        actionBy: user.user.id,
        searchId: user.user.id,
        userId: user.user.id,
        amount: item.winAmount - item.lossAmount,
        transType: item.winAmount - item.lossAmount > 0 ? transType.win : transType.loss,
        closingBalance: currBal,
        description: `${matchData?.type}/${matchData?.name} Rno. ${result?.mid}/${matchData?.type} - ${new CardResultTypeWin(matchData?.type, result).getCardGameProfitLoss()} `,
        createdAt: new Date(),
        uniqueId: uniqueId,
      });
    });

    await deleteHashKeysByPattern(user.user.id, result?.mid + "*");
    await deleteKeyFromUserRedis(user.user.id, `${redisKeys.userMatchExposure}${result?.mid}`);

    if (user.user.createBy === user.user.id && !user.user.isDemo) {
      superAdminData[user.user.id] = {
        role: user.user.roleName,
        profitLoss: profitLoss,
        myProfitLoss: profitLoss,
        exposure: maxLoss,
      };
    }
    if (!user.user.isDemo) {
      let parentUsers = await getParentsWithBalance(user.user.id);

      for (const patentUser of parentUsers) {
        let upLinePartnership = 100;
        if (patentUser.roleName === userRoleConstant.superAdmin) {
          upLinePartnership = user.user.fwPartnership + user.user.faPartnership;
        } else if (patentUser.roleName === userRoleConstant.admin) {
          upLinePartnership = user.user.fwPartnership + user.user.faPartnership + user.user.saPartnership;
        } else if (patentUser.roleName === userRoleConstant.superMaster) {
          upLinePartnership = user.user.fwPartnership + user.user.faPartnership + user.user.saPartnership + user.user.aPartnership;
        } else if (patentUser.roleName === userRoleConstant.master) {
          upLinePartnership = user.user.fwPartnership + user.user.faPartnership + user.user.saPartnership + user.user.aPartnership + user.user.smPartnership;
        }
        else if (patentUser.roleName === userRoleConstant.agent) {
          upLinePartnership = user.user.fwPartnership + user.user.faPartnership + user.user.saPartnership + user.user.aPartnership + user.user.smPartnership + user.user.mPartnership;
        }

        let myProfitLoss = parseFloat(
          (((profitLoss) * upLinePartnership) / 100).toString()
        );

        if (upperUserObj[patentUser.id]) {
          upperUserObj[patentUser.id].profitLoss = upperUserObj[patentUser.id].profitLoss + profitLoss;
          upperUserObj[patentUser.id].myProfitLoss = upperUserObj[patentUser.id].myProfitLoss + myProfitLoss;
          upperUserObj[patentUser.id].exposure = upperUserObj[patentUser.id].exposure + maxLoss;

        } else {
          upperUserObj[patentUser.id] = { profitLoss: profitLoss, myProfitLoss: myProfitLoss, exposure: maxLoss };
        }

        if (patentUser.createBy === patentUser.id) {
          superAdminData[patentUser.id] = {
            ...upperUserObj[patentUser.id],
            role: patentUser.roleName,
          };
        }
      }

      faAdminCal.userData[user.user.superParentId] = {
        profitLoss: profitLoss + (faAdminCal.userData?.[user.user.superParentId]?.profitLoss || 0),
        exposure: maxLoss + (faAdminCal.userData?.[user.user.superParentId]?.exposure || 0),
        myProfitLoss: parseFloat((((faAdminCal.userData?.[user.user.superParentId]?.profitLoss || 0)) + ((profitLoss) * (user.user.superParentType == userRoleConstant.fairGameAdmin ? parseFloat(user.user.fwPartnership) : 1) / 100)).toFixed(2)),
        userOriginalProfitLoss: userOriginalProfitLoss + (faAdminCal.userData?.[user.user.superParentId]?.userOriginalProfitLoss || 0),
        role: user.user.superParentType
      }

      faAdminCal.fwWalletDeduction = 0;
    }
  };
  return { fwProfitLoss, faAdminCal, superAdminData };
}

exports.changeBetsDeleteReason = async (req, res) => {
  try {
    let { deleteReason, betIds, matchId } = req.body;

    await updatePlaceBet({ id: In(betIds), deleteReason: Not(IsNull()) }, { deleteReason: deleteReason });

    const userIds = await findAllPlacedBet({ id: In(betIds) }, ["createBy","id"]);

    const userWiseBetId = {};
    const walletWiseBetId = {};

    for(let item of userIds){
      if (!userWiseBetId?.[item?.createBy]) {
        let userRedisData = await getUserRedisData(item?.createBy);
        let isUserLogin = userRedisData ? true : false;
        let partnership = {};
        if (isUserLogin) {
          partnership = JSON.parse(userRedisData.partnerShips);
        }
        else {
          const user = await getUserById(item?.createBy, [
            "id",
            "roleName",
            "createBy",
          ]);
          partnership = await findUserPartnerShipObj(user);
          partnership = JSON.parse(partnership);
        }
        const adminIds = Object.values(partnershipPrefixByRole)?.filter((items) => !!partnership[`${items}PartnershipId`] && items != partnershipPrefixByRole[userRoleConstant.fairGameAdmin] && items != partnershipPrefixByRole[userRoleConstant.fairGameWallet])?.map((items) => partnership[`${items}PartnershipId`]);
        const superAdminIds = Object.keys(partnership)?.filter((items) => [`${partnershipPrefixByRole[userRoleConstant.fairGameAdmin]}PartnershipId`,`${partnershipPrefixByRole[userRoleConstant.fairGameWallet]}PartnershipId`].includes(items) )?.map((items) => partnership[items]);
        userWiseBetId[item?.createBy] = {
          bets: [],
          parent: adminIds,
          superParent: superAdminIds
        };
      }
      userWiseBetId?.[item?.createBy]?.bets?.push(item?.id);
      for (let parentItem of userWiseBetId?.[item?.createBy]?.parent) {
        if (!userWiseBetId?.[parentItem]) {
          userWiseBetId[parentItem] = { bets: [item?.id] };
        }
        else {
          userWiseBetId?.[parentItem]?.bets?.push(item?.id);

        }
      }
      for (let parentItem of userWiseBetId?.[item?.createBy]?.superParent) {
        if (!walletWiseBetId?.[parentItem]) {
          walletWiseBetId[parentItem] = { bets: [item?.id] };
        }
        else {
          walletWiseBetId?.[parentItem]?.bets?.push(item?.id);
        }
      }
    };

    Object.keys(userWiseBetId)?.forEach((item)=>{
      sendMessageToUser(item, socketData.updateDeleteReason, {
        betIds: userWiseBetId?.[item]?.bets,
        deleteReason: deleteReason,
        matchId: matchId
      });
    });

    return SuccessResponse({ statusCode: 200, message: { msg: "updated", keys: { name: "Delete bet reason" } }, data: walletWiseBetId }, req, res);
  } catch (err) {
    return ErrorResponse(err, req, res);
  }
};

exports.checkVerifiedBets = async (req, res) => {
  try {
    let { betId } = req.body;
    const betCount = await getBetCountData({ betId: betId, isVerified: false, deleteReason: IsNull() })
    return SuccessResponse({ statusCode: 200, message: { msg: "bet.isVerified" }, data: betCount }, req, res);

  } catch (error) {
    logger.error({
      error: `Error at get verify bet.`,
      stack: error.stack,
      message: error.message,
    });
    return ErrorResponse(error, req, res)
  }
}

exports.getSessionBetProfitLossExpert = async (req, res) => {
  try {
    let { betId } = req.body;

    let queryColumns = ``;
    let where = { betId: betId };

    queryColumns = await profitLossPercentCol({roleName:userRoleConstant.fairGameWallet}, queryColumns);
    let sessionProfitLoss = `(Sum(CASE WHEN placeBet.result = '${betResultStatus.LOSS}' and (placeBet.marketBetType = '${marketBetType.SESSION}') then ROUND(placeBet.lossAmount / 100 * ${queryColumns}, 2) ELSE 0 END) - Sum(CASE WHEN placeBet.result = '${betResultStatus.WIN}' and (placeBet.marketBetType = '${marketBetType.SESSION}') then ROUND(placeBet.winAmount / 100 * ${queryColumns}, 2) ELSE 0 END)) as "sessionProfitLoss", COUNT(placeBet.id) as "totalBet"`;

    const userData = await getUserSessionsProfitLoss(where, [sessionProfitLoss, 'user.userName as "userName"', 'user.id as "userId"']);

    return SuccessResponse(
      {
        statusCode: 200, data: userData
      },
      req,
      res
    );
  } catch (error) {
    logger.error({
      context: `Error in get bet profit loss.`,
      error: error.message,
      stake: error.stack,
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
