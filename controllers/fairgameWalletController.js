const { IsNull, In, MoreThan, ILike, Not } = require("typeorm");
const {
  transType,
  walletDescription,
  userRoleConstant,
  socketData,
  betType,
  betResultStatus,
  redisKeys,
  partnershipPrefixByRole,
  resultType,
  matchBettingType,
  tiedManualTeamName,
  marketBetType,
  matchComissionTypeConstant,
  buttonType,
  defaultButtonValue,
  sessiontButtonValue,
  tieCompleteBetType,
  mainMatchMarketType,
  otherEventMatchBettingRedisKey,
  redisKeysMarketWise,
  scoreBasedMarket,
  profitLossKeys,
  racingBettingType,
} = require("../config/contants");
const { logger } = require("../config/logger");
const { getMatchBetPlaceWithUser, addNewBet, getMultipleAccountProfitLoss, getDistinctUserBetPlaced, findAllPlacedBetWithUserIdAndBetId, updatePlaceBet, getBet, getMultipleAccountMatchProfitLoss, getTotalProfitLoss, getAllMatchTotalProfitLoss, getBetsProfitLoss, getSessionsProfitLoss, getBetsWithMatchId, findAllPlacedBet, getUserWiseProfitLoss, getMultipleAccountOtherMatchProfitLoss, getTotalProfitLossRacing, getAllRacinMatchTotalProfitLoss } = require("../services/betPlacedService");
const {
  forceLogoutUser,
  calculateProfitLossForSessionToResult,
  calculatePLAllBet,
  calculateProfitLossSession,
  calculateProfitLossForMatchToResult,
  profitLossPercentCol,
  getUserProfitLossForUpperLevel,
  forceLogoutIfLogin,
  insertBulkTransactions,
  insertBulkCommissions,
  childIdquery,
  calculateProfitLossForOtherMatchToResult,
  extractNumbersFromString,
  parseRedisData,
  calculateProfitLossForRacingMatchToResult,
  getUserProfitLossRacingForUpperLevel
} = require("../services/commonService");
const {
  updateDomainData,
  addDomainData,
  getDomainDataByDomain,
  getDomainDataByUserId,
} = require("../services/domainDataService");
const { updateUserDataRedis, hasUserInCache, getUserRedisData, deleteKeyFromUserRedis, incrementValuesRedis } = require("../services/redis/commonfunction");
const { insertTransactions } = require("../services/transactionService");
const {
  addInitialUserBalance,
  getUserBalanceDataByUserId,
  updateUserBalanceByUserId,
  getAllUsersBalanceSum,
  updateUserBalanceData,
  updateUserExposure,
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
  getAllUsersByRole,
  getChildsWithOnlyUserRole,
  getUsers,
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
} = require("../services/userService");
const { sendMessageToUser, broadcastEvent } = require("../sockets/socketManager");
const { ErrorResponse, SuccessResponse } = require("../utils/response");
const { insertCommissions, getCombinedCommission, deleteCommission} = require("../services/commissionService");
const { insertButton } = require("../services/buttonService");
const { updateMatchData } = require("../services/matchService");
const { updateRaceMatchData } = require("../services/racingServices");



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
      sessionCommission,
      matchComissionType,
      matchCommission,
      superParentType,
      superParentId,
      remark,
      delayTime
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
      delayTime: delayTime || 2,
      ...(isOldFairGame ? {
        sessionCommission,
        matchComissionType,
        matchCommission
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

      if (parseFloat(userBalanceData.myProfitLoss) + parseFloat(amount) > 0) {
        updateData.myProfitLoss = 0;
      }
      else {
        updateData.myProfitLoss = parseFloat(userBalanceData.myProfitLoss) + parseFloat(amount);
      }

      await updateUserBalanceByUserId(user.id, updateData);
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

      if (parseFloat(userBalanceData.myProfitLoss) - parseFloat(amount) < 0) {
        updateData.myProfitLoss = 0;
      }
      else {
        updateData.myProfitLoss = parseFloat(userBalanceData.myProfitLoss) - parseFloat(amount);
      }

      await updateUserBalanceByUserId(user.id, updateData);
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
      if (
        childUser.exposureLimit > exposureLimit ||
        childUser.exposureLimit == 0
      ) {
        childUser.exposureLimit = exposureLimit;
        await addUser(childUser);
      }
    });
    await addUser(user);
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
    await updateUserBalanceByUserId(user.id, { profitLoss });
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

exports.declareSessionResult = async (req, res) => {
  try {

    const { betId, score, matchId, sessionDetails, userId, match } = req.body;

    const betPlaced = await getMatchBetPlaceWithUser([betId]);

    logger.info({
      message: "Session result declared.",
      data: {
        betId, score
      }
    });

    let updateRecords = [];
    let commissions = {};
    let bulkCommission = {};

    for (let item of betPlaced) {
      if ((item.betType == betType.YES && item.odds <= score) || (item.betType == betType.NO && item.odds > score)) {
        item.result = betResultStatus.WIN;
      } else if ((item.betType == betType.YES && item.odds > score) || (item.betType == betType.NO && item.odds <= score)) {
        item.result = betResultStatus.LOSS;
      }

      if (item.user['sessionCommission'] != 0 && item.user['sessionCommission'] != null) {
        let commissionAmount = Number((parseFloat(item.amount) * (parseFloat(item.user['sessionCommission']) / 100)).toFixed(2));
        commissionAmount = Math.abs(commissionAmount);
        if (commissions[item?.user?.id]) {
          commissions[item?.user?.id] = parseFloat(commissions[item?.user?.id]) + parseFloat(commissionAmount);
        } else {

          commissions[item?.user?.id] = commissionAmount;
        }
      }
      bulkCommission[item?.user?.id] = [...(bulkCommission[item?.user?.id] || []),
      {
        matchId: matchId,
        betId: betId,
        betPlaceId: item?.id,
        amount: item?.amount,
        sessionName: item?.eventName,
        betPlaceDate: item?.createdAt,
        odds: item?.odds,
        betType: item?.betType,
        stake: item?.amount,
        superParent: item?.user?.superParentId,
        userName: item?.user.userName
      }
      ];

      updateRecords.push(item);
    }

    await addNewBet(updateRecords);

    let users = await getDistinctUserBetPlaced(betId);

    let upperUserObj = {};
    let bulkWalletRecord = [];
    let commissionReport = [];
    const profitLossData = await calculateProfitLossSessionForUserDeclare(
      users,
      betId,
      matchId,
      0,
      sessionDetails,
      socketData.sessionResult,
      userId,
      bulkWalletRecord,
      upperUserObj,
      score,
      commissions,
      bulkCommission,
      commissionReport,
      match
    );

    insertBulkTransactions(bulkWalletRecord);
    logger.info({
      message: "Upper user for this bet.",
      data: { upperUserObj, betId }
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
      parentUser.totalCommission = (parentUser.totalCommission || 0) + (value["totalCommission"] || 0);
      if (parentUser.exposure < 0) {
        logger.info({
          message: "Exposure in negative for user: ",
          data: {
            betId,
            matchId,
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
        totalCommission: value["totalCommission"] || 0
      });

      logger.info({
        message: "Declare result db update for parent ",
        data: {
          betId,
          parentUser,
        },
      });

      const redisSessionExposureName = redisKeys.userSessionExposure + matchId;

      if (parentUserRedisData?.exposure) {
        await incrementValuesRedis(key, {
          profitLoss: value?.["profitLoss"],
          myProfitLoss: -value["myProfitLoss"],
          exposure: -value["exposure"],
          [redisSessionExposureName]: -value["exposure"]
        });
        await deleteKeyFromUserRedis(key, betId + "_profitLoss");
      }

      sendMessageToUser(key, socketData.sessionResult, {
        ...parentUser,
        betId,
        matchId
      });
    }
    insertBulkCommissions(commissionReport);

    return SuccessResponse(
      {
        statusCode: 200,
        message: { msg: "bet.resultDeclared" },
        data: profitLossData
      },
      req,
      res
    );


  } catch (error) {
    logger.error({
      error: `Error at declare session result for the user.`,
      stack: error.stack,
      message: error.message,
    });
    // Handle any errors and return an error response
    return ErrorResponse(error, req, res);
  }
}

const calculateProfitLossSessionForUserDeclare = async (users, betId, matchId, fwProfitLoss, resultDeclare, redisEventName, userId, bulkWalletRecord, upperUserObj, score, commission, bulkCommission, commissionReport, match) => {

  let faAdminCal = {
    commission: [],
    userData: {}
  };
  let superAdminData = {};

  for (const user of users) {
    let description = '';
    let getWinAmount = 0;
    let getLossAmount = 0;
    let profitLoss = 0;
    let transTypes;
    let userRedisData = await getUserRedisData(user.user.id);
    let getMultipleAmount = await getMultipleAccountProfitLoss(betId, user.user.id);
    let maxLoss = 0;
    let redisSesionExposureValue = 0;
    let redisSesionExposureName = redisKeys.userSessionExposure + matchId;
    redisSesionExposureValue = parseFloat(userRedisData?.[redisSesionExposureName] || 0);
    logger.info({ message: "Updated users", data: user.user });
    logger.info({
      redisSessionExposureValue: redisSesionExposureValue,
      sessionBet: true,
    });

    // check if data is already present in the redis or not
    if (userRedisData?.[betId + '_profitLoss']) {
      let redisData = JSON.parse(userRedisData[betId + '_profitLoss']);
      maxLoss = redisData.maxLoss || 0;
    } else {
      // if data is not available in the redis then get data from redis and find max loss amount for all placed bet by user
      let redisData = await calculateProfitLossForSessionToResult(betId, user.user?.id);
      maxLoss = redisData.maxLoss || 0;
    }
    redisSesionExposureValue = redisSesionExposureValue - maxLoss;

    logger.info({
      maxLoss: maxLoss,
      userSessionExposure: redisSesionExposureValue
    });
    user.user.userBalance.exposure = user.user.userBalance.exposure - maxLoss;

    logger.info({
      message: "Update user exposure.",
      data: user.user.exposure
    });

    getWinAmount = getMultipleAmount[0].winamount;
    getLossAmount = getMultipleAmount[0].lossamount;
    let totalStack = getMultipleAmount[0].totalStack;
    profitLoss = parseFloat(getWinAmount.toString()) - parseFloat(getLossAmount.toString());

    fwProfitLoss = parseFloat(fwProfitLoss.toString()) + parseFloat(((-profitLoss * user.user.fwPartnership) / 100).toString());

    if (profitLoss > 0) {
      transTypes = transType.win;
      description = `${user?.eventType}/${user?.eventName}/${resultDeclare?.type}-${score}`;
    } else {
      transTypes = transType.loss;
      description = `${user?.eventType}/${user?.eventName}/${resultDeclare?.type}-${score}`;
    }

    const userCurrBalance = Number(user.user.userBalance.currentBalance + profitLoss).toFixed(2);
    let userBalanceData = {
      profitLoss: profitLoss,
      myProfitLoss: profitLoss,
      exposure: -maxLoss
    };

    if (commission[user.user.id]) {
      userBalanceData.totalCommission = Number((parseFloat(commission[user.user.id])).toFixed(2));
    }
    await updateUserBalanceData(user.user.id, userBalanceData);

    if (userRedisData?.exposure) {
      let { totalCommission, ...userBalance } = userBalanceData;
      await incrementValuesRedis(user.user.id, {
        ...userBalance,
        currentBalance: profitLoss,
        [redisSesionExposureName]: -maxLoss
      });
      await deleteKeyFromUserRedis(user.user.id, betId + "_profitLoss");
    }

    if (user?.user?.sessionCommission) {

      bulkCommission[user?.user?.id]?.forEach((item) => {
        commissionReport.push({
          createBy: user.user.id,
          matchId: item.matchId,
          betId: item?.betId,
          betPlaceId: item?.betPlaceId,
          commissionAmount: parseFloat((parseFloat(item?.amount) * parseFloat(user?.user?.sessionCommission) / 100).toFixed(2)),
          parentId: user.user.id,
        });
      });

      if (user?.user?.id == user?.user?.createBy) {
        bulkCommission[user?.user?.id]?.forEach((item) => {
          faAdminCal.commission.push({
            createBy: user.user.id,
            matchId: item.matchId,
            betId: item?.betId,
            betPlaceId: item?.betPlaceId,
            parentId: user.user.id,
            teamName: item?.sessionName,
            betPlaceDate: new Date(item?.betPlaceDate),
            odds: item?.odds,
            betType: item?.betType,
            stake: item?.stake,
            commissionAmount: parseFloat((parseFloat(item?.amount) * parseFloat(user?.user?.sessionCommission) / 100).toFixed(2)),
            partnerShip: 100,
            matchName: match?.title,
            matchStartDate: new Date(match?.startAt),
            userName: user.user.userName
          });
        });
      }
    }

    sendMessageToUser(user.user.id, redisEventName, {
      ...user.user, betId, matchId, sessionExposure: redisSesionExposureValue, userBalanceData: {
        profitLoss: parseFloat(parseFloat(parseFloat(user.user.userBalance.profitLoss) + parseFloat(profitLoss)).toFixed(2)),
        myProfitLoss: parseFloat(parseFloat(parseFloat(user.user.userBalance.myProfitLoss) + parseFloat(profitLoss)).toFixed(2)),
        exposure: parseFloat(parseFloat(parseFloat(user.user.userBalance.exposure))),
        currentBalance: parseFloat(parseFloat(parseFloat(user.user.userBalance.currentBalance) + parseFloat(profitLoss)).toFixed(2))
      }
    });

    bulkWalletRecord.push(
      {
        matchId: matchId,
        actionBy: userId,
        searchId: user.user.id,
        userId: user.user.id,
        amount: profitLoss,
        transType: transTypes,
        closingBalance: userCurrBalance,
        description: description,
        betId: [betId]
      }
    );

    if (user.user.createBy === user.user.id) {
      superAdminData[user.user.id] = {
        role: user.user.roleName,
        profitLoss: profitLoss,
        myProfitLoss: profitLoss,
        exposure: maxLoss,
        totalCommission: (commission[user.user.id] || 0)
      };
    }


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
        ((profitLoss * upLinePartnership) / 100).toString()
      );

      let parentCommission = parseFloat((((parseFloat(patentUser?.sessionCommission) * parseFloat(totalStack)) / 10000) * parseFloat(upLinePartnership)).toFixed(2));

      if (upperUserObj[patentUser.id]) {
        upperUserObj[patentUser.id].profitLoss = upperUserObj[patentUser.id].profitLoss + profitLoss;
        upperUserObj[patentUser.id].myProfitLoss = upperUserObj[patentUser.id].myProfitLoss + myProfitLoss;
        upperUserObj[patentUser.id].exposure = upperUserObj[patentUser.id].exposure + maxLoss;

        if (patentUser?.sessionCommission && parseFloat(patentUser?.sessionCommission) != 0) {
          upperUserObj[patentUser.id].totalCommission += parentCommission;
        }
      } else {
        upperUserObj[patentUser.id] = { profitLoss: profitLoss, myProfitLoss: myProfitLoss, exposure: maxLoss, ...(patentUser?.sessionCommission && parseFloat(patentUser?.sessionCommission) != 0 ? { totalCommission: parentCommission } : {}) };
      }

      if (patentUser.createBy === patentUser.id) {
        superAdminData[patentUser.id] = {
          ...upperUserObj[patentUser.id],
          role: patentUser.roleName,
        };
      }

      if (patentUser?.sessionCommission) {

        bulkCommission[user?.user?.id]?.forEach((item) => {
          commissionReport.push({
            createBy: user.user.id,
            matchId: item.matchId,
            betId: item?.betId,
            betPlaceId: item?.betPlaceId,
            commissionAmount: parseFloat((parseFloat(item?.amount) * parseFloat(patentUser?.sessionCommission) / 100).toFixed(2)),
            parentId: patentUser.id,
          });
        });

        if (patentUser?.id == patentUser?.createBy) {
          bulkCommission[user?.user?.id]?.forEach((item) => {
            faAdminCal.commission.push({
              createBy: user.user.id,
              matchId: item.matchId,
              betId: item?.betId,
              betPlaceId: item?.betPlaceId,
              parentId: patentUser.id,
              teamName: item?.sessionName,
              betPlaceDate: new Date(item?.betPlaceDate),
              odds: item?.odds,
              betType: item?.betType,
              stake: item?.stake,
              commissionAmount: parseFloat((parseFloat(item?.amount) * parseFloat(patentUser?.sessionCommission) / 100).toFixed(2)),
              partnerShip: upLinePartnership,
              matchName: match?.title,
              matchStartDate: new Date(match?.startAt),
              userName: user.user.userName
            });
          });
        }
      }
    }
    faAdminCal.userData[user.user.superParentId] = {
      profitLoss: profitLoss + (faAdminCal.userData?.[user.user.superParentId]?.profitLoss || 0),
      exposure: maxLoss + (faAdminCal.userData?.[user.user.superParentId]?.exposure || 0),
      myProfitLoss: parseFloat(faAdminCal.userData?.[user.user.superParentId]?.profitLoss || 0) + parseFloat(parseFloat((profitLoss) * (user.user.superParentType == userRoleConstant.fairGameAdmin ? (parseFloat(user.user.fwPartnership) / 100) : 1)).toFixed(2)),
      totalCommission: parseFloat((parseFloat(totalStack) * (user.user.superParentType == userRoleConstant.fairGameAdmin ? parseFloat(user.user.fwPartnership) / 100 : 1)).toFixed(2)) + (faAdminCal.userData?.[user.user.superParentId]?.totalCommission || 0),
      role: user.user.superParentType
    }

  };
  return { fwProfitLoss, faAdminCal, superAdminData, bulkCommission };
}

exports.declareSessionNoResult = async (req, res) => {
  try {

    const { betId, score, matchId } = req.body;


    logger.info({
      message: "Session no result declared.",
      data: {
        betId, score
      }
    });


    let users = await getDistinctUserBetPlaced(betId);

    await updatePlaceBet({ betId: betId }, { result: betResultStatus.TIE });

    let upperUserObj = {};
    const profitLossData = await calculateMaxLossSessionForUserNoResult(
      users,
      betId,
      matchId,
      socketData.sessionNoResult,
      upperUserObj
    );


    logger.info({
      message: "Upper user for this bet.",
      data: { upperUserObj, betId }
    })


    for (let [key, value] of Object.entries(upperUserObj)) {
      let parentUser = await getUserBalanceDataByUserId(key);

      let parentUserRedisData = await getUserRedisData(parentUser.userId);

      let parentExposure = parentUser?.exposure || 0;
      if (parentUserRedisData?.exposure) {
        parentExposure = parseFloat(parentUserRedisData?.exposure);
      }

      parentUser.exposure = parentExposure - value["exposure"];
      if (parentUser.exposure < 0) {
        logger.info({
          message: "Exposure in negative for user: ",
          data: {
            betId,
            matchId,
            parentUser,
          },
        });

        value["exposure"] += parentUser.exposure;
        parentUser.exposure = 0;
      }
      await updateUserExposure(key, -value["exposure"]);

      logger.info({
        message: "Declare result db update for parent ",
        data: {
          betId,
          parentUser,
        },
      });

      const redisSessionExposureName = redisKeys.userSessionExposure + matchId;

      if (
        parentUserRedisData?.exposure
      ) {
        await incrementValuesRedis(key, {
          [redisSessionExposureName]: -value["exposure"],
          exposure: -value["exposure"]
        });
        await deleteKeyFromUserRedis(key, betId + "_profitLoss");
      }
      sendMessageToUser(key, socketData.sessionResult, {
        ...parentUser,
        betId,
        matchId,
        sessionExposure: parentUserRedisData?.[redisSessionExposureName] - value["exposure"],
      });
    }


    return SuccessResponse(
      {
        statusCode: 200,
        message: { msg: "bet.resultDeclared" },
        data: profitLossData
      },
      req,
      res
    );


  } catch (error) {
    logger.error({
      error: `Error at declare session no result for the user.`,
      stack: error.stack,
      message: error.message,
    });
    // Handle any errors and return an error response
    return ErrorResponse(error, req, res);
  }
}

const calculateMaxLossSessionForUserNoResult = async (
  users,
  betId,
  matchId,
  redisEventName,
  upperUserObj
) => {
  let faAdminCal = {};
  let superAdminData = {};

  for (const user of users) {
    let userRedisData = await getUserRedisData(user.user.id);
    let maxLoss = 0;
    let redisSesionExposureValue = 0;
    let redisSesionExposureName = redisKeys.userSessionExposure + matchId;
    redisSesionExposureValue = parseFloat(
      userRedisData?.[redisSesionExposureName] || 0
    );

    logger.info({ message: "Updated users", data: user.user });
    logger.info({
      redisSessionExposureValue: redisSesionExposureValue,
      sessionBet: true,
    });

    // check if data is already present in the redis or not
    if (userRedisData?.[betId + "_profitLoss"]) {
      let redisData = JSON.parse(userRedisData[betId + "_profitLoss"]);
      maxLoss = redisData.maxLoss || 0;
    } else {
      // if data is not available in the redis then get data from redis and find max loss amount for all placed bet by user
      let redisData = await calculateProfitLossForSessionToResult(
        betId,
        user.user?.id
      );
      maxLoss = redisData.maxLoss || 0;
    }
    redisSesionExposureValue = redisSesionExposureValue - maxLoss;

    user.user.userBalance.exposure = user.user.userBalance.exposure - maxLoss;

    logger.info({
      message: "Update user exposure.",
      data: {
        userExposure: user.user.userBalance.exposure,
        maxLoss: maxLoss,
        userRedisExposure: redisSesionExposureValue,
      },
    });

    if (userRedisData?.exposure) {
      await incrementValuesRedis(user.user.id, {
        [redisSesionExposureName]: -maxLoss,
        exposure: -maxLoss
      });
      await deleteKeyFromUserRedis(user.user.id, betId + "_profitLoss");
    }

    await updateUserExposure(user.user.id, -maxLoss);

    if (user.user.createBy === user.user.id) {
      superAdminData[user.user.id] = { exposure: maxLoss };
    }

    sendMessageToUser(user.user.id, redisEventName, {
      ...user.user,
      betId,
      matchId,
      sessionExposure: redisSesionExposureValue,
      userBalanceData: user.user.userBalance
    });

    let parentUsers = await getParentsWithBalance(user.user.id);

    for (const patentUser of parentUsers) {
      if (upperUserObj[patentUser.id]) {
        upperUserObj[patentUser.id].exposure =
          upperUserObj[patentUser.id].exposure + maxLoss;
      } else {
        upperUserObj[patentUser.id] = { exposure: maxLoss };
      }


      if (patentUser.createBy === patentUser.id) {
        superAdminData[patentUser.id] = upperUserObj[patentUser.id];
      }
    }
    faAdminCal[user.user.superParentId] = {
      exposure: maxLoss + (faAdminCal?.[user.user.superParentId]?.exposure || 0),
      role: user.user.superParentType
    }
  }
  return { faAdminCal, superAdminData };
};

exports.unDeclareSessionResult = async (req, res) => {
  try {

    const { betId, matchId, sessionDetails, userId } = req.body;

    logger.info({
      message: "Session result un declared.",
      data: {
        betId
      }
    });

    let users = await getDistinctUserBetPlaced(betId);

    let upperUserObj = {};
    let bulkWalletRecord = [];
    const commissionData = await getCombinedCommission(betId);
    const profitLossData = await calculateProfitLossSessionForUserUnDeclare(
      users,
      betId,
      matchId,
      0,
      sessionDetails,
      socketData.sessionResultUnDeclare,
      userId,
      bulkWalletRecord,
      upperUserObj,
      commissionData
    );
    deleteCommission(betId);
    insertBulkTransactions(bulkWalletRecord);
    logger.info({
      message: "Upper user for this bet.",
      data: { upperUserObj, betId }
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


      parentUser.profitLoss = parentProfitLoss - value?.["profitLoss"];
      parentUser.myProfitLoss = parentMyProfitLoss + value["myProfitLoss"];
      parentUser.exposure = parentExposure + value["exposure"];
      parentUser.totalCommission = parentUser.totalCommission - value["totalCommission"];
      if (parentUser.exposure < 0) {
        logger.info({
          message: "Exposure in negative for user: ",
          data: {
            betId,
            matchId,
            parentUser,
          },
        });
        value["exposure"] += parentUser.exposure;
        parentUser.exposure = 0;
      }

      await updateUserBalanceData(key, {
        balance: 0,
        profitLoss: -value?.["profitLoss"],
        myProfitLoss: +value["myProfitLoss"],
        exposure: +value["exposure"],
        totalCommission: -(value["totalCommission"] || 0)
      });

      logger.info({
        message: "Declare result db update for parent ",
        data: {
          betId,
          parentUser,
        },
      });

      if (parentUserRedisData?.exposure) {
        let parentRedisUpdateObj = {
          [betId + redisKeys.profitLoss]: JSON.stringify(value?.profitLossObj)
        };
        const redisSessionExposureName = redisKeys.userSessionExposure + matchId;

        await incrementValuesRedis(key, {
          profitLoss: -value?.["profitLoss"],
          myProfitLoss: value["myProfitLoss"],
          exposure: value["exposure"],
          [redisSessionExposureName]: value["exposure"]
        }, parentRedisUpdateObj);

      }

      sendMessageToUser(key, socketData.sessionResultUnDeclare, {
        ...parentUser,
        betId,
        matchId,
        profitLossData: value?.profitLossObj
      });
    }

    await updatePlaceBet(
      {
        betId: betId,
        deleteReason: IsNull(),
      },
      {
        result: betResultStatus.PENDING,
      }
    );

    return SuccessResponse(
      {
        statusCode: 200,
        message: { msg: "bet.resultUnDeclared" },
        data: profitLossData
      },
      req,
      res
    );


  } catch (error) {
    logger.error({
      error: `Error at un declare session result for the user.`,
      stack: error.stack,
      message: error.message,
    });
    // Handle any errors and return an error response
    return ErrorResponse(error, req, res);
  }
}

const calculateProfitLossSessionForUserUnDeclare = async (users, betId, matchId, fwProfitLoss, resultDeclare, redisEventName, userId, bulkWalletRecord, upperUserObj, commissionData) => {

  let faAdminCal = { userData: {}, walletData: {} };
  let superAdminData = {};

  for (const user of users) {
    let getWinAmount = 0;
    let getLossAmount = 0;
    let profitLoss = 0;
    let userRedisData = await getUserRedisData(user.user.id);
    let getMultipleAmount = await getMultipleAccountProfitLoss(betId, user.user.id);
    let maxLoss = 0;
    let redisSesionExposureValue = 0;
    let redisSesionExposureName = redisKeys.userSessionExposure + matchId;
    redisSesionExposureValue = parseFloat(userRedisData?.[redisSesionExposureName] || 0);
    logger.info({ message: "Updated users", data: user.user });
    logger.info({
      redisSessionExposureValue: redisSesionExposureValue,
      sessionBet: true,
    });


    // if data is not available in the redis then get data from redis and find max loss amount for all placed bet by user
    let betPlace = await findAllPlacedBetWithUserIdAndBetId(user?.user?.id, betId);
    let redisData = await calculatePLAllBet(betPlace, 100);
    maxLoss = redisData.maxLoss || 0;

    redisSesionExposureValue = redisSesionExposureValue + maxLoss;

    logger.info({
      maxLoss: maxLoss,
      userExposure: redisSesionExposureValue
    });

    user.user.userBalance.exposure = user.user.userBalance.exposure + maxLoss;
    logger.info({
      message: "Update user exposure.",
      data: user.user.exposure
    });

    getWinAmount = getMultipleAmount?.[0]?.winamount || 0;
    getLossAmount = getMultipleAmount?.[0]?.lossamount || 0;
    profitLoss = parseFloat(getWinAmount.toString()) - parseFloat(getLossAmount.toString());

    fwProfitLoss = parseFloat(fwProfitLoss.toString()) - parseFloat(((-profitLoss * user.user.fwPartnership) / 100).toString());

    const userCurrBalance = Number(
      (user.user.userBalance.currentBalance - profitLoss).toFixed(2)
    );

    let userBalanceData = {
      profitLoss: -profitLoss,
      myProfitLoss: -profitLoss,
      exposure: maxLoss,
    }

    let userCommission = commissionData?.find((item) => item?.userId == user.user.id);
    if (userCommission) {
      userBalanceData.totalCommission = - parseFloat(commissionData?.find((item) => item?.userId == user.user.id)?.amount || 0);
    }

    if (user.user.createBy === user.user.id) {
      superAdminData[user.user.id] = {
        role: user.user.roleName,
        profitLoss: profitLoss,
        myProfitLoss: profitLoss,
        exposure: maxLoss,
        totalCommission: parseFloat(commissionData?.find((item) => item?.userId == user.user.id)?.amount || 0)
      };
    }

    await updateUserBalanceData(user.user.id, userBalanceData);


    if (userRedisData?.exposure) {
      const { totalCommission, ...userBalance } = userBalanceData;

      await incrementValuesRedis(user.user.id, {
        ...userBalance,
        currentBalance: -profitLoss,
        [redisSesionExposureName]: maxLoss
      }, {
        [betId + redisKeys.profitLoss]: JSON.stringify({
          upperLimitOdds: redisData?.betData?.[redisData?.betData?.length - 1]?.odds,
          lowerLimitOdds: redisData?.betData?.[0]?.odds,
          betPlaced: redisData?.betData,
          maxLoss: redisData?.maxLoss,
          totalBet: redisData.total_bet
        }),
      });
    }
    logger.info({
      message: "user save at un declare result",
      data: user
    })

    sendMessageToUser(user.user.id, redisEventName, {
      ...user.user, betId, matchId,
      userBalanceData: {
        currentBalance: userCurrBalance,
        profitLoss: user.user.userBalance.profitLoss - profitLoss,
        myProfitLoss: user.user.userBalance.myProfitLoss - profitLoss,
        exposure: user.user.userBalance.exposure,
        totalCommission: parseFloat(user.user.userBalance.totalCommission) - parseFloat(commissionData?.find((item) => item?.userId == user.user.id)?.amount || 0)
      },
      profitLossData: JSON.stringify({
        upperLimitOdds: redisData?.betData?.[redisData?.betData?.length - 1]?.odds,
        lowerLimitOdds: redisData?.betData?.[0]?.odds,
        betPlaced: redisData?.betData,
        maxLoss: redisData?.maxLoss,
        totalBet: redisData.total_bet
      }),
      sessionDetails: resultDeclare

    });

    bulkWalletRecord.push(
      {
        matchId: matchId,
        actionBy: userId,
        searchId: user.user.id,
        userId: user.user.id,
        amount: -profitLoss,
        transType: -profitLoss < 0 ? transType.loss : transType.win,
        closingBalance: userCurrBalance,
        description: `Revert ${user?.eventType}/${user?.eventName}/session`,
        betId: [betId]
      }
    );

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
        ((profitLoss * upLinePartnership) / 100).toString()
      );

      if (upperUserObj[patentUser.id]) {
        upperUserObj[patentUser.id].profitLoss = upperUserObj[patentUser.id].profitLoss + profitLoss;
        upperUserObj[patentUser.id].myProfitLoss = upperUserObj[patentUser.id].myProfitLoss + myProfitLoss;
        upperUserObj[patentUser.id].exposure = upperUserObj[patentUser.id].exposure + maxLoss;

        for (const placedBets of betPlace) {
          upperUserObj[patentUser.id].profitLossObj = await calculateProfitLossSession(upperUserObj[patentUser.id].profitLossObj, {
            betPlacedData: {
              betType: placedBets?.betType,
              odds: placedBets?.odds,
            },
            loseAmount: placedBets?.lossAmount,
            winAmount: placedBets?.winAmount,
          }, user?.user[`${partnershipPrefixByRole[patentUser?.roleName]}Partnership`]);
        }
      } else {
        upperUserObj[patentUser.id] = { profitLoss: profitLoss, myProfitLoss: myProfitLoss, exposure: maxLoss };
        let userCommission = commissionData?.find((item) => item?.userId == patentUser.id);
        if (userCommission) {
          upperUserObj[patentUser.id].totalCommission = parseFloat((parseFloat(commissionData?.find((item) => item?.userId == patentUser.id)?.amount || 0) * parseFloat(upLinePartnership) / 100).toFixed(2));
        }

        const betPlaceProfitLoss = await calculatePLAllBet(betPlace, -user?.user[`${partnershipPrefixByRole[patentUser?.roleName]}Partnership`]);

        upperUserObj[patentUser.id] = {
          ...upperUserObj[patentUser.id], profitLossObj: {
            upperLimitOdds: betPlaceProfitLoss?.betData?.[betPlaceProfitLoss?.betData?.length - 1]?.odds,
            lowerLimitOdds: betPlaceProfitLoss?.betData?.[0]?.odds,
            betPlaced: betPlaceProfitLoss?.betData,
            maxLoss: betPlaceProfitLoss?.maxLoss,
            totalBet: betPlaceProfitLoss?.total_bet
          }
        };

      }

      if (patentUser.createBy === patentUser.id) {
        superAdminData[patentUser.id] = {
          ...upperUserObj[patentUser.id],
          role: patentUser.roleName,
        };
      }
    }


    if (!faAdminCal.walletData.profitLossObjWallet) {
      const betPlaceProfitLoss = await calculatePLAllBet(
        betPlace,
        -user?.user[`fwPartnership`]
      );
      faAdminCal.walletData.profitLossObjWallet = {
        upperLimitOdds: betPlaceProfitLoss?.betData?.[betPlaceProfitLoss?.betData?.length - 1]?.odds,
        lowerLimitOdds: betPlaceProfitLoss?.betData?.[0]?.odds,
        betPlaced: betPlaceProfitLoss?.betData,
        maxLoss: betPlaceProfitLoss?.maxLoss,
        totalBet: betPlaceProfitLoss?.total_bet
      };
    } else {
      for (const placedBets of betPlace) {
        faAdminCal.walletData.profitLossObjWallet = await calculateProfitLossSession(
          faAdminCal.walletData.profitLossObjWallet,
          {
            betPlacedData: {
              betType: placedBets?.betType,
              odds: placedBets?.odds,
            },
            loseAmount: placedBets?.lossAmount,
            winAmount: placedBets?.winAmount,
          },
          user?.user[`fwPartnership`]
        );
      }
    }
    if (user.user.superParentType == userRoleConstant.fairGameAdmin) {
      if (!faAdminCal.userData[user.user.superParentId]) {
        faAdminCal.userData[user.user.superParentId] = {};
        const betPlaceProfitLoss = await calculatePLAllBet(
          betPlace,
          -user?.user[`faPartnership`]
        );
        faAdminCal.userData[user.user.superParentId].profitLossData = {
          upperLimitOdds: betPlaceProfitLoss?.betData?.[betPlaceProfitLoss?.betData?.length - 1]?.odds,
          lowerLimitOdds: betPlaceProfitLoss?.betData?.[0]?.odds,
          betPlaced: betPlaceProfitLoss?.betData,
          maxLoss: betPlaceProfitLoss?.maxLoss,
          totalBet: betPlaceProfitLoss?.total_bet
        };
      } else {
        for (const placedBets of betPlace) {
          faAdminCal.userData[user.user.superParentId].profitLossData = await calculateProfitLossSession(
            faAdminCal.userData[user.user.superParentId].profitLossData,
            {
              betPlacedData: {
                betType: placedBets?.betType,
                odds: placedBets?.odds,
              },
              loseAmount: placedBets?.lossAmount,
              winAmount: placedBets?.winAmount,
            },
            user?.user[`faPartnership`]
          );
        }
      }
    }

    faAdminCal.userData[user.user.superParentId] = {
      ...faAdminCal.userData[user.user.superParentId],
      profitLoss: profitLoss + (faAdminCal.userData[user.user.superParentId]?.profitLoss || 0),
      exposure: maxLoss + (faAdminCal.userData[user.user.superParentId]?.exposure || 0),
      myProfitLoss: parseFloat((parseFloat(faAdminCal.userData[user.user.superParentId]?.myProfitLoss || 0) + (parseFloat(profitLoss) * parseFloat(user.user.fwPartnership) / 100)).toFixed(2)),
      role: user.user.superParentType
    }

  };
  return { fwProfitLoss, faAdminCal, superAdminData };
}

exports.getBetWallet = async (req, res) => {
  try {
    let { roleName, userId, isTeamNameAllow, ...queryData } = req.query;
    let result;
    let select = [
      "betPlaced.id", "betPlaced.eventName", "betPlaced.teamName", "betPlaced.betType", "betPlaced.amount", "betPlaced.rate", "betPlaced.winAmount", "betPlaced.lossAmount", "betPlaced.createdAt", "betPlaced.eventType", "betPlaced.marketType", "betPlaced.odds", "betPlaced.marketBetType", "betPlaced.result", "betPlaced.matchId", "betPlaced.betId", "betPlaced.deleteReason", "betPlaced.bettingName", "match.startAt", "betPlaced.runnerId"
    ];

    select.push("user.id", "user.userName", "user.fwPartnership", "user.faPartnership");
    result = await getBet("user.id is not null", queryData, roleName, select, userId, isTeamNameAllow == 'false' ? false : true);


    if (!result[1]) {
      return SuccessResponse(
        {
          statusCode: 200,
          message: { msg: "fetched", keys: { type: "Bet" } },
          data: { count: 0, rows: [] },
        },
        req,
        res
      );
    }
    const domainUrl = `${req.protocol}://${req.get("host")}`;
    result[0] = result?.[0]?.map((item) => {
      return {
        ...item,
        domain: domainUrl,
      };
    });


    return SuccessResponse({
      statusCode: 200, message: { msg: "fetched", keys: { type: "Bet" } }, data: {
        count: result[1],
        rows: result[0]
      }
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

exports.declareMatchResult = async (req, res) => {
  try {
    const { result, matchDetails, userId, matchId, match } = req.body;

    const betIds = matchDetails?.map((item) => item?.id);
    const betPlaced = await getMatchBetPlaceWithUser(betIds);

    logger.info({
      message: "Match result declared.",
      data: {
        betIds,
        result,
      },
    });

    let updateRecords = [];
    let bulkCommission = {};
    let commissions = {};
    let matchOddWinBets = [];

    for (let item of betPlaced) {
      if (result === resultType.tie) {
        if ((item.betType === betType.BACK && item.teamName === tiedManualTeamName.yes) || (item.betType === betType.LAY && item.teamName === tiedManualTeamName.no)) {
          item.result = betResultStatus.WIN;
        }
        else if ((item.betType === betType.LAY && item.teamName === tiedManualTeamName.yes) || (item.betType === betType.BACK && item.teamName === tiedManualTeamName.no)) {
          item.result = betResultStatus.LOSS;
        }
        else {
          item.result = betResultStatus.TIE;
        }
      } else if (result === resultType.noResult) {
        if (!(item.marketType === matchBettingType.tiedMatch1 || item.marketType === matchBettingType.tiedMatch2)) {
          if ((item.betType === betType.BACK && item.teamName === tiedManualTeamName.yes) || (item.betType === betType.LAY && item.teamName === tiedManualTeamName.no)) {
            item.result = betResultStatus.LOSS;
          }
          else if ((item.betType === betType.LAY && item.teamName === tiedManualTeamName.yes) || (item.betType === betType.BACK && item.teamName === tiedManualTeamName.no)) {
            item.result = betResultStatus.WIN
          }
          else {
            item.result = betResultStatus.TIE;
          }
        }
        else {
          item.result = betResultStatus.TIE;
        }
      } else {
        const isWinCondition = !(Object.values(tieCompleteBetType).includes(item.marketType)) && ((item.betType === betType.BACK && item.teamName === result) || (item.betType === betType.LAY && item.teamName !== result));
        const isTiedMatchCondition = (item.marketType === matchBettingType.tiedMatch1 || item.marketType === matchBettingType.tiedMatch2) && ((item.betType === betType.BACK && item.teamName === tiedManualTeamName.no) || (item.betType === betType.LAY && item.teamName == tiedManualTeamName.yes));
        const isCompleteMatchCondition = (item.marketType === matchBettingType.completeMatch || item.marketType === matchBettingType.completeManual) && ((item.betType === betType.BACK && item.teamName === tiedManualTeamName.yes) || (item.betType === betType.LAY && item.teamName == tiedManualTeamName.no));
        item.result = isWinCondition || isTiedMatchCondition || isCompleteMatchCondition ? betResultStatus.WIN : betResultStatus.LOSS;
      }
      if (item.user.matchCommission && item.result == betResultStatus.LOSS && item.user.matchComissionType == matchComissionTypeConstant.entryWise) {
        let commissionAmount = Number((parseFloat(item.lossAmount) * (parseFloat(item.user['matchCommission']) / 100)).toFixed(2));
        commissionAmount = Math.abs(commissionAmount);
        if (commissions[item?.user?.id]) {
          commissions[item?.user?.id] = parseFloat(commissions[item?.user?.id]) + parseFloat(commissionAmount);
        } else {

          commissions[item?.user?.id] = commissionAmount;
        }
      }
      if (item.result == betResultStatus.LOSS) {
        bulkCommission[item?.user?.id] = [...(bulkCommission[item?.user?.id] || []),
        {
          matchId: matchId,
          betId: matchDetails?.find((items) => items.type == matchBettingType.quickbookmaker1)?.id,
          betPlaceId: item?.id,
          amount: item?.amount,
          sessionName: item?.eventName,
          betPlaceDate: item?.createdAt,
          odds: item?.odds,
          betType: item?.betType,
          stake: item?.amount,
          lossAmount: item?.lossAmount,
          superParent: item?.user?.superParentId, userName: item.user?.userName
        }
        ];
      }

      if (item.result == betResultStatus.WIN && item.marketType == matchBettingType.matchOdd) {
        matchOddWinBets.push(item)
      }

      updateRecords.push(item);
    }

    await addNewBet(updateRecords);


    let users = await getDistinctUserBetPlaced(In(betIds));

    let upperUserObj = {};
    let bulkWalletRecord = [];
    let commissionReport = [];
    const profitLossData = await calculateProfitLossMatchForUserDeclare(
      users,
      betIds,
      matchId,
      0,
      socketData.matchResult,
      userId,
      bulkWalletRecord,
      upperUserObj,
      result,
      match,
      commissions,
      bulkCommission,
      commissionReport,
      matchDetails?.find((items) => items.type == matchBettingType.quickbookmaker1)?.id,
      matchOddWinBets,
      matchDetails
    );

    insertBulkTransactions(bulkWalletRecord);
    logger.info({
      message: "Upper user for this bet.",
      data: { upperUserObj, betIds },
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
      parentUser.totalCommission = parentUser.totalCommission + value["totalCommission"]
      if (parentUser.exposure < 0) {
        logger.info({
          message: "Exposure in negative for user: ",
          data: {
            betIds,
            matchId,
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
        totalCommission: parseFloat(parseFloat(value["totalCommission"]).toFixed(2))
      });

      logger.info({
        message: "Declare result db update for parent ",
        data: {
          betIds,
          parentUser,
        },
      });
      if (parentUserRedisData?.exposure) {
        await incrementValuesRedis(key, {
          profitLoss: value?.["profitLoss"],
          myProfitLoss: -value["myProfitLoss"],
          exposure: -value["exposure"],
        });
        await deleteKeyFromUserRedis(key, redisKeys.userTeamARate + matchId, redisKeys.userTeamBRate + matchId, redisKeys.userTeamCRate + matchId, redisKeys.yesRateTie + matchId, redisKeys.noRateTie + matchId, redisKeys.yesRateComplete + matchId, redisKeys.noRateComplete + matchId);
      }

      sendMessageToUser(key, socketData.matchResult, {
        ...parentUser,
        betIds,
        matchId
      });
    }
    insertBulkCommissions(commissionReport);
    broadcastEvent(socketData.declaredMatchResultAllUser, { matchId, gameType: match?.matchType });
    await updateMatchData({ id: matchId }, { stopAt: new Date() });
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
      error: `Error at declare session result for the user.`,
      stack: error.stack,
      message: error.message,
    });
    // Handle any errors and return an error response
    return ErrorResponse(error, req, res);
  }
};

const calculateProfitLossMatchForUserDeclare = async (users, betId, matchId, fwProfitLoss, redisEventName, userId, bulkWalletRecord, upperUserObj, result, matchData, commission, bulkCommission, commissionReport, currBetId, matchOddWinBets, matchDetailsBetIds) => {

  let faAdminCal = {
    commission: [],
    userData: {}
  };
  let superAdminData = {};

  for (const user of users) {
    let getWinAmount = 0;
    let getLossAmount = 0;
    let profitLoss = 0;
    let userRedisData = await getUserRedisData(user.user.id);
    let getMultipleAmount = await getMultipleAccountMatchProfitLoss(betId, user.user.id);

    Object.keys(getMultipleAmount)?.map((item) => {
      getMultipleAmount[item] = parseFloat(parseFloat(getMultipleAmount[item]).toFixed(2));
    });

    let maxLoss = 0;
    logger.info({ message: "Updated users", data: user.user });


    // check if data is already present in the redis or not
    if (userRedisData?.[redisKeys.userTeamARate + matchId]) {

      let teamARate = userRedisData[redisKeys.userTeamARate + matchId] ?? Number.MAX_VALUE;
      let teamBRate = userRedisData[redisKeys.userTeamBRate + matchId] ?? Number.MAX_VALUE;
      let teamCRate = userRedisData[redisKeys.userTeamCRate + matchId] ?? Number.MAX_VALUE;

      let teamNoRateTie = userRedisData[redisKeys.noRateTie + matchId] ?? Number.MAX_VALUE;
      let teamYesRateTie = userRedisData[redisKeys.yesRateTie + matchId] ?? Number.MAX_VALUE;

      let teamNoRateComplete = userRedisData[redisKeys.noRateComplete + matchId] ?? Number.MAX_VALUE;
      let teamYesRateComplete = userRedisData[redisKeys.yesRateComplete + matchId] ?? Number.MAX_VALUE;

      maxLoss = (Math.abs(Math.min(teamARate, teamBRate, isNaN(teamCRate) ? 0 : teamCRate, 0)) + Math.abs(Math.min(teamNoRateTie, teamYesRateTie, 0)) + Math.abs(Math.min(teamNoRateComplete, teamYesRateComplete, 0))) || 0;

    }
    else {
      // if data is not available in the redis then get data from redis and find max loss amount for all placed bet by user
      let redisData = await calculateProfitLossForMatchToResult(betId, user.user?.id, matchData);

      let teamARate = redisData?.teamARate ?? Number.MAX_VALUE;
      let teamBRate = redisData?.teamBRate ?? Number.MAX_VALUE;
      let teamCRate = redisData?.teamCRate ?? Number.MAX_VALUE;

      let teamNoRateTie = redisData?.teamNoRateTie ?? Number.MAX_VALUE;
      let teamYesRateTie = redisData?.teamYesRateTie ?? Number.MAX_VALUE;

      let teamNoRateComplete = redisData?.teamNoRateComplete ?? Number.MAX_VALUE;
      let teamYesRateComplete = redisData?.teamYesRateComplete ?? Number.MAX_VALUE;

      maxLoss = (Math.abs(Math.min(teamARate, teamBRate, isNaN(teamCRate) ? 0 : teamCRate, 0)) + Math.abs(Math.min(teamNoRateTie, teamYesRateTie, 0)) + Math.abs(Math.min(teamNoRateComplete, teamYesRateComplete, 0))) || 0;
    }

    user.user.userBalance.exposure = user.user.userBalance.exposure - maxLoss;

    logger.info({
      message: "Update user exposure.",
      data: user.user.userBalance.exposure
    });


    if (result == resultType.tie) {
      getWinAmount = getMultipleAmount.winAmountTied + getMultipleAmount.winAmountComplete;
      getLossAmount = getMultipleAmount.lossAmountTied + getMultipleAmount.lossAmountComplete;
    }
    else if (result == resultType.noResult) {
      getWinAmount = getMultipleAmount.winAmountComplete;
      getLossAmount = getMultipleAmount.lossAmountComplete;
    }
    else {
      getWinAmount = getMultipleAmount.winAmount + getMultipleAmount.winAmountTied + getMultipleAmount.winAmountComplete;
      getLossAmount = getMultipleAmount.lossAmount + getMultipleAmount.lossAmountTied + getMultipleAmount.lossAmountComplete;
    }

    profitLoss = parseFloat(getWinAmount.toString()) - parseFloat(getLossAmount.toString());

    fwProfitLoss = parseFloat(fwProfitLoss.toString()) + parseFloat(((-profitLoss * user.user.fwPartnership) / 100).toString());

    let userCurrentBalance = parseFloat(user.user.userBalance.currentBalance);
    matchOddWinBets?.filter((item) => item.user.id == user.user.id)?.forEach((matchOddData, uniqueId) => {
      userCurrentBalance -= parseFloat(parseFloat((matchOddData?.winAmount) / 100).toFixed(2))
      bulkWalletRecord.push({
        matchId: matchId,
        actionBy: userId,
        searchId: user.user.id,
        userId: user.user.id,
        amount: -parseFloat(parseFloat((matchOddData?.winAmount) / 100).toFixed(2)),
        transType: transType.loss,
        closingBalance: userCurrentBalance,
        description: `Deduct 1% for bet on match odds ${matchOddData?.eventType}/${matchOddData.eventName}-${matchOddData.teamName} on odds ${matchOddData.odds}/${matchOddData.betType} of stake ${matchOddData.amount} `,
        createdAt: new Date(),
        uniqueId: uniqueId,
        betId: [matchDetailsBetIds?.find((item) => item?.type == matchBettingType.matchOdd)?.id]
      });
    });

    let userOriginalProfitLoss = profitLoss;

    // deducting 1% from match odd win amount 
    if (parseFloat(getMultipleAmount?.winAmountMatchOdd) > 0) {
      profitLoss -= parseFloat(((parseFloat(getMultipleAmount?.winAmountMatchOdd) / 100)).toFixed(2));
    }

    const userCurrBalance = Number(user.user.userBalance.currentBalance + profitLoss).toFixed(2);
    let userBalanceData = {
      currentBalance: userCurrBalance,
      profitLoss: user.user.userBalance.profitLoss + profitLoss,
      myProfitLoss: user.user.userBalance.myProfitLoss + profitLoss,
      exposure: user.user.userBalance.exposure
    }

    let totalCommissionData = 0;

    if (user.user.matchCommission) {
      if (user.user.matchComissionType == matchComissionTypeConstant.entryWise) {
        userBalanceData.totalCommission = parseFloat((parseFloat(user.user.userBalance.totalCommission) + parseFloat(getLossAmount) * parseFloat(user.user.matchCommission) / 100).toFixed(2));
        totalCommissionData += parseFloat((parseFloat(getLossAmount) * parseFloat(user.user.matchCommission) / 100).toFixed(2))
      }
      else if (userOriginalProfitLoss < 0) {
        userBalanceData.totalCommission = parseFloat((parseFloat(user.user.userBalance.totalCommission) + Math.abs(parseFloat(userOriginalProfitLoss)) * parseFloat(user.user.matchCommission) / 100).toFixed(2));
        totalCommissionData += parseFloat((Math.abs(parseFloat(userOriginalProfitLoss)) * parseFloat(user.user.matchCommission) / 100).toFixed(2))
      }
    }

    await updateUserBalanceData(user.user.id, {
      profitLoss: profitLoss,
      myProfitLoss: profitLoss,
      exposure: -maxLoss,
      totalCommission: totalCommissionData
    });

    if (userRedisData?.exposure) {

      await incrementValuesRedis(user.user.id, {
        profitLoss: profitLoss,
        myProfitLoss: profitLoss,
        exposure: -maxLoss,
        currentBalance: profitLoss
      });
    }

    if (user?.user?.matchCommission) {

      if (user.user.matchComissionType == matchComissionTypeConstant.entryWise) {
        bulkCommission[user?.user?.id]?.forEach((item) => {
          commissionReport.push({
            createBy: user.user.id,
            matchId: item.matchId,
            betId: item?.betId,
            betPlaceId: item?.betPlaceId,
            commissionAmount: parseFloat((parseFloat(item?.lossAmount) * parseFloat(user?.user?.matchCommission) / 100).toFixed(2)),
            parentId: user.user.id,
          });
        });
      }
      else if (userOriginalProfitLoss < 0) {
        commissionReport.push({
          createBy: user.user.id,
          matchId: matchId,
          betId: currBetId,
          commissionAmount: parseFloat((parseFloat(Math.abs(userOriginalProfitLoss)) * parseFloat(user?.user?.matchCommission) / 100).toFixed(2)),
          parentId: user.user.id,
          stake: userOriginalProfitLoss
        });
      }
      if (user?.user?.id == user?.user?.createBy) {
        if (user.user.matchComissionType == matchComissionTypeConstant.entryWise) {
          bulkCommission[user?.user?.id]?.forEach((item) => {
            faAdminCal.commission.push({
              createBy: user.user.id,
              matchId: item.matchId,
              betId: item?.betId,
              betPlaceId: item?.betPlaceId,
              parentId: user.user.id,
              teamName: item?.sessionName,
              betPlaceDate: new Date(item?.betPlaceDate),
              odds: item?.odds,
              betType: item?.betType,
              stake: item?.stake,
              commissionAmount: parseFloat((parseFloat(item?.lossAmount) * parseFloat(user?.user?.matchCommission) / 100).toFixed(2)),
              partnerShip: 100,
              matchName: matchData?.title,
              matchStartDate: new Date(matchData?.startAt),
              userName: user.user.userName

            });
          });
        }
        else if (userOriginalProfitLoss < 0) {
          faAdminCal.commission.push({
            createBy: user.user.id,
            matchId: matchId,
            betId: currBetId,
            parentId: user.user.id,
            commissionAmount: parseFloat((parseFloat(Math.abs(userOriginalProfitLoss)) * parseFloat(user?.user?.matchCommission) / 100).toFixed(2)),
            partnerShip: 100,
            matchName: matchData?.title,
            matchStartDate: new Date(matchData?.startAt),
            userName: user.user.userName,
            stake: userOriginalProfitLoss
          });
        }
      }
    }

    sendMessageToUser(user.user.id, redisEventName, { ...user.user, betId, matchId, userBalanceData });

    // deducting 1% from match odd win amount 
    if (parseFloat(getMultipleAmount?.winAmountMatchOdd) > 0) {
      user.user.userBalance.currentBalance = parseFloat(parseFloat(user.user.userBalance.currentBalance - (parseFloat(getMultipleAmount?.winAmountMatchOdd) / 100)).toFixed(2));
    }

    let currBal = user.user.userBalance.currentBalance;

    const transactions = [
      ...(result != resultType.tie && result != resultType.noResult && parseFloat(getMultipleAmount.matchOddBetsCount || 0) > 0 ? [{
        winAmount: parseFloat(getMultipleAmount.winAmount),
        lossAmount: parseFloat(getMultipleAmount.lossAmount),
        type: "MATCH ODDS",
        result: result,
        betId: matchDetailsBetIds?.filter((item) => item?.type == matchBettingType.matchOdd || item?.type == matchBettingType.quickbookmaker1 || item?.type == matchBettingType.quickbookmaker2 || item?.type == matchBettingType.quickbookmaker3 || item?.type == matchBettingType.bookmaker)?.map((item) => item?.id)
      }] : []),
      ...(result != resultType.noResult && parseFloat(getMultipleAmount.tiedBetsCount || 0) > 0 ? [{
        winAmount: parseFloat(getMultipleAmount.winAmountTied),
        lossAmount: parseFloat(getMultipleAmount.lossAmountTied),
        type: "Tied Match",
        result: result == resultType.tie ? "YES" : "NO",
        betId: matchDetailsBetIds?.filter((item) => item?.type == matchBettingType.tiedMatch1 || item?.type == matchBettingType.tiedMatch2)?.map((item) => item?.id)
      }] : []),
      ...(parseFloat(getMultipleAmount.completeBetsCount || 0) > 0 ? [{
        winAmount: parseFloat(getMultipleAmount.winAmountComplete),
        lossAmount: parseFloat(getMultipleAmount.lossAmountComplete),
        type: "Complete Match",
        result: "YES",
        betId: matchDetailsBetIds?.filter((item) => item?.type == matchBettingType.completeManual || item?.type == matchBettingType.completeMatch)?.map((item) => item?.id)
        
      }]:[])
    ];

    transactions.forEach((item, uniqueId) => {
      currBal = currBal + item.winAmount - item.lossAmount;

      bulkWalletRecord.push({
        matchId: matchId,
        actionBy: userId,
        searchId: user.user.id,
        userId: user.user.id,
        amount: item.winAmount - item.lossAmount,
        transType: item.winAmount - item.lossAmount > 0 ? transType.win : transType.loss,
        closingBalance: currBal,
        description: `${user?.eventType}/${user?.eventName}/${item.type}-${item.result}`,
        createdAt: new Date(),
        uniqueId: uniqueId,
        betId: item?.betId
      });
    });


    await deleteKeyFromUserRedis(user.user.id, redisKeys.userMatchExposure + matchId, redisKeys.userTeamARate + matchId, redisKeys.userTeamBRate + matchId, redisKeys.userTeamCRate + matchId, redisKeys.yesRateTie + matchId, redisKeys.noRateTie + matchId, redisKeys.yesRateComplete + matchId, redisKeys.noRateComplete + matchId);

    if (user.user.createBy === user.user.id) {
      superAdminData[user.user.id] = {
        role: user.user.roleName,
        profitLoss: profitLoss,
        myProfitLoss: profitLoss,
        exposure: maxLoss,
        totalCommission: (user.user.matchComissionType == matchComissionTypeConstant.entryWise ? (commission[user.user.id] || 0) : userOriginalProfitLoss < 0 ? parseFloat((parseFloat(Math.abs(userOriginalProfitLoss)) * parseFloat(user?.user?.matchCommission) / 100).toFixed(2)) : 0)
      };
    }

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
      let parentCommission = parseFloat((parseFloat(((parseFloat(patentUser?.matchCommission) * ((patentUser.matchComissionType == matchComissionTypeConstant.entryWise ? getLossAmount : userOriginalProfitLoss < 0 ? Math.abs(userOriginalProfitLoss) : 0))) / 100).toFixed(2)) * parseFloat(upLinePartnership) / 100).toFixed(2));

      if (upperUserObj[patentUser.id]) {
        upperUserObj[patentUser.id].profitLoss = upperUserObj[patentUser.id].profitLoss + profitLoss;
        upperUserObj[patentUser.id].myProfitLoss = upperUserObj[patentUser.id].myProfitLoss + myProfitLoss;
        upperUserObj[patentUser.id].exposure = upperUserObj[patentUser.id].exposure + maxLoss;

        if (patentUser?.matchCommission && parseFloat(patentUser?.matchCommission) != 0) {
          upperUserObj[patentUser.id].totalCommission += parentCommission;
        }
      } else {
        upperUserObj[patentUser.id] = { profitLoss: profitLoss, myProfitLoss: myProfitLoss, exposure: maxLoss, ...(patentUser?.matchCommission && parseFloat(patentUser?.matchCommission) != 0 ? { totalCommission: parentCommission } : {}) };
      }

      if (patentUser.createBy === patentUser.id) {
        superAdminData[patentUser.id] = {
          ...upperUserObj[patentUser.id],
          role: patentUser.roleName,
        };
      }

      if (patentUser?.matchCommission) {
        if (patentUser.matchComissionType == matchComissionTypeConstant.entryWise) {
          bulkCommission[user?.user?.id]?.forEach((item) => {
            commissionReport.push({
              createBy: user.user.id,
              matchId: item.matchId,
              betId: item?.betId,
              betPlaceId: item?.betPlaceId,
              commissionAmount: parseFloat((parseFloat(item?.lossAmount) * parseFloat(patentUser?.matchCommission) / 100).toFixed(2)),
              parentId: patentUser.id,
            });
          });
        }
        else if (userOriginalProfitLoss < 0) {
          commissionReport.push({
            createBy: user.user.id,
            matchId: matchId,
            betId: currBetId,
            commissionAmount: parseFloat((parseFloat(Math.abs(userOriginalProfitLoss)) * parseFloat(patentUser?.matchCommission) / 100).toFixed(2)),
            parentId: patentUser.id,
            stake: userOriginalProfitLoss

          });
        }
        if (patentUser?.id == patentUser?.createBy) {
          if (patentUser.matchComissionType == matchComissionTypeConstant.entryWise) {
            bulkCommission[user?.user?.id]?.forEach((item) => {
              faAdminCal.commission.push({
                createBy: user.user.id,
                matchId: item.matchId,
                betId: item?.betId,
                betPlaceId: item?.betPlaceId,
                parentId: patentUser.id,
                teamName: item?.sessionName,
                betPlaceDate: item?.betPlaceDate,
                odds: item?.odds,
                betType: item?.betType,
                stake: item?.stake,
                commissionAmount: parseFloat((parseFloat(item?.lossAmount) * parseFloat(patentUser?.matchCommission) / 100).toFixed(2)),
                partnerShip: upLinePartnership,
                matchName: matchData?.title,
                matchStartDate: matchData?.startAt,
                userName: user.user.userName

              });
            });
          }
          else if (userOriginalProfitLoss < 0) {
            faAdminCal.commission.push({
              createBy: user.user.id,
              matchId: matchId,
              betId: currBetId,
              parentId: patentUser.id,
              commissionAmount: parseFloat((parseFloat(Math.abs(userOriginalProfitLoss)) * parseFloat(patentUser?.matchCommission) / 100).toFixed(2)),
              partnerShip: upLinePartnership,
              matchName: matchData?.title,
              matchStartDate: matchData?.startAt,
              userName: user.user.userName,
              stake: userOriginalProfitLoss

            });
          }
        }
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

  };
  return { fwProfitLoss, faAdminCal, superAdminData, bulkCommission };
}

exports.unDeclareMatchResult = async (req, res) => {
  try {

    const { matchId, match, matchBetting, userId, matchOddId } = req.body;

    const betIds = matchBetting?.map((item) => item?.id);
    let users = await getDistinctUserBetPlaced(In(betIds));

    logger.info({
      message: "Match result un declared.",
      data: {
        betIds
      }
    });

    let upperUserObj = {};
    let bulkWalletRecord = [];

    let matchOddsWinBets = await findAllPlacedBet({
      marketType: matchBettingType.matchOdd,
      result: betResultStatus.WIN,
      matchId: matchId,
    });

    const commissionData = await getCombinedCommission(matchOddId);
    const profitLossData = await calculateProfitLossMatchForUserUnDeclare(
      users,
      betIds,
      matchId,
      0,
      matchBetting,
      socketData.matchResultUnDeclare,
      userId,
      bulkWalletRecord,
      upperUserObj,
      match,
      commissionData, matchOddsWinBets, matchBetting
    );
    deleteCommission(matchOddId);

    insertBulkTransactions(bulkWalletRecord);
    logger.info({
      message: "Upper user for this bet.",
      data: { upperUserObj, betIds }
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


      parentUser.profitLoss = parentProfitLoss - value?.["profitLoss"];
      parentUser.myProfitLoss = parentMyProfitLoss + value["myProfitLoss"];
      parentUser.exposure = parentExposure + value["exposure"];
      parentUser.totalCommission = parseFloat(parentUser.totalCommission || 0) - parseFloat(value["totalCommission"] || 0);
      if (parentUser.exposure < 0) {
        logger.info({
          message: "Exposure in negative for user: ",
          data: {
            matchId,
            parentUser,
          },
        });
        value["exposure"] += parentUser.exposure;
        parentUser.exposure = 0;
      }

      await updateUserBalanceData(parentUser.userId, {
        balance: 0,
        profitLoss: -value?.["profitLoss"],
        myProfitLoss: value["myProfitLoss"],
        exposure: value["exposure"],
        totalCommission: -parseFloat(parseFloat(value["totalCommission"] || 0).toFixed(2))
      });

      logger.info({
        message: "Declare result db update for parent ",
        data: {
          parentUser,
        },
      });

      if (parentUserRedisData?.exposure) {
        let { exposure, profitLoss, myProfitLoss, ...parentRedisUpdateObj } = value;
        await incrementValuesRedis(parentUser.userId, {
          profitLoss: -value?.["profitLoss"],
          myProfitLoss: value["myProfitLoss"],
          exposure: value["exposure"],
          [redisKeys.userMatchExposure + matchId]: value["exposure"]
        }, parentRedisUpdateObj);
      }

      sendMessageToUser(key, socketData.matchResultUnDeclare, {
        ...parentUser,
        matchId,
        profitLossData: value
      });
    }

    await updatePlaceBet(
      {
        betId: In(betIds),
        deleteReason: IsNull(),
      },
      {
        result: betResultStatus.PENDING,
      }
    );

    broadcastEvent(socketData.unDeclaredMatchResultAllUser, { matchId, gameType: match?.matchType });
    await updateMatchData({ id: matchId }, { stopAt: null });

    return SuccessResponse(
      {
        statusCode: 200,
        message: { msg: "bet.resultUnDeclared" },
        data: profitLossData
      },
      req,
      res
    );


  } catch (error) {
    logger.error({
      error: `Error at un declare match result for the user.`,
      stack: error.stack,
      message: error.message,
    });
    // Handle any errors and return an error response
    return ErrorResponse(error, req, res);
  }
}

const calculateProfitLossMatchForUserUnDeclare = async (users, betId, matchId, fwProfitLoss, resultDeclare, redisEventName, userId, bulkWalletRecord, upperUserObj, matchData, commissionData, matchOddsWinBets, matchDetailsBetIds) => {

  let faAdminCal = {
    admin: {},
    wallet: {}
  };
  let superAdminData = {};

  let parentCommissionIds = new Set();

  for (const user of users) {
    let getWinAmount = 0;
    let getLossAmount = 0;
    let profitLoss = 0;
    let userRedisData = await getUserRedisData(user.user.id);
    let getMultipleAmount = await getMultipleAccountMatchProfitLoss(betId, user.user.id);

    Object.keys(getMultipleAmount)?.map((item) => {
      getMultipleAmount[item] = parseFloat(parseFloat(getMultipleAmount[item]).toFixed(2));
    });
    let maxLoss = 0;

    logger.info({ message: "Updated users", data: user.user });

    // if data is not available in the redis then get data from redis and find max loss amount for all placed bet by user
    let redisData = await calculateProfitLossForMatchToResult(betId, user.user?.id, matchData);

    let teamARate = parseFloat(parseFloat(redisData?.teamARate || 0).toFixed(2)) ?? Number.MAX_VALUE;
    let teamBRate = parseFloat(parseFloat(redisData?.teamBRate || 0).toFixed(2)) ?? Number.MAX_VALUE;
    let teamCRate = parseFloat(parseFloat(redisData?.teamCRate || 0).toFixed(2)) ?? Number.MAX_VALUE;

    let teamNoRateTie = parseFloat(parseFloat(redisData?.teamNoRateTie || 0).toFixed(2)) ?? Number.MAX_VALUE;
    let teamYesRateTie = parseFloat(parseFloat(redisData?.teamYesRateTie || 0).toFixed(2)) ?? Number.MAX_VALUE;

    let teamNoRateComplete = parseFloat(parseFloat(redisData?.teamNoRateComplete || 0).toFixed(2)) ?? Number.MAX_VALUE;
    let teamYesRateComplete = parseFloat(parseFloat(redisData?.teamYesRateComplete || 0).toFixed(2)) ?? Number.MAX_VALUE;

    maxLoss = (Math.abs(Math.min(teamARate, teamBRate, isNaN(teamCRate) ? 0 : teamCRate, 0)) + Math.abs(Math.min(teamNoRateTie, teamYesRateTie, 0)) + Math.abs(Math.min(teamNoRateComplete, teamYesRateComplete, 0))) || 0;

    logger.info({
      maxLoss: maxLoss
    });

    user.user.userBalance.exposure = user.user.userBalance.exposure + maxLoss;

    logger.info({
      message: "Update user exposure.",
      data: user.user.exposure
    });

    let result = resultDeclare?.[0]?.result;
    if (result == resultType.tie) {
      getWinAmount = getMultipleAmount.winAmountTied + getMultipleAmount.winAmountComplete;
      getLossAmount = getMultipleAmount.lossAmountTied + getMultipleAmount.lossAmountComplete;
    }
    else if (result == resultType.noResult) {
      getWinAmount = getMultipleAmount.winAmountComplete;
      getLossAmount = getMultipleAmount.lossAmountComplete;
    }
    else {
      getWinAmount = getMultipleAmount.winAmount + getMultipleAmount.winAmountTied + getMultipleAmount.winAmountComplete;
      getLossAmount = getMultipleAmount.lossAmount + getMultipleAmount.lossAmountTied + getMultipleAmount.lossAmountComplete;
    }


    profitLoss = parseFloat(getWinAmount.toString()) - parseFloat(getLossAmount.toString());
    fwProfitLoss = parseFloat((parseFloat(fwProfitLoss.toString()) - parseFloat(((-profitLoss * user.user.fwPartnership) / 100).toString())).toFixed(2));

    let userCurrentBalance = parseFloat(user.user.userBalance.currentBalance);
    matchOddsWinBets?.filter((item) => item.createBy == user.user.id)?.forEach((matchOddData, uniqueId) => {
      userCurrentBalance += parseFloat(parseFloat((matchOddData?.winAmount) / 100).toFixed(2))
      bulkWalletRecord.push({
        matchId: matchId,
        actionBy: userId,
        searchId: user.user.id,
        userId: user.user.id,
        amount: parseFloat(parseFloat((matchOddData?.winAmount) / 100).toFixed(2)),
        transType: transType.win,
        closingBalance: userCurrentBalance,
        createdAt: new Date(),
        description: `Revert deducted 1% for bet on match odds ${matchOddData?.eventType}/${matchOddData.eventName}-${matchOddData.teamName} on odds ${matchOddData.odds}/${matchOddData.betType} of stake ${matchOddData.amount} `,
        uniqueId: uniqueId,
        betId: [matchDetailsBetIds?.find((item) => item?.type == matchBettingType.matchOdd)?.id]
      });
    });


    // deducting 1% from match odd win amount 
    if (parseFloat(getMultipleAmount?.winAmountMatchOdd) > 0) {
      profitLoss -= parseFloat(((parseFloat(getMultipleAmount?.winAmountMatchOdd) / 100)).toFixed(2));
    }

    const userCurrBalance = Number(
      (user.user.userBalance.currentBalance - profitLoss).toFixed(2)
    );

    let userBalanceData = {
      currentBalance: userCurrBalance,
      profitLoss: user.user.userBalance.profitLoss - profitLoss,
      myProfitLoss: user.user.userBalance.myProfitLoss - profitLoss,
      exposure: user.user.userBalance.exposure,
    }

    let totalCommissionData = 0;
    let userCommission = commissionData?.find((item) => item?.userId == user.user.id);
    if (userCommission) {
      userBalanceData.totalCommission = parseFloat(user.user.userBalance.totalCommission) - parseFloat(userCommission?.amount || 0);
      totalCommissionData += parseFloat(userCommission?.amount || 0);
    }

    if (user.user.createBy === user.user.id) {
      superAdminData[user.user.id] = {
        role: user.user.roleName,
        profitLoss: profitLoss,
        myProfitLoss: profitLoss,
        exposure: maxLoss,
        totalCommission: parseFloat(commissionData?.find((item) => item?.userId == user.user.id)?.amount || 0)
      };
    }


    const matchTeamRates = {
      ...(teamARate != Number.MAX_VALUE && teamARate != null && teamARate != undefined ? { [redisKeys.userTeamARate + matchId]: teamARate } : {}),
      ...(teamBRate != Number.MAX_VALUE && teamBRate != null && teamBRate != undefined ? { [redisKeys.userTeamBRate + matchId]: teamBRate } : {}),
      ...(teamCRate != Number.MAX_VALUE && teamCRate != null && teamCRate != undefined ? { [redisKeys.userTeamCRate + matchId]: teamCRate } : {}),
      ...(teamYesRateTie != Number.MAX_VALUE && teamYesRateTie != null && teamYesRateTie != undefined ? { [redisKeys.yesRateTie + matchId]: teamYesRateTie } : {}),
      ...(teamNoRateTie != Number.MAX_VALUE && teamNoRateTie != null && teamNoRateTie != undefined ? { [redisKeys.noRateTie + matchId]: teamNoRateTie } : {}),
      ...(teamYesRateComplete != Number.MAX_VALUE && teamYesRateComplete != null && teamYesRateComplete != undefined ? { [redisKeys.yesRateComplete + matchId]: teamYesRateComplete } : {}),
      ...(teamNoRateComplete != Number.MAX_VALUE && teamNoRateComplete != null && teamNoRateComplete != undefined ? { [redisKeys.noRateComplete + matchId]: teamNoRateComplete } : {})
    }

    await updateUserBalanceData(user.user.id, {
      profitLoss: -profitLoss,
      myProfitLoss: -profitLoss,
      exposure: maxLoss,
      totalCommission: -totalCommissionData
    });

    if (userRedisData?.exposure) {

      await incrementValuesRedis(user.user.id, {
        currentBalance: -profitLoss,
        profitLoss: -profitLoss,
        myProfitLoss: -profitLoss,
        exposure: maxLoss,
        [redisKeys.userMatchExposure + matchId]: maxLoss
      }, matchTeamRates);
    }

    logger.info({
      message: "user save at un declare result",
      data: user
    })

    sendMessageToUser(user.user.id, redisEventName, { ...user.user, betId, matchId, matchExposure: maxLoss, userBalanceData });

    // deducting 1% from match odd win amount 
    if (parseFloat(getMultipleAmount?.winAmountMatchOdd) > 0) {
      user.user.userBalance.currentBalance = parseFloat(parseFloat(user.user.userBalance.currentBalance + (parseFloat(getMultipleAmount?.winAmountMatchOdd) / 100)).toFixed(2));
    }

    let currBal = user.user.userBalance.currentBalance;

    const transactions = [
      ...(result != resultType.tie && result != resultType.noResult && parseFloat(getMultipleAmount.matchOddBetsCount || 0) > 0 ? [{
        winAmount: parseFloat(parseFloat(getMultipleAmount.winAmount).toFixed(2)),
        lossAmount: parseFloat(parseFloat(getMultipleAmount.lossAmount).toFixed(2)),
        type: "MATCH ODDS",
        result: result,
        betId: matchDetailsBetIds?.filter((item) => item?.type == matchBettingType.matchOdd || item?.type == matchBettingType.quickbookmaker1 || item?.type == matchBettingType.quickbookmaker2 || item?.type == matchBettingType.quickbookmaker3 || item?.type == matchBettingType.bookmaker)?.map((item) => item?.id)
      }] : []),
      ...(result != resultType.noResult && parseFloat(getMultipleAmount.tiedBetsCount || 0) > 0 ? [{
        winAmount: parseFloat(parseFloat(getMultipleAmount.winAmountTied).toFixed(2)),
        lossAmount: parseFloat(parseFloat(getMultipleAmount.lossAmountTied).toFixed(2)),
        type: "Tied Match",
        result: result == resultType.tie ? "YES" : "NO",
        betId: matchDetailsBetIds?.filter((item) => item?.type == matchBettingType.tiedMatch1 || item?.type == matchBettingType.tiedMatch2)?.map((item) => item?.id)
      }] : []),

      ...(parseFloat(getMultipleAmount.completeBetsCount || 0) > 0 ? [{
        winAmount: parseFloat(parseFloat(getMultipleAmount.winAmountComplete).toFixed(2)),
        lossAmount: parseFloat(parseFloat(getMultipleAmount.lossAmountComplete).toFixed(2)),
        type: "Complete Match",
        result: "YES",
        betId: matchDetailsBetIds?.filter((item) => item?.type == matchBettingType.completeMatch)?.map((item) => item?.id)
      }] : [])
    ];


    transactions?.forEach((item, uniqueId) => {
      currBal = currBal - item.winAmount + item.lossAmount;
      bulkWalletRecord.push({
        matchId: matchId,
        actionBy: userId,
        searchId: user.user.id,
        userId: user.user.id,
        amount: -(item.winAmount - item.lossAmount),
        transType: -(item.winAmount - item.lossAmount) < 0 ? transType.loss : transType.win,
        closingBalance: currBal,
        description: `Revert ${user?.eventType}/${user?.eventName}/${item.type}-${item.result}`,
        createdAt: new Date(),
        uniqueId: uniqueId,
        betId: item?.betId
      });
    });



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


        Object.keys(matchTeamRates)?.forEach((item) => {
          if (matchTeamRates[item] && upperUserObj[patentUser.id][item]) {
            upperUserObj[patentUser.id][item] += -parseFloat((parseFloat(matchTeamRates[item]) * parseFloat(user?.user[`${partnershipPrefixByRole[patentUser?.roleName]}Partnership`]) / 100).toFixed(2))
          }
          else {
            upperUserObj[patentUser.id][item] = -parseFloat((parseFloat(matchTeamRates[item]) * parseFloat(user?.user[`${partnershipPrefixByRole[patentUser?.roleName]}Partnership`]) / 100).toFixed(2))
          }
        });

      } else {
        upperUserObj[patentUser.id] = { profitLoss: profitLoss, myProfitLoss: myProfitLoss, exposure: maxLoss };

        if (!parentCommissionIds.has(patentUser.id)) {
          parentCommissionIds.add(patentUser.id);

          let userCommission = commissionData?.find((item) => item?.userId == patentUser.id);
          if (userCommission) {
            upperUserObj[patentUser.id].totalCommission = parseFloat((parseFloat(userCommission?.amount || 0) * parseFloat(upLinePartnership) / 100).toFixed(2));
          }
        }

        Object.keys(matchTeamRates)?.forEach((item) => {
          if (matchTeamRates[item]) {
            upperUserObj[patentUser.id][item] = -parseFloat((parseFloat(matchTeamRates[item]) * parseFloat(user?.user[`${partnershipPrefixByRole[patentUser?.roleName]}Partnership`]) / 100).toFixed(2))
          }
        });
      }


      if (patentUser.createBy === patentUser.id) {
        superAdminData[patentUser.id] = {
          ...upperUserObj[patentUser.id],
          role: patentUser.roleName,
        };
      }
    }


    Object.keys(matchTeamRates)?.forEach((item) => {
      if (user.user.superParentType == userRoleConstant.fairGameAdmin) {
        if (faAdminCal.admin?.[user.user.superParentId]?.[item]) {
          faAdminCal.admin[user.user.superParentId][item] += -parseFloat((parseFloat(matchTeamRates[item]) * parseFloat(user?.user[`faPartnership`]) / 100).toFixed(2))
        }
        else {
          if (!faAdminCal.admin[user.user.superParentId]) {
            faAdminCal.admin[user.user.superParentId] = {};
          }
          faAdminCal.admin[user.user.superParentId][item] = -parseFloat((parseFloat(matchTeamRates[item]) * parseFloat(user?.user[`faPartnership`]) / 100).toFixed(2))
        }
      }
      if (faAdminCal.wallet[item]) {
        faAdminCal.wallet[item] += -parseFloat((parseFloat(matchTeamRates[item]) * parseFloat(user?.user[`fwPartnership`]) / 100).toFixed(2))
      }
      else {
        faAdminCal.wallet[item] = -parseFloat((parseFloat(matchTeamRates[item]) * parseFloat(user?.user[`fwPartnership`]) / 100).toFixed(2))
      }
    });


    faAdminCal.admin[user.user.superParentId] = {
      ...faAdminCal.admin[user.user.superParentId],
      profitLoss: profitLoss + (faAdminCal.admin[user.user.superParentId]?.profitLoss || 0),
      exposure: maxLoss + (faAdminCal.admin[user.user.superParentId]?.exposure || 0),
      myProfitLoss: parseFloat((parseFloat(faAdminCal.admin[user.user.superParentId]?.myProfitLoss || 0) + (parseFloat(profitLoss) * parseFloat(user.user.fwPartnership) / 100)).toFixed(2)),
      role: user.user.superParentType
    }

    faAdminCal.fwWalletDeduction = (faAdminCal.fwWalletDeduction || 0);
  };
  return { fwProfitLoss, faAdminCal, superAdminData };
}

exports.declareOtherMatchResult = async (req, res) => {
  try {
    const { result, matchDetails, userId, matchId, match, betId, betType:matchBetType } = req.body;
   
    const betIds = matchBetType == matchBettingType.quickbookmaker1 ? matchDetails?.filter((item) => mainMatchMarketType.includes(item?.type))?.map((item) => item?.id) : [betId];
    const betPlaced = await getMatchBetPlaceWithUser(betIds);

    logger.info({
      message: "Other match result declared.",
      data: {
        betIds,
        result,
      },
    });

    let updateRecords = [];
    // let bulkCommission = {};
    // let commissions = {};
    let matchOddWinBets = [];
    const userData = new Set();
    for (let item of betPlaced) {
    if (result === resultType.noResult) {
          item.result = betResultStatus.TIE;
      } else {
        const isWinCondition = ((item.betType === betType.BACK && item.teamName === result) || (item.betType === betType.LAY && item.teamName !== result));
        item.result = isWinCondition ? betResultStatus.WIN : betResultStatus.LOSS;
      }
      // if (item.user.matchCommission && item.result == betResultStatus.LOSS && item.user.matchComissionType == matchComissionTypeConstant.entryWise) {
      //   let commissionAmount = Number((parseFloat(item.lossAmount) * (parseFloat(item.user['matchCommission']) / 100)).toFixed(2));
      //   commissionAmount = Math.abs(commissionAmount);
      //   if (commissions[item?.user?.id]) {
      //     commissions[item?.user?.id] = parseFloat(commissions[item?.user?.id]) + parseFloat(commissionAmount);
      //   } else {

      //     commissions[item?.user?.id] = commissionAmount;
      //   }
      // }
      // if (item.result == betResultStatus.LOSS) {
      //   bulkCommission[item?.user?.id] = [...(bulkCommission[item?.user?.id] || []),
      //   {
      //     matchId: matchId,
      //     betId: matchDetails?.find((items) => items.type == matchBettingType.quickbookmaker1)?.id,
      //     betPlaceId: item?.id,
      //     amount: item?.amount,
      //     sessionName: item?.eventName,
      //     betPlaceDate: item?.createdAt,
      //     odds: item?.odds,
      //     betType: item?.betType,
      //     stake: item?.amount,
      //     lossAmount: item?.lossAmount,
      //     superParent: item?.user?.superParentId, userName: item.user?.userName
      //   }
      //   ];
      // }

      if (item.result == betResultStatus.WIN && item.marketType == matchBettingType.matchOdd) {
        matchOddWinBets.push(item)
      }

      updateRecords.push(item);
      userData.add(item?.user?.id);
    }

    await addNewBet(updateRecords);


    let users = await getUserDataWithUserBalanceDeclare({ id: In([...userData]) });

    let upperUserObj = {};
    let bulkWalletRecord = [];
    // let commissionReport = [];
    const profitLossData = await calculateProfitLossOtherMatchForUserDeclare(
     users,
      betIds,
      matchId,
      0,
      socketData.matchResult,
      userId,
      bulkWalletRecord,
      upperUserObj,
      result,
      match,
      // commissions,
      // bulkCommission,
      // commissionReport,
      betId,
      matchOddWinBets,
      matchDetails
    );

    insertBulkTransactions(bulkWalletRecord);
    logger.info({
      message: "Upper user for this bet.",
      data: { upperUserObj, betIds },
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
      // parentUser.totalCommission = parentUser.totalCommission + value["totalCommission"]
      if (parentUser.exposure < 0) {
        logger.info({
          message: "Exposure in negative for user: ",
          data: {
            betIds,
            matchId,
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
        // totalCommission: value["totalCommission"]
      });

      logger.info({
        message: "Declare result db update for parent ",
        data: {
          betIds,
          parentUser,
        },
      });
      if (parentUserRedisData?.exposure) {
        await incrementValuesRedis(key, {
          profitLoss: value?.["profitLoss"],
          myProfitLoss: -value["myProfitLoss"],
          exposure: -value["exposure"],
        });
        await deleteKeyFromUserRedis(key, ...redisKeysMarketWise[matchBetType]?.map((item) => item + matchId));
      }

      sendMessageToUser(key, socketData.matchResult, {
        ...parentUser,
        betId: betId,
        matchId,
        betType: matchBetType
      });
    }
    // insertBulkCommissions(commissionReport);
    broadcastEvent(socketData.declaredMatchResultAllUser, { matchId, gameType: match?.matchType, betId: betId, betType: matchBetType });
    if (matchBetType == matchBettingType.quickbookmaker1) {
      await updateMatchData({ id: matchId }, { stopAt: new Date() });
    }
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
      error: `Error at declare other match result for the user.`,
      stack: error.stack,
      message: error.message,
    });
    // Handle any errors and return an error response
    return ErrorResponse(error, req, res);
  }
};

const calculateProfitLossOtherMatchForUserDeclare = async (users, betId, matchId, fwProfitLoss, redisEventName, userId, bulkWalletRecord, upperUserObj, result, matchData,
  //  commission, bulkCommission, commissionReport,
   currBetId, matchOddWinBets, matchDetailsBetIds) => {

  let faAdminCal = {
    // commission: [],
    userData: {}
  };
  let superAdminData = {};

  for (let user of users) {
    user = { user: user };
    let getWinAmount = 0;
    let getLossAmount = 0;
    let profitLoss = 0;
    let userRedisData = await getUserRedisData(user.user.id);
    let getMultipleAmount = await getMultipleAccountOtherMatchProfitLoss(betId, user.user.id);

    Object.keys(getMultipleAmount)?.forEach((item) => {
      getMultipleAmount[item] = parseFloat(parseFloat(getMultipleAmount[item]).toFixed(2));
    });

    let maxLoss = 0;
    logger.info({ message: "Updated users", data: user.user });
    let currMatchBettingDetailsType = matchDetailsBetIds?.find((item) => item.id == currBetId)?.type;
    // check if data is already present in the redis or not
    if (userRedisData?.[otherEventMatchBettingRedisKey[currMatchBettingDetailsType]?.a + matchId]) {

      let teamARate = userRedisData?.[otherEventMatchBettingRedisKey[currMatchBettingDetailsType]?.a + matchId] ?? Number.MAX_VALUE;
      let teamBRate = userRedisData?.[otherEventMatchBettingRedisKey[currMatchBettingDetailsType]?.b + matchId] ?? Number.MAX_VALUE;
      let teamCRate = userRedisData?.[otherEventMatchBettingRedisKey[currMatchBettingDetailsType]?.c + matchId] ?? Number.MAX_VALUE;

      maxLoss = (Math.abs(Math.min(teamARate, teamBRate, isNaN(teamCRate) ? 0 : teamCRate, 0))) || 0;

    }
    else {
      // if data is not available in the redis then get data from redis and find max loss amount for all placed bet by user
      let redisData = await calculateProfitLossForOtherMatchToResult(betId, user.user?.id, matchData);
      const redisKeys = Object.values(redisData)?.find((item) => item?.type == currMatchBettingDetailsType);
      let teamARate = redisKeys?.rates?.a ?? Number.MAX_VALUE;
      let teamBRate = redisKeys?.rates?.b ?? Number.MAX_VALUE;
      let teamCRate = redisKeys?.rates?.c ?? Number.MAX_VALUE;

      maxLoss = (Math.abs(Math.min(teamARate, teamBRate, isNaN(teamCRate) ? 0 : teamCRate, 0))) || 0;
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

    let userCurrentBalance = parseFloat(user.user.userBalance.currentBalance);
    matchOddWinBets?.filter((item) => item.user.id == user.user.id)?.forEach((matchOddData, uniqueId) => {
      userCurrentBalance -= parseFloat(parseFloat((matchOddData?.winAmount) / 100).toFixed(2))
      bulkWalletRecord.push({
        matchId: matchId,
        actionBy: userId,
        searchId: user.user.id,
        userId: user.user.id,
        amount: -parseFloat(parseFloat((matchOddData?.winAmount) / 100).toFixed(2)),
        transType: transType.loss,
        closingBalance: userCurrentBalance,
        description: `Deduct 1% for bet on match odds ${matchOddData?.eventType}/${matchOddData.eventName}-${matchOddData.teamName} on odds ${matchOddData.odds}/${matchOddData.betType} of stake ${matchOddData.amount} `,
        createdAt: new Date(),
        uniqueId: uniqueId,
        betId: [matchDetailsBetIds?.find((item) => item?.type == matchBettingType.matchOdd)?.id]
      });
    });

    let userOriginalProfitLoss = profitLoss;

    // deducting 1% from match odd win amount 
    if (parseFloat(getMultipleAmount?.winAmountMatchOdd) > 0) {
      profitLoss -= parseFloat(((parseFloat(getMultipleAmount?.winAmountMatchOdd) / 100)).toFixed(2));
    }

    const userCurrBalance = Number(user.user.userBalance.currentBalance + profitLoss).toFixed(2);
    let userBalanceData = {
      currentBalance: userCurrBalance,
      profitLoss: user.user.userBalance.profitLoss + profitLoss,
      myProfitLoss: user.user.userBalance.myProfitLoss + profitLoss,
      exposure: user.user.userBalance.exposure
    }

    // let totalCommissionData = 0;

    // if (user.user.matchCommission) {
    //   if (user.user.matchComissionType == matchComissionTypeConstant.entryWise) {
    //     userBalanceData.totalCommission = parseFloat((parseFloat(user.user.userBalance.totalCommission) + parseFloat(getLossAmount) * parseFloat(user.user.matchCommission) / 100).toFixed(2));
    //     totalCommissionData += parseFloat((parseFloat(getLossAmount) * parseFloat(user.user.matchCommission) / 100).toFixed(2))
    //   }
    //   else if (userOriginalProfitLoss < 0) {
    //     userBalanceData.totalCommission = parseFloat((parseFloat(user.user.userBalance.totalCommission) + Math.abs(parseFloat(userOriginalProfitLoss)) * parseFloat(user.user.matchCommission) / 100).toFixed(2));
    //     totalCommissionData += parseFloat((Math.abs(parseFloat(userOriginalProfitLoss)) * parseFloat(user.user.matchCommission) / 100).toFixed(2))
    //   }
    // }

    await updateUserBalanceData(user.user.id, {
      profitLoss: profitLoss,
      myProfitLoss: profitLoss,
      exposure: -maxLoss,
      // totalCommission: totalCommissionData
    });

    if (userRedisData?.exposure) {

      await incrementValuesRedis(user.user.id, {
        profitLoss: profitLoss,
        myProfitLoss: profitLoss,
        exposure: -maxLoss,
        currentBalance: profitLoss
      });
    }

    // if (user?.user?.matchCommission) {

    //   if (user.user.matchComissionType == matchComissionTypeConstant.entryWise) {
    //     bulkCommission[user?.user?.id]?.forEach((item) => {
    //       commissionReport.push({
    //         createBy: user.user.id,
    //         matchId: item.matchId,
    //         betId: item?.betId,
    //         betPlaceId: item?.betPlaceId,
    //         commissionAmount: parseFloat((parseFloat(item?.lossAmount) * parseFloat(user?.user?.matchCommission) / 100).toFixed(2)),
    //         parentId: user.user.id,
    //       });
    //     });
    //   }
    //   else if (userOriginalProfitLoss < 0) {
    //     commissionReport.push({
    //       createBy: user.user.id,
    //       matchId: matchId,
    //       betId: currBetId,
    //       commissionAmount: parseFloat((parseFloat(Math.abs(userOriginalProfitLoss)) * parseFloat(user?.user?.matchCommission) / 100).toFixed(2)),
    //       parentId: user.user.id,
    //       stake: userOriginalProfitLoss
    //     });
    //   }
    //   if (user?.user?.id == user?.user?.createBy) {
    //     if (user.user.matchComissionType == matchComissionTypeConstant.entryWise) {
    //       bulkCommission[user?.user?.id]?.forEach((item) => {
    //         faAdminCal.commission.push({
    //           createBy: user.user.id,
    //           matchId: item.matchId,
    //           betId: item?.betId,
    //           betPlaceId: item?.betPlaceId,
    //           parentId: user.user.id,
    //           teamName: item?.sessionName,
    //           betPlaceDate: new Date(item?.betPlaceDate),
    //           odds: item?.odds,
    //           betType: item?.betType,
    //           stake: item?.stake,
    //           commissionAmount: parseFloat((parseFloat(item?.lossAmount) * parseFloat(user?.user?.matchCommission) / 100).toFixed(2)),
    //           partnerShip: 100,
    //           matchName: matchData?.title,
    //           matchStartDate: new Date(matchData?.startAt),
    //           userName: user.user.userName

    //         });
    //       });
    //     }
    //     else if (userOriginalProfitLoss < 0) {
    //       faAdminCal.commission.push({
    //         createBy: user.user.id,
    //         matchId: matchId,
    //         betId: currBetId,
    //         parentId: user.user.id,
    //         commissionAmount: parseFloat((parseFloat(Math.abs(userOriginalProfitLoss)) * parseFloat(user?.user?.matchCommission) / 100).toFixed(2)),
    //         partnerShip: 100,
    //         matchName: matchData?.title,
    //         matchStartDate: new Date(matchData?.startAt),
    //         userName: user.user.userName,
    //         stake: userOriginalProfitLoss
    //       });
    //     }
    //   }
    // }

    sendMessageToUser(user.user.id, redisEventName, { ...user.user, betId: currBetId, matchId, userBalanceData, betType: currMatchBettingDetailsType });

    // deducting 1% from match odd win amount 
    if (parseFloat(getMultipleAmount?.winAmountMatchOdd) > 0) {
      user.user.userBalance.currentBalance = parseFloat(parseFloat(user.user.userBalance.currentBalance - (parseFloat(getMultipleAmount?.winAmountMatchOdd) / 100)).toFixed(2));
    }

    let currBal = user.user.userBalance.currentBalance;

    const transactions = [
      ...(result != resultType.noResult ? [{
        winAmount: parseFloat(getMultipleAmount.winAmount),
        lossAmount: parseFloat(getMultipleAmount.lossAmount),
        type: currMatchBettingDetailsType == matchBettingType.quickbookmaker1 ? "MATCH ODDS" : matchDetailsBetIds?.find((item) => item?.id == currBetId)?.name,
        result: result,
        betId: betId
      }] : [])
    ];

    transactions.forEach((item, uniqueId) => {
      currBal = currBal + item.winAmount - item.lossAmount;

      bulkWalletRecord.push({
        matchId: matchId,
        actionBy: userId,
        searchId: user.user.id,
        userId: user.user.id,
        amount: item.winAmount - item.lossAmount,
        transType: item.winAmount - item.lossAmount > 0 ? transType.win : transType.loss,
        closingBalance: currBal,
        description: `${matchData?.matchType}/${matchData?.title}/${item.type} - ${item.result} ${scoreBasedMarket.find((item) => currMatchBettingDetailsType?.startsWith(item) && result != resultType.noResult) ? `${extractNumbersFromString(currMatchBettingDetailsType)} Goals` : ""}`,
        createdAt: new Date(),
        uniqueId: uniqueId,
        betId: item?.betId
      });
    });

    await deleteKeyFromUserRedis(user.user.id, redisKeys.userMatchExposure + matchId, ...redisKeysMarketWise[currMatchBettingDetailsType]?.map((item) => item + matchId));

    if (user.user.createBy === user.user.id) {
      superAdminData[user.user.id] = {
        role: user.user.roleName,
        profitLoss: profitLoss,
        myProfitLoss: profitLoss,
        exposure: maxLoss,
        // totalCommission: (user.user.matchComissionType == matchComissionTypeConstant.entryWise ? (commission[user.user.id] || 0) : userOriginalProfitLoss < 0 ? parseFloat((parseFloat(Math.abs(userOriginalProfitLoss)) * parseFloat(user?.user?.matchCommission) / 100).toFixed(2)) : 0)
      };
    }

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
      // let parentCommission = parseFloat((((parseFloat(patentUser?.matchCommission) * ((patentUser.matchComissionType == matchComissionTypeConstant.entryWise ? getLossAmount : userOriginalProfitLoss < 0 ? Math.abs(userOriginalProfitLoss) : 0))) / 10000) * parseFloat(upLinePartnership)).toFixed(2));

      if (upperUserObj[patentUser.id]) {
        upperUserObj[patentUser.id].profitLoss = upperUserObj[patentUser.id].profitLoss + profitLoss;
        upperUserObj[patentUser.id].myProfitLoss = upperUserObj[patentUser.id].myProfitLoss + myProfitLoss;
        upperUserObj[patentUser.id].exposure = upperUserObj[patentUser.id].exposure + maxLoss;

        // if (patentUser?.matchCommission && parseFloat(patentUser?.matchCommission) != 0) {
        //   upperUserObj[patentUser.id].totalCommission += parentCommission;
        // }
      } else {
        upperUserObj[patentUser.id] = { profitLoss: profitLoss, myProfitLoss: myProfitLoss, exposure: maxLoss,
          //  ...(patentUser?.matchCommission && parseFloat(patentUser?.matchCommission) != 0 ? { totalCommission: parentCommission } : {}) 
          };
      }

      if (patentUser.createBy === patentUser.id) {
        superAdminData[patentUser.id] = {
          ...upperUserObj[patentUser.id],
          role: patentUser.roleName,
        };
      }

      // if (patentUser?.matchCommission) {
      //   if (patentUser.matchComissionType == matchComissionTypeConstant.entryWise) {
      //     bulkCommission[user?.user?.id]?.forEach((item) => {
      //       commissionReport.push({
      //         createBy: user.user.id,
      //         matchId: item.matchId,
      //         betId: item?.betId,
      //         betPlaceId: item?.betPlaceId,
      //         commissionAmount: parseFloat((parseFloat(item?.lossAmount) * parseFloat(patentUser?.matchCommission) / 100).toFixed(2)),
      //         parentId: patentUser.id,
      //       });
      //     });
      //   }
      //   else if (userOriginalProfitLoss < 0) {
      //     commissionReport.push({
      //       createBy: user.user.id,
      //       matchId: matchId,
      //       betId: currBetId,
      //       commissionAmount: parseFloat((parseFloat(Math.abs(userOriginalProfitLoss)) * parseFloat(patentUser?.matchCommission) / 100).toFixed(2)),
      //       parentId: patentUser.id,
      //       stake: userOriginalProfitLoss

      //     });
      //   }
      //   if (patentUser?.id == patentUser?.createBy) {
      //     if (patentUser.matchComissionType == matchComissionTypeConstant.entryWise) {
      //       bulkCommission[user?.user?.id]?.forEach((item) => {
      //         faAdminCal.commission.push({
      //           createBy: user.user.id,
      //           matchId: item.matchId,
      //           betId: item?.betId,
      //           betPlaceId: item?.betPlaceId,
      //           parentId: patentUser.id,
      //           teamName: item?.sessionName,
      //           betPlaceDate: item?.betPlaceDate,
      //           odds: item?.odds,
      //           betType: item?.betType,
      //           stake: item?.stake,
      //           commissionAmount: parseFloat((parseFloat(item?.lossAmount) * parseFloat(patentUser?.matchCommission) / 100).toFixed(2)),
      //           partnerShip: upLinePartnership,
      //           matchName: matchData?.title,
      //           matchStartDate: matchData?.startAt,
      //           userName: user.user.userName

      //         });
      //       });
      //     }
      //     else if (userOriginalProfitLoss < 0) {
      //       faAdminCal.commission.push({
      //         createBy: user.user.id,
      //         matchId: matchId,
      //         betId: currBetId,
      //         parentId: patentUser.id,
      //         commissionAmount: parseFloat((parseFloat(Math.abs(userOriginalProfitLoss)) * parseFloat(patentUser?.matchCommission) / 100).toFixed(2)),
      //         partnerShip: upLinePartnership,
      //         matchName: matchData?.title,
      //         matchStartDate: matchData?.startAt,
      //         userName: user.user.userName,
      //         stake: userOriginalProfitLoss

      //       });
      //     }
      //   }
      // }
    }

    faAdminCal.userData[user.user.superParentId] = {
      profitLoss: profitLoss + (faAdminCal.userData?.[user.user.superParentId]?.profitLoss || 0),
      exposure: maxLoss + (faAdminCal.userData?.[user.user.superParentId]?.exposure || 0),
      myProfitLoss: parseFloat((((faAdminCal.userData?.[user.user.superParentId]?.profitLoss || 0)) + ((profitLoss) * (user.user.superParentType == userRoleConstant.fairGameAdmin ? parseFloat(user.user.fwPartnership) : 1) / 100)).toFixed(2)),
      userOriginalProfitLoss: userOriginalProfitLoss + (faAdminCal.userData?.[user.user.superParentId]?.userOriginalProfitLoss || 0),
      role: user.user.superParentType
    }

    faAdminCal.fwWalletDeduction = 0;

  };
  return { fwProfitLoss, faAdminCal, superAdminData,
    //  bulkCommission
     };
}

exports.unDeclareOtherMatchResult = async (req, res) => {
  try {

    const { matchId, match, matchBetting, userId, matchOddId, betType: matchBetType } = req.body;

    const betIds = matchBetType == matchBettingType.quickbookmaker1 ? matchBetting?.filter((item) => mainMatchMarketType.includes(item?.type))?.map((item) => item?.id) : [matchOddId];
    let users = await getDistinctUserBetPlaced(In(betIds));

    logger.info({
      message: "Match result un declared.",
      data: {
        betIds
      }
    });

    let upperUserObj = {};
    let bulkWalletRecord = [];
    let matchOddsWinBets=[];
    if (matchBetType == matchBettingType.quickbookmaker1) {
      matchOddsWinBets = await findAllPlacedBet({
        marketType: matchBettingType.matchOdd,
        result: betResultStatus.WIN,
        matchId: matchId,
      });
    }
    // const commissionData = await getCombinedCommission(matchOddId);
    const profitLossData = await calculateProfitLossOtherMatchForUserUnDeclare(
      users,
      betIds,
      matchId,
      0,
      matchBetting,
      socketData.matchResultUnDeclare,
      userId,
      bulkWalletRecord,
      upperUserObj,
      match,
      // commissionData, 
      matchOddsWinBets,
       matchBetting,
       matchBetType,
       matchOddId
    );
    // deleteCommission(matchOddId);

    insertBulkTransactions(bulkWalletRecord);
    logger.info({
      message: "Upper user for this bet.",
      data: { upperUserObj, betIds }
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


      parentUser.profitLoss = parentProfitLoss - value?.["profitLoss"];
      parentUser.myProfitLoss = parentMyProfitLoss + value["myProfitLoss"];
      parentUser.exposure = parentExposure + value["exposure"];
      // parentUser.totalCommission = parseFloat(parentUser.totalCommission || 0) - parseFloat(value["totalCommission"] || 0);
      if (parentUser.exposure < 0) {
        logger.info({
          message: "Exposure in negative for user: ",
          data: {
            matchId,
            parentUser,
          },
        });
        value["exposure"] += parentUser.exposure;
        parentUser.exposure = 0;
      }

      await updateUserBalanceData(parentUser.userId, {
        balance: 0,
        profitLoss: -value?.["profitLoss"],
        myProfitLoss: value["myProfitLoss"],
        exposure: value["exposure"],
        // totalCommission: -parseFloat(value["totalCommission"] || 0)
      });

      logger.info({
        message: "Declare result db update for parent ",
        data: {
          parentUser,
          betIds
        },
      });

      if (parentUserRedisData?.exposure) {
        let { exposure, profitLoss, myProfitLoss, ...parentRedisUpdateObj } = value;
        await incrementValuesRedis(parentUser.userId, {
          profitLoss: -value?.["profitLoss"],
          myProfitLoss: value["myProfitLoss"],
          exposure: value["exposure"],
          [redisKeys.userMatchExposure + matchId]: value["exposure"]
        }, parentRedisUpdateObj);
      }

      sendMessageToUser(key, socketData.matchResultUnDeclare, {
        ...parentUser,
        matchId,
        betId: betIds,
        profitLossData: value,
        betType: matchBetType,
        teamArateRedisKey: `${otherEventMatchBettingRedisKey[matchBetType]?.a}${matchId}`,
        teamBrateRedisKey: `${otherEventMatchBettingRedisKey[matchBetType]?.b}${matchId}`,
        teamCrateRedisKey: `${otherEventMatchBettingRedisKey[matchBetType]?.c}${matchId}`,
      });
    }

    await updatePlaceBet(
      {
        betId: In(betIds),
        deleteReason: IsNull(),
      },
      {
        result: betResultStatus.PENDING,
      }
    );

    broadcastEvent(socketData.unDeclaredMatchResultAllUser, { matchId, gameType: match?.matchType, betId: betIds });
    if (matchBetType == matchBettingType.quickbookmaker1) {
      await updateMatchData({ id: matchId }, { stopAt: null });
    }

    return SuccessResponse(
      {
        statusCode: 200,
        message: { msg: "bet.resultUnDeclared" },
        data: profitLossData
      },
      req,
      res
    );
  } catch (error) {
    logger.error({
      error: `Error at un declare match result for the user.`,
      stack: error.stack,
      message: error.message,
    });
    // Handle any errors and return an error response
    return ErrorResponse(error, req, res);
  }
}

const calculateProfitLossOtherMatchForUserUnDeclare = async (users, betId, matchId, fwProfitLoss, resultDeclare, redisEventName, userId, bulkWalletRecord, upperUserObj, matchData,
  //  commissionData, 
  matchOddsWinBets, matchDetailsBetIds, merketBetType, currBetId) => {

  let faAdminCal = {
    admin: {},
    wallet: {}
  };
  let superAdminData = {};

  // let parentCommissionIds = new Set();

  for (const user of users) {
    let getWinAmount = 0;
    let getLossAmount = 0;
    let profitLoss = 0;
    let userRedisData = await getUserRedisData(user.user.id);
    let getMultipleAmount = await getMultipleAccountOtherMatchProfitLoss(betId, user.user.id);

    Object.keys(getMultipleAmount)?.forEach((item) => {
      getMultipleAmount[item] = parseFloat(parseFloat(getMultipleAmount[item]).toFixed(2));
    });
    let maxLoss = 0;

    logger.info({ message: "Updated users", data: user.user });

    // if data is not available in the redis then get data from redis and find max loss amount for all placed bet by user
    let redisData = await calculateProfitLossForOtherMatchToResult(betId, user.user?.id, matchData);
    let redisPLData;
    if (merketBetType == matchBettingType.quickbookmaker1) {
      redisPLData = redisData?.[profitLossKeys.matchOdd];
    }
    else {
      redisPLData = Object.values(redisData)?.find((item) => item?.type == merketBetType);
    }
    let teamARate = redisPLData?.rates?.a ?? Number.MAX_VALUE;
    let teamBRate = redisPLData?.rates?.b ?? Number.MAX_VALUE;
    let teamCRate = redisPLData?.rates?.c ?? Number.MAX_VALUE;

    maxLoss = (Math.abs(Math.min(teamARate, teamBRate, isNaN(teamCRate) ? 0 : teamCRate, 0)) ) || 0;

    logger.info({
      maxLoss: maxLoss
    });

    user.user.userBalance.exposure = user.user.userBalance.exposure + maxLoss;

    logger.info({
      message: "Update user exposure.",
      data: user.user.exposure
    });

    let result = resultDeclare?.[0]?.result;

    if (scoreBasedMarket.find((item) => merketBetType?.startsWith(item)) && result != resultType.noResult) {
      const currScore = extractNumbersFromString(merketBetType);
      result = parseFloat(result) < parseFloat(currScore) ? "UNDER" : "OVER";
    }

    getWinAmount = getMultipleAmount.winAmount;
    getLossAmount = getMultipleAmount.lossAmount;

    profitLoss = parseFloat(getWinAmount.toString()) - parseFloat(getLossAmount.toString());
    fwProfitLoss = parseFloat((parseFloat(fwProfitLoss.toString()) - parseFloat(((-profitLoss * user.user.fwPartnership) / 100).toString())).toFixed(2));

    let userCurrentBalance = parseFloat(user.user.userBalance.currentBalance);

    if (merketBetType == matchBettingType.quickbookmaker1) {

      matchOddsWinBets?.filter((item) => item.createBy == user.user.id)?.forEach((matchOddData, uniqueId) => {
        userCurrentBalance += parseFloat(parseFloat((matchOddData?.winAmount) / 100).toFixed(2))
        bulkWalletRecord.push({
          matchId: matchId,
          actionBy: userId,
          searchId: user.user.id,
          userId: user.user.id,
          amount: parseFloat(parseFloat((matchOddData?.winAmount) / 100).toFixed(2)),
          transType: transType.win,
          closingBalance: userCurrentBalance,
          createdAt: new Date(),
          description: `Revert deducted 1% for bet on match odds ${matchOddData?.eventType}/${matchOddData.eventName}-${matchOddData.teamName} on odds ${matchOddData.odds}/${matchOddData.betType} of stake ${matchOddData.amount} `,
          uniqueId: uniqueId,
          betId: [matchDetailsBetIds?.find((item) => item?.type == matchBettingType.matchOdd)?.id]
        });
      });
    }

    // deducting 1% from match odd win amount
    if (parseFloat(getMultipleAmount?.winAmountMatchOdd) > 0 && merketBetType == matchBettingType.quickbookmaker1) {
      profitLoss -= parseFloat(((parseFloat(getMultipleAmount?.winAmountMatchOdd) / 100)).toFixed(2));
    }

    const userCurrBalance = Number(
      (user.user.userBalance.currentBalance - profitLoss).toFixed(2)
    );

    let userBalanceData = {
      currentBalance: userCurrBalance,
      profitLoss: user.user.userBalance.profitLoss - profitLoss,
      myProfitLoss: user.user.userBalance.myProfitLoss - profitLoss,
      exposure: user.user.userBalance.exposure,
    }

    // let totalCommissionData = 0;
    // let userCommission = commissionData?.find((item) => item?.userId == user.user.id);
    // if (userCommission) {
    //   userBalanceData.totalCommission = parseFloat(user.user.userBalance.totalCommission) - parseFloat(userCommission?.amount || 0);
    //   totalCommissionData += parseFloat(userCommission?.amount || 0);
    // }

    if (user.user.createBy === user.user.id) {
      superAdminData[user.user.id] = {
        role: user.user.roleName,
        profitLoss: profitLoss,
        myProfitLoss: profitLoss,
        exposure: maxLoss,
        // totalCommission: parseFloat(commissionData?.find((item) => item?.userId == user.user.id)?.amount || 0)
      };
    }

    let matchTeamRates = {}
    Object.values(redisData)?.forEach((plData) => {

      matchTeamRates = {
        ...matchTeamRates,
        [otherEventMatchBettingRedisKey[plData?.type].a + matchId]: plData?.rates?.a,
        [otherEventMatchBettingRedisKey[plData?.type].b + matchId]: plData?.rates?.b,
        ...(plData?.rates?.c ? { [otherEventMatchBettingRedisKey[plData?.type].c + matchId]: plData?.rates?.c } : {}),
      }
    });

    await updateUserBalanceData(user.user.id, {
      profitLoss: -profitLoss,
      myProfitLoss: -profitLoss,
      exposure: maxLoss,
      // totalCommission: -totalCommissionData
    });

    if (userRedisData?.exposure) {

      await incrementValuesRedis(user.user.id, {
        currentBalance: -profitLoss,
        profitLoss: -profitLoss,
        myProfitLoss: -profitLoss,
        exposure: maxLoss,
        [redisKeys.userMatchExposure + matchId]: maxLoss
      }, matchTeamRates);
    }

    logger.info({
      message: "user save at un declare result",
      data: user
    });

    sendMessageToUser(user.user.id, redisEventName, {
      ...user.user, betId, matchId, matchExposure: maxLoss, userBalanceData, profitLoss: {
        teamA: teamARate,
        teamB: teamBRate,
        teamC: teamCRate
      },
      teamArateRedisKey: `${otherEventMatchBettingRedisKey[merketBetType]?.a}${matchId}`,
      teamBrateRedisKey: `${otherEventMatchBettingRedisKey[merketBetType]?.b}${matchId}`,
      teamCrateRedisKey: `${otherEventMatchBettingRedisKey[merketBetType]?.c}${matchId}`,
      betType: merketBetType,
      
    });

    // deducting 1% from match odd win amount 
    if (parseFloat(getMultipleAmount?.winAmountMatchOdd) > 0 && merketBetType == matchBettingType.quickbookmaker1) {
      user.user.userBalance.currentBalance = parseFloat(parseFloat(user.user.userBalance.currentBalance + (parseFloat(getMultipleAmount?.winAmountMatchOdd) / 100)).toFixed(2));
    }

    let currBal = user.user.userBalance.currentBalance;

    const transactions = [
      ...(result != resultType.noResult ? [{
        winAmount: parseFloat(parseFloat(getMultipleAmount.winAmount).toFixed(2)),
        lossAmount: parseFloat(parseFloat(getMultipleAmount.lossAmount).toFixed(2)),
        type: merketBetType == matchBettingType.quickbookmaker1 ? "MATCH ODDS" : matchDetailsBetIds?.find((item) => item?.id == currBetId)?.name,
        result: result,
        betId: betId
      }] : [])
    ];


    transactions?.forEach((item, uniqueId) => {
      currBal = currBal - item.winAmount + item.lossAmount;
      bulkWalletRecord.push({
        matchId: matchId,
        actionBy: userId,
        searchId: user.user.id,
        userId: user.user.id,
        amount: -(item.winAmount - item.lossAmount),
        transType: -(item.winAmount - item.lossAmount) < 0 ? transType.loss : transType.win,
        closingBalance: currBal,
        description: `Revert ${user?.eventType}/${user?.eventName}/${item.type} - ${item.result} ${scoreBasedMarket.find((item) => merketBetType?.startsWith(item) && result != resultType.noResult) ? `${extractNumbersFromString(merketBetType)} Goals` : ""}`,
        createdAt: new Date(),
        uniqueId: uniqueId,
        betId: item?.betId
      });
    });

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

        Object.keys(matchTeamRates)?.forEach((item) => {
          if (matchTeamRates[item] && upperUserObj[patentUser.id][item]) {
            upperUserObj[patentUser.id][item] += -parseFloat((parseFloat(matchTeamRates[item]) * parseFloat(user?.user[`${partnershipPrefixByRole[patentUser?.roleName]}Partnership`]) / 100).toFixed(2))
          }
          else {
            upperUserObj[patentUser.id][item] = -parseFloat((parseFloat(matchTeamRates[item]) * parseFloat(user?.user[`${partnershipPrefixByRole[patentUser?.roleName]}Partnership`]) / 100).toFixed(2))
          }
        });

      } else {
        upperUserObj[patentUser.id] = { profitLoss: profitLoss, myProfitLoss: myProfitLoss, exposure: maxLoss };

        // if (!parentCommissionIds.has(patentUser.id)) {
        //   parentCommissionIds.add(patentUser.id);

        //   let userCommission = commissionData?.find((item) => item?.userId == patentUser.id);
        //   if (userCommission) {
        //     upperUserObj[patentUser.id].totalCommission = parseFloat((parseFloat(userCommission?.amount || 0) * parseFloat(upLinePartnership) / 100).toFixed(2));
        //   }
        // }

        Object.keys(matchTeamRates)?.forEach((item) => {
          if (matchTeamRates[item]) {
            upperUserObj[patentUser.id][item] = -parseFloat((parseFloat(matchTeamRates[item]) * parseFloat(user?.user[`${partnershipPrefixByRole[patentUser?.roleName]}Partnership`]) / 100).toFixed(2))
          }
        });
      }

      if (patentUser.createBy === patentUser.id) {
        superAdminData[patentUser.id] = {
          ...upperUserObj[patentUser.id],
          role: patentUser.roleName,
        };
      }
    }

    Object.keys(matchTeamRates)?.forEach((item) => {
      if (user.user.superParentType == userRoleConstant.fairGameAdmin) {
        if (faAdminCal.admin?.[user.user.superParentId]?.[item]) {
          faAdminCal.admin[user.user.superParentId][item] += -parseFloat((parseFloat(matchTeamRates[item]) * parseFloat(user?.user[`faPartnership`]) / 100).toFixed(2))
        }
        else {
          if (!faAdminCal.admin[user.user.superParentId]) {
            faAdminCal.admin[user.user.superParentId] = {};
          }
          faAdminCal.admin[user.user.superParentId][item] = -parseFloat((parseFloat(matchTeamRates[item]) * parseFloat(user?.user[`faPartnership`]) / 100).toFixed(2))
        }
      }
      if (faAdminCal.wallet[item]) {
        faAdminCal.wallet[item] += -parseFloat((parseFloat(matchTeamRates[item]) * parseFloat(user?.user[`fwPartnership`]) / 100).toFixed(2))
      }
      else {
        faAdminCal.wallet[item] = -parseFloat((parseFloat(matchTeamRates[item]) * parseFloat(user?.user[`fwPartnership`]) / 100).toFixed(2))
      }
    });

    faAdminCal.admin[user.user.superParentId] = {
      ...faAdminCal.admin[user.user.superParentId],
      profitLoss: profitLoss + (faAdminCal.admin[user.user.superParentId]?.profitLoss || 0),
      exposure: maxLoss + (faAdminCal.admin[user.user.superParentId]?.exposure || 0),
      myProfitLoss: parseFloat((parseFloat(faAdminCal.admin[user.user.superParentId]?.myProfitLoss || 0) + (parseFloat(profitLoss) * parseFloat(user.user.fwPartnership) / 100)).toFixed(2)),
      role: user.user.superParentType
    }

    faAdminCal.fwWalletDeduction = (faAdminCal.fwWalletDeduction || 0);
  };
  return { fwProfitLoss, faAdminCal, superAdminData };
}

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
    totalLoss = `SUM(CASE WHEN placeBet.result = 'WIN' AND placeBet.marketType = 'matchOdd' THEN ROUND(placeBet.winAmount / 100, 2) ELSE 0 END) as "totalDeduction", ` + totalLoss;
    let subQuery = await childIdquery(user, searchId)
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
    let rateProfitLoss = `(Sum(CASE WHEN placeBet.result = '${betResultStatus.LOSS}' and (placeBet.betType = '${betType.BACK}' or placeBet.betType = '${betType.LAY}') then ROUND(placeBet.lossAmount / 100 * ${queryColumns}, 2) ELSE 0 END) - Sum(CASE WHEN placeBet.result = '${betResultStatus.WIN}' and (placeBet.betType = '${betType.BACK}' or placeBet.betType = '${betType.LAY}') then ROUND(placeBet.winAmount / 100 * ${queryColumns}, 2) ELSE 0 END)) as "rateProfitLoss"`;
    let sessionProfitLoss = `(Sum(CASE WHEN placeBet.result = '${betResultStatus.LOSS}' and (placeBet.betType = '${betType.YES}' or placeBet.betType = '${betType.NO}') then ROUND(placeBet.lossAmount / 100 * ${queryColumns}, 2) ELSE 0 END) - Sum(CASE WHEN placeBet.result = '${betResultStatus.WIN}' and (placeBet.betType = '${betType.YES}' or placeBet.betType = '${betType.NO}') then ROUND(placeBet.winAmount / 100 * ${queryColumns}, 2) ELSE 0 END)) as "sessionProfitLoss"`;

    if (req?.user?.roleName == userRoleConstant.user) {
      rateProfitLoss = '-' + rateProfitLoss;
      sessionProfitLoss = '-' + sessionProfitLoss;
    }
    let totalDeduction = `SUM(CASE WHEN placeBet.result = 'WIN' AND placeBet.marketType = 'matchOdd' THEN ROUND(placeBet.winAmount / 100, 2) ELSE 0 END) as "totalDeduction"`;
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
    let subQuery = await childIdquery(user, searchId)
    const result = await getBetsProfitLoss(where, totalLoss, subQuery);
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

exports.getUserWiseTotalProfitLoss = async (req, res) => {
  try {
    let { user, matchId, searchId, userIds, partnerShipRoleName } = req.body;
    user = user || req.user;

    let queryColumns = ``;
    let where = {};

    if (matchId) {
      where.matchId = matchId;
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
    let rateProfitLoss = `(Sum(CASE WHEN placeBet.result = '${betResultStatus.LOSS}' and (placeBet.betType = '${betType.BACK}' or placeBet.betType = '${betType.LAY}') then ROUND(placeBet.lossAmount / 100 * ${queryColumns}, 2) ELSE 0 END) - Sum(CASE WHEN placeBet.result = '${betResultStatus.WIN}' and (placeBet.betType = '${betType.BACK}' or placeBet.betType = '${betType.LAY}') then ROUND(placeBet.winAmount / 100 * ${queryColumns}, 2) ELSE 0 END)) as "rateProfitLoss"`;
    let sessionProfitLoss = `(Sum(CASE WHEN placeBet.result = '${betResultStatus.LOSS}' and (placeBet.betType = '${betType.YES}' or placeBet.betType = '${betType.NO}') then ROUND(placeBet.lossAmount / 100 * ${queryColumns}, 2) ELSE 0 END) - Sum(CASE WHEN placeBet.result = '${betResultStatus.WIN}' and (placeBet.betType = '${betType.YES}' or placeBet.betType = '${betType.NO}') then ROUND(placeBet.winAmount / 100 * ${queryColumns}, 2) ELSE 0 END)) as "sessionProfitLoss"`;

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
      let childUsersBalances = await getAllUsersBalanceSum();
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

    for (let userData of userIds?.split("|")) {
      userData = JSON.parse(userData);
      let userProfitLossData = {};


      let betsData = await getUserProfitLossForUpperLevel(userData, matchId);
      userProfitLossData = {
        teamRateA: betsData?.[redisKeys.userTeamARate + matchId] ? -parseFloat(betsData?.[redisKeys.userTeamARate + matchId]).toFixed(2) : 0, teamRateB: betsData?.[redisKeys.userTeamBRate + matchId] ? -parseFloat(betsData?.[redisKeys.userTeamBRate + matchId]).toFixed(2) : 0, teamRateC: betsData?.[redisKeys.userTeamCRate + matchId] ? -parseFloat(betsData?.[redisKeys.userTeamCRate + matchId]).toFixed(2) : 0,
        percentTeamRateA: betsData?.[redisKeys.userTeamARate + matchId] ? parseFloat(parseFloat(parseFloat(betsData?.[redisKeys.userTeamARate + matchId]).toFixed(2)) * parseFloat(userData.partnerShip) / 100).toFixed(2) : 0, percentTeamRateB: betsData?.[redisKeys.userTeamBRate + matchId] ? parseFloat(parseFloat(parseFloat(betsData?.[redisKeys.userTeamBRate + matchId]).toFixed(2)) * parseFloat(userData.partnerShip) / 100).toFixed(2) : 0, percentTeamRateC: betsData?.[redisKeys.userTeamCRate + matchId] ? parseFloat(parseFloat(parseFloat(betsData?.[redisKeys.userTeamCRate + matchId]).toFixed(2)) * parseFloat(userData.partnerShip) / 100).toFixed(2) : 0
      }
      userProfitLossData.userName = userData?.userName;

      if (userProfitLossData.teamRateA || userProfitLossData.teamRateB || userProfitLossData.teamRateC) {
        resUserData.push(userProfitLossData);
      }
    }
    return SuccessResponse(
      {
        statusCode: 200, data: resUserData
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

exports.getUsersRacingProfitLoss = async (req, res) => {
  try {
    const { userIds } = req.query;
    const { matchId } = req.params;

    const resUserData = [];

    for (let userData of userIds?.split("|")) {
      userData = JSON.parse(userData);
      let userProfitLossData = {};

      let totalPLVal=0;

      let betsData = await getUserProfitLossRacingForUpperLevel(userData, matchId);
      Object.keys(betsData)?.forEach((item)=>{
        Object.keys(betsData[item])?.forEach((items)=>{
          userProfitLossData[items] = -parseFloat(parseFloat(betsData[item][items]).toFixed(2)) || 0;
          userProfitLossData[items + "_percent"] = -parseFloat(parseFloat(betsData[item][items] * parseFloat(userData.partnerShip) / 100).toFixed(2)) || 0;
          totalPLVal += (betsData[item][items] || 0);
        });
      })
      userProfitLossData.userName = userData?.userName;

      if (totalPLVal !=0 ) {
        resUserData.push(userProfitLossData);
      }
    }
    return SuccessResponse(
      {
        statusCode: 200, data: resUserData
      },
      req,
      res
    );
  } catch (error) {
    logger.error({
      context: `Error in get profit loss user data race.`,
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
    const { roleName, userName, id } = req.query;

    let users = [];
    if (roleName == userRoleConstant.fairGameAdmin) {
      users = await getAllUsers({ superParentId: id, userName: ILike(`%${userName}%`) }, ["id", "userName"]);
    }
    else {
      users = await getAllUsers({ userName: ILike(`%${userName}%`) }, ["id", "userName"]);
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

exports.declarRaceMatchResult = async (req, res) => {
  try {
    const { result, matchDetails, userId, matchId, match, betId, betType: matchBetType } = req.body;
   
    const betIds = [betId];
    const betPlaced = await getMatchBetPlaceWithUser(betIds);

    logger.info({
      message: "Race match result declared.",
      data: {
        betIds,
        result,
      },
    });

    let updateRecords = [];
    // let bulkCommission = {};
    // let commissions = {};
    let matchOddWinBets = [];
    const userData = new Set();
    for (let item of betPlaced) {
    if (result === resultType.noResult) {
          item.result = betResultStatus.TIE;
      } else {
        item.result = ((item.betType === betType.BACK && item.runnerId == result) || (item.betType === betType.LAY && item.runnerId != result)) ? betResultStatus.WIN : betResultStatus.LOSS;
      }
      // if (item.user.matchCommission && item.result == betResultStatus.LOSS && item.user.matchComissionType == matchComissionTypeConstant.entryWise) {
      //   let commissionAmount = Number((parseFloat(item.lossAmount) * (parseFloat(item.user['matchCommission']) / 100)).toFixed(2));
      //   commissionAmount = Math.abs(commissionAmount);
      //   if (commissions[item?.user?.id]) {
      //     commissions[item?.user?.id] = parseFloat(commissions[item?.user?.id]) + parseFloat(commissionAmount);
      //   } else {

      //     commissions[item?.user?.id] = commissionAmount;
      //   }
      // }
      // if (item.result == betResultStatus.LOSS) {
      //   bulkCommission[item?.user?.id] = [...(bulkCommission[item?.user?.id] || []),
      //   {
      //     matchId: matchId,
      //     betId: matchDetails?.find((items) => items.type == matchBettingType.quickbookmaker1)?.id,
      //     betPlaceId: item?.id,
      //     amount: item?.amount,
      //     sessionName: item?.eventName,
      //     betPlaceDate: item?.createdAt,
      //     odds: item?.odds,
      //     betType: item?.betType,
      //     stake: item?.amount,
      //     lossAmount: item?.lossAmount,
      //     superParent: item?.user?.superParentId, userName: item.user?.userName
      //   }
      //   ];
      // }

      if (item.result == betResultStatus.WIN && item.marketType == racingBettingType.matchOdd) {
        matchOddWinBets.push(item)
      }

      updateRecords.push(item);
      userData.add(item?.user?.id);
    }

    await addNewBet(updateRecords);


    let users = await getUserDataWithUserBalanceDeclare({ id: In([...userData]) });

    let upperUserObj = {};
    let bulkWalletRecord = [];
    // let commissionReport = [];
    const profitLossData = await calculateProfitLossRaceMatchForUserDeclare(
     users,
      betIds,
      matchId,
      0,
      socketData.matchResult,
      userId,
      bulkWalletRecord,
      upperUserObj,
      result,
      match,
      // commissions,
      // bulkCommission,
      // commissionReport,
      betId,
      matchOddWinBets,
      matchDetails
    );

    insertBulkTransactions(bulkWalletRecord);
    logger.info({
      message: "Upper user for this bet.",
      data: { upperUserObj, betIds },
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
      // parentUser.totalCommission = parentUser.totalCommission + value["totalCommission"]
      if (parentUser.exposure < 0) {
        logger.info({
          message: "Exposure in negative for user: ",
          data: {
            betIds,
            matchId,
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
        // totalCommission: value["totalCommission"]
      });

      logger.info({
        message: "Declare result db update for parent ",
        data: {
          betIds,
          parentUser,
        },
      });
      if (parentUserRedisData?.exposure) {
        await incrementValuesRedis(key, {
          profitLoss: value?.["profitLoss"],
          myProfitLoss: -value["myProfitLoss"],
          exposure: -value["exposure"],
        });
        await deleteKeyFromUserRedis(key, `${matchId}${redisKeys.profitLoss}`);
      }

      sendMessageToUser(key, socketData.matchResult, {
        ...parentUser,
        betId: betId,
        matchId,
        betType: matchBetType
      });
    }
    // insertBulkCommissions(commissionReport);
    broadcastEvent(socketData.declaredMatchResultAllUser, { matchId, gameType: match?.matchType, betId: betId, betType: matchBetType });
    await updateRaceMatchData({ id: matchId }, { stopAt: new Date() });
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
      error: `Error at declare other match result for the user.`,
      stack: error.stack,
      message: error.message,
    });
    // Handle any errors and return an error response
    return ErrorResponse(error, req, res);
  }
};

const calculateProfitLossRaceMatchForUserDeclare = async (users, betId, matchId, fwProfitLoss, redisEventName, userId, bulkWalletRecord, upperUserObj, result, matchData,
  //  commission, bulkCommission, commissionReport,
  currBetId, matchOddWinBets, matchDetails) => {

  let faAdminCal = {
    // commission: [],
    userData: {}
  };
  let superAdminData = {};

  for (let user of users) {
    user = { user: user };
    let getWinAmount = 0;
    let getLossAmount = 0;
    let profitLoss = 0;
    let userRedisData = await getUserRedisData(user.user.id);
    let getMultipleAmount = await getMultipleAccountOtherMatchProfitLoss(betId, user.user.id);

    Object.keys(getMultipleAmount)?.forEach((item) => {
      getMultipleAmount[item] = parseRedisData(item,getMultipleAmount);
    });

    let maxLoss = 0;
    logger.info({ message: "Updated users", data: user.user });
   
    // check if data is already present in the redis or not
    if (userRedisData?.[`${matchId}${redisKeys.profitLoss}`]) {
      maxLoss = (Math.abs(Math.min(...Object.values(JSON.parse(userRedisData?.[`${matchId}${redisKeys.profitLoss}`]) || {}), 0))) || 0;
    }
    else {
      // if data is not available in the redis then get data from redis and find max loss amount for all placed bet by user
      let redisData = await calculateProfitLossForRacingMatchToResult(betId, user.user?.id, matchDetails?.[0]);
      Object.keys(redisData)?.forEach((key) => {
        maxLoss += Math.abs(Math.min(...Object.values(redisData[key] || {}), 0));
      });
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

    let userCurrentBalance = parseFloat(user.user.userBalance.currentBalance);
    matchOddWinBets?.filter((item) => item.user.id == user.user.id)?.forEach((matchOddData, uniqueId) => {
      userCurrentBalance -= parseFloat(parseFloat((matchOddData?.winAmount) / 100).toFixed(2))
      bulkWalletRecord.push({
        matchId: matchId,
        actionBy: userId,
        searchId: user.user.id,
        userId: user.user.id,
        amount: -parseFloat(parseFloat((matchOddData?.winAmount) / 100).toFixed(2)),
        transType: transType.loss,
        closingBalance: userCurrentBalance,
        description: `Deduct 1% for bet on match odds ${matchOddData?.eventType}/${matchOddData.eventName}-${matchOddData.teamName} on odds ${matchOddData.odds}/${matchOddData.betType} of stake ${matchOddData.amount} `,
        createdAt: new Date(),
        uniqueId: uniqueId,
        betId: betId
      });
    });

    let userOriginalProfitLoss = profitLoss;

    // deducting 1% from match odd win amount 
    if (parseFloat(getMultipleAmount?.winAmountMatchOdd) > 0) {
      profitLoss -= parseFloat(((parseFloat(getMultipleAmount?.winAmountMatchOdd) / 100)).toFixed(2));
    }

    const userCurrBalance = Number(user.user.userBalance.currentBalance + profitLoss).toFixed(2);
    let userBalanceData = {
      currentBalance: userCurrBalance,
      profitLoss: user.user.userBalance.profitLoss + profitLoss,
      myProfitLoss: user.user.userBalance.myProfitLoss + profitLoss,
      exposure: user.user.userBalance.exposure
    }

    // let totalCommissionData = 0;

    // if (user.user.matchCommission) {
    //   if (user.user.matchComissionType == matchComissionTypeConstant.entryWise) {
    //     userBalanceData.totalCommission = parseFloat((parseFloat(user.user.userBalance.totalCommission) + parseFloat(getLossAmount) * parseFloat(user.user.matchCommission) / 100).toFixed(2));
    //     totalCommissionData += parseFloat((parseFloat(getLossAmount) * parseFloat(user.user.matchCommission) / 100).toFixed(2))
    //   }
    //   else if (userOriginalProfitLoss < 0) {
    //     userBalanceData.totalCommission = parseFloat((parseFloat(user.user.userBalance.totalCommission) + Math.abs(parseFloat(userOriginalProfitLoss)) * parseFloat(user.user.matchCommission) / 100).toFixed(2));
    //     totalCommissionData += parseFloat((Math.abs(parseFloat(userOriginalProfitLoss)) * parseFloat(user.user.matchCommission) / 100).toFixed(2))
    //   }
    // }

    await updateUserBalanceData(user.user.id, {
      profitLoss: profitLoss,
      myProfitLoss: profitLoss,
      exposure: -maxLoss,
      // totalCommission: totalCommissionData
    });

    if (userRedisData?.exposure) {

      await incrementValuesRedis(user.user.id, {
        profitLoss: profitLoss,
        myProfitLoss: profitLoss,
        exposure: -maxLoss,
        currentBalance: profitLoss
      });
    }

    // if (user?.user?.matchCommission) {

    //   if (user.user.matchComissionType == matchComissionTypeConstant.entryWise) {
    //     bulkCommission[user?.user?.id]?.forEach((item) => {
    //       commissionReport.push({
    //         createBy: user.user.id,
    //         matchId: item.matchId,
    //         betId: item?.betId,
    //         betPlaceId: item?.betPlaceId,
    //         commissionAmount: parseFloat((parseFloat(item?.lossAmount) * parseFloat(user?.user?.matchCommission) / 100).toFixed(2)),
    //         parentId: user.user.id,
    //       });
    //     });
    //   }
    //   else if (userOriginalProfitLoss < 0) {
    //     commissionReport.push({
    //       createBy: user.user.id,
    //       matchId: matchId,
    //       betId: currBetId,
    //       commissionAmount: parseFloat((parseFloat(Math.abs(userOriginalProfitLoss)) * parseFloat(user?.user?.matchCommission) / 100).toFixed(2)),
    //       parentId: user.user.id,
    //       stake: userOriginalProfitLoss
    //     });
    //   }
    //   if (user?.user?.id == user?.user?.createBy) {
    //     if (user.user.matchComissionType == matchComissionTypeConstant.entryWise) {
    //       bulkCommission[user?.user?.id]?.forEach((item) => {
    //         faAdminCal.commission.push({
    //           createBy: user.user.id,
    //           matchId: item.matchId,
    //           betId: item?.betId,
    //           betPlaceId: item?.betPlaceId,
    //           parentId: user.user.id,
    //           teamName: item?.sessionName,
    //           betPlaceDate: new Date(item?.betPlaceDate),
    //           odds: item?.odds,
    //           betType: item?.betType,
    //           stake: item?.stake,
    //           commissionAmount: parseFloat((parseFloat(item?.lossAmount) * parseFloat(user?.user?.matchCommission) / 100).toFixed(2)),
    //           partnerShip: 100,
    //           matchName: matchData?.title,
    //           matchStartDate: new Date(matchData?.startAt),
    //           userName: user.user.userName

    //         });
    //       });
    //     }
    //     else if (userOriginalProfitLoss < 0) {
    //       faAdminCal.commission.push({
    //         createBy: user.user.id,
    //         matchId: matchId,
    //         betId: currBetId,
    //         parentId: user.user.id,
    //         commissionAmount: parseFloat((parseFloat(Math.abs(userOriginalProfitLoss)) * parseFloat(user?.user?.matchCommission) / 100).toFixed(2)),
    //         partnerShip: 100,
    //         matchName: matchData?.title,
    //         matchStartDate: new Date(matchData?.startAt),
    //         userName: user.user.userName,
    //         stake: userOriginalProfitLoss
    //       });
    //     }
    //   }
    // }

    sendMessageToUser(user.user.id, redisEventName, { ...user.user, betId: currBetId, matchId, userBalanceData });

    // deducting 1% from match odd win amount 
    if (parseFloat(getMultipleAmount?.winAmountMatchOdd) > 0) {
      user.user.userBalance.currentBalance = parseFloat(parseFloat(user.user.userBalance.currentBalance - (parseFloat(getMultipleAmount?.winAmountMatchOdd) / 100)).toFixed(2));
    }

    let currBal = user.user.userBalance.currentBalance;

    const transactions = [
      ...(result != resultType.noResult ? [{
        winAmount: parseFloat(getMultipleAmount.winAmount),
        lossAmount: parseFloat(getMultipleAmount.lossAmount),
        type: "MATCH ODDS",
        result: result,
        betId: betId
      }] : [])
    ];

    transactions.forEach((item, uniqueId) => {
      currBal = currBal + item.winAmount - item.lossAmount;

      bulkWalletRecord.push({
        matchId: matchId,
        actionBy: userId,
        searchId: user.user.id,
        userId: user.user.id,
        amount: item.winAmount - item.lossAmount,
        transType: item.winAmount - item.lossAmount > 0 ? transType.win : transType.loss,
        closingBalance: currBal,
        description: `${matchData?.matchType}/${matchData?.title}/${item.type} - ${matchDetails?.[0]?.runners?.find((runnerData) => runnerData?.id == item.result)?.runnerName} `,
        createdAt: new Date(),
        uniqueId: uniqueId,
        betId: item?.betId
      });
    });

    await deleteKeyFromUserRedis(user.user.id, redisKeys.userMatchExposure + matchId, `${matchId}${redisKeys.profitLoss}`);

    if (user.user.createBy === user.user.id) {
      superAdminData[user.user.id] = {
        role: user.user.roleName,
        profitLoss: profitLoss,
        myProfitLoss: profitLoss,
        exposure: maxLoss,
        // totalCommission: (user.user.matchComissionType == matchComissionTypeConstant.entryWise ? (commission[user.user.id] || 0) : userOriginalProfitLoss < 0 ? parseFloat((parseFloat(Math.abs(userOriginalProfitLoss)) * parseFloat(user?.user?.matchCommission) / 100).toFixed(2)) : 0)
      };
    }

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
      // let parentCommission = parseFloat((((parseFloat(patentUser?.matchCommission) * ((patentUser.matchComissionType == matchComissionTypeConstant.entryWise ? getLossAmount : userOriginalProfitLoss < 0 ? Math.abs(userOriginalProfitLoss) : 0))) / 10000) * parseFloat(upLinePartnership)).toFixed(2));

      if (upperUserObj[patentUser.id]) {
        upperUserObj[patentUser.id].profitLoss = upperUserObj[patentUser.id].profitLoss + profitLoss;
        upperUserObj[patentUser.id].myProfitLoss = upperUserObj[patentUser.id].myProfitLoss + myProfitLoss;
        upperUserObj[patentUser.id].exposure = upperUserObj[patentUser.id].exposure + maxLoss;

        // if (patentUser?.matchCommission && parseFloat(patentUser?.matchCommission) != 0) {
        //   upperUserObj[patentUser.id].totalCommission += parentCommission;
        // }
      } else {
        upperUserObj[patentUser.id] = { profitLoss: profitLoss, myProfitLoss: myProfitLoss, exposure: maxLoss,
          //  ...(patentUser?.matchCommission && parseFloat(patentUser?.matchCommission) != 0 ? { totalCommission: parentCommission } : {}) 
          };
      }

      if (patentUser.createBy === patentUser.id) {
        superAdminData[patentUser.id] = {
          ...upperUserObj[patentUser.id],
          role: patentUser.roleName,
        };
      }

      // if (patentUser?.matchCommission) {
      //   if (patentUser.matchComissionType == matchComissionTypeConstant.entryWise) {
      //     bulkCommission[user?.user?.id]?.forEach((item) => {
      //       commissionReport.push({
      //         createBy: user.user.id,
      //         matchId: item.matchId,
      //         betId: item?.betId,
      //         betPlaceId: item?.betPlaceId,
      //         commissionAmount: parseFloat((parseFloat(item?.lossAmount) * parseFloat(patentUser?.matchCommission) / 100).toFixed(2)),
      //         parentId: patentUser.id,
      //       });
      //     });
      //   }
      //   else if (userOriginalProfitLoss < 0) {
      //     commissionReport.push({
      //       createBy: user.user.id,
      //       matchId: matchId,
      //       betId: currBetId,
      //       commissionAmount: parseFloat((parseFloat(Math.abs(userOriginalProfitLoss)) * parseFloat(patentUser?.matchCommission) / 100).toFixed(2)),
      //       parentId: patentUser.id,
      //       stake: userOriginalProfitLoss

      //     });
      //   }
      //   if (patentUser?.id == patentUser?.createBy) {
      //     if (patentUser.matchComissionType == matchComissionTypeConstant.entryWise) {
      //       bulkCommission[user?.user?.id]?.forEach((item) => {
      //         faAdminCal.commission.push({
      //           createBy: user.user.id,
      //           matchId: item.matchId,
      //           betId: item?.betId,
      //           betPlaceId: item?.betPlaceId,
      //           parentId: patentUser.id,
      //           teamName: item?.sessionName,
      //           betPlaceDate: item?.betPlaceDate,
      //           odds: item?.odds,
      //           betType: item?.betType,
      //           stake: item?.stake,
      //           commissionAmount: parseFloat((parseFloat(item?.lossAmount) * parseFloat(patentUser?.matchCommission) / 100).toFixed(2)),
      //           partnerShip: upLinePartnership,
      //           matchName: matchData?.title,
      //           matchStartDate: matchData?.startAt,
      //           userName: user.user.userName

      //         });
      //       });
      //     }
      //     else if (userOriginalProfitLoss < 0) {
      //       faAdminCal.commission.push({
      //         createBy: user.user.id,
      //         matchId: matchId,
      //         betId: currBetId,
      //         parentId: patentUser.id,
      //         commissionAmount: parseFloat((parseFloat(Math.abs(userOriginalProfitLoss)) * parseFloat(patentUser?.matchCommission) / 100).toFixed(2)),
      //         partnerShip: upLinePartnership,
      //         matchName: matchData?.title,
      //         matchStartDate: matchData?.startAt,
      //         userName: user.user.userName,
      //         stake: userOriginalProfitLoss

      //       });
      //     }
      //   }
      // }
    }

    faAdminCal.userData[user.user.superParentId] = {
      profitLoss: profitLoss + (faAdminCal.userData?.[user.user.superParentId]?.profitLoss || 0),
      exposure: maxLoss + (faAdminCal.userData?.[user.user.superParentId]?.exposure || 0),
      myProfitLoss: parseFloat((((faAdminCal.userData?.[user.user.superParentId]?.profitLoss || 0)) + ((profitLoss) * (user.user.superParentType == userRoleConstant.fairGameAdmin ? parseFloat(user.user.fwPartnership) : 1) / 100)).toFixed(2)),
      userOriginalProfitLoss: userOriginalProfitLoss + (faAdminCal.userData?.[user.user.superParentId]?.userOriginalProfitLoss || 0),
      role: user.user.superParentType
    }

    faAdminCal.fwWalletDeduction = 0;

  };
  return { fwProfitLoss, faAdminCal, superAdminData,
    //  bulkCommission
     };
}

exports.unDeclareRaceMatchResult = async (req, res) => {
  try {

    const { matchId, match, matchBetting, userId, matchOddId, betType: matchBetType } = req.body;

    const betIds = [matchOddId];
    let users = await getDistinctUserBetPlaced(In(betIds));

    logger.info({
      message: "Race match result un declared.",
      data: {
        betIds
      }
    });

    let upperUserObj = {};
    let bulkWalletRecord = [];
    let matchOddsWinBets=[];
      matchOddsWinBets = await findAllPlacedBet({
        marketType: matchBettingType.matchOdd,
        result: betResultStatus.WIN,
        matchId: matchId,
      });
    // const commissionData = await getCombinedCommission(matchOddId);
    const profitLossData = await calculateProfitLossRaceMatchForUserUnDeclare(
      users,
      betIds,
      matchId,
      0,
      socketData.matchResultUnDeclare,
      userId,
      bulkWalletRecord,
      upperUserObj,
      // commissionData, 
      matchOddsWinBets,
      matchBetting,
      matchBetType,
      matchOddId
    );
    // deleteCommission(matchOddId);

    insertBulkTransactions(bulkWalletRecord);
    logger.info({
      message: "Upper user for this bet.",
      data: { upperUserObj, betIds }
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


      parentUser.profitLoss = parentProfitLoss - value?.["profitLoss"];
      parentUser.myProfitLoss = parentMyProfitLoss + value["myProfitLoss"];
      parentUser.exposure = parentExposure + value["exposure"];
      // parentUser.totalCommission = parseFloat(parentUser.totalCommission || 0) - parseFloat(value["totalCommission"] || 0);
      if (parentUser.exposure < 0) {
        logger.info({
          message: "Exposure in negative for user: ",
          data: {
            matchId,
            parentUser,
          },
        });
        value["exposure"] += parentUser.exposure;
        parentUser.exposure = 0;
      }

      await updateUserBalanceData(parentUser.userId, {
        balance: 0,
        profitLoss: -value?.["profitLoss"],
        myProfitLoss: value["myProfitLoss"],
        exposure: value["exposure"],
        // totalCommission: -parseFloat(value["totalCommission"] || 0)
      });

      logger.info({
        message: "Declare result db update for parent ",
        data: {
          parentUser,
          betIds
        },
      });

      if (parentUserRedisData?.exposure) {
        let { exposure, profitLoss, myProfitLoss, ...parentRedisUpdateObj } = value;
        Object.keys(parentRedisUpdateObj)?.forEach((plKey) => {
          parentRedisUpdateObj[plKey] = JSON.stringify(parentRedisUpdateObj[plKey]);
        });
        await incrementValuesRedis(parentUser.userId, {
          profitLoss: -value?.["profitLoss"],
          myProfitLoss: value["myProfitLoss"],
          exposure: value["exposure"],
          [redisKeys.userMatchExposure + matchId]: value["exposure"]
        }, parentRedisUpdateObj);
      }

      sendMessageToUser(key, socketData.matchResultUnDeclare, {
        ...parentUser,
        matchId,
        betId: betIds,
        profitLossData: value,
        betType: matchBetType,
      });
    }

    await updatePlaceBet(
      {
        betId: In(betIds),
        deleteReason: IsNull(),
      },
      {
        result: betResultStatus.PENDING,
      }
    );

    broadcastEvent(socketData.unDeclaredMatchResultAllUser, { matchId, gameType: match?.matchType, betId: betIds });
    await updateRaceMatchData({ id: matchId }, { stopAt: null });

    return SuccessResponse(
      {
        statusCode: 200,
        message: { msg: "bet.resultUnDeclared" },
        data: profitLossData
      },
      req,
      res
    );

  } catch (error) {
    logger.error({
      error: `Error at un declare match result for the user.`,
      stack: error.stack,
      message: error.message,
    });
    // Handle any errors and return an error response
    return ErrorResponse(error, req, res);
  }
}

const calculateProfitLossRaceMatchForUserUnDeclare = async (users, betId, matchId, fwProfitLoss, redisEventName, userId, bulkWalletRecord, upperUserObj,
  //  commissionData, 
  matchOddsWinBets, matchDetails, merketBetType, currBetId) => {

  let faAdminCal = {
    admin: {},
    wallet: {}
  };
  let superAdminData = {};

  // let parentCommissionIds = new Set();

  for (const user of users) {
    let getWinAmount = 0;
    let getLossAmount = 0;
    let profitLoss = 0;
    let userRedisData = await getUserRedisData(user.user.id);
    let getMultipleAmount = await getMultipleAccountOtherMatchProfitLoss(betId, user.user.id);

    Object.keys(getMultipleAmount)?.forEach((item) => {
      getMultipleAmount[item] = parseFloat(parseFloat(getMultipleAmount[item]).toFixed(2));
    });
    let maxLoss = 0;

    logger.info({ message: "Updated users", data: user.user });

    // if data is not available in the redis then get data from redis and find max loss amount for all placed bet by user
    let redisData = await calculateProfitLossForRacingMatchToResult(betId, user.user?.id, matchDetails?.[0]);
    Object.keys(redisData)?.forEach((key) => {
      maxLoss += Math.abs(Math.min(...Object.values(redisData[key] || {}), 0));
    });

    logger.info({
      maxLoss: maxLoss
    });

    user.user.userBalance.exposure = user.user.userBalance.exposure + maxLoss;

    logger.info({
      message: "Update user exposure.",
      data: user.user.exposure
    });

    let result = matchDetails?.[0]?.result;

    getWinAmount = getMultipleAmount.winAmount;
    getLossAmount = getMultipleAmount.lossAmount;

    profitLoss = parseFloat(getWinAmount.toString()) - parseFloat(getLossAmount.toString());
    fwProfitLoss = parseFloat((parseFloat(fwProfitLoss.toString()) - parseFloat(((-profitLoss * user.user.fwPartnership) / 100).toString())).toFixed(2));

    let userCurrentBalance = parseFloat(user.user.userBalance.currentBalance);

    matchOddsWinBets?.filter((item) => item.createBy == user.user.id)?.forEach((matchOddData, uniqueId) => {
      userCurrentBalance += parseFloat(parseFloat((matchOddData?.winAmount) / 100).toFixed(2))
      bulkWalletRecord.push({
        matchId: matchId,
        actionBy: userId,
        searchId: user.user.id,
        userId: user.user.id,
        amount: parseFloat(parseFloat((matchOddData?.winAmount) / 100).toFixed(2)),
        transType: transType.win,
        closingBalance: userCurrentBalance,
        createdAt: new Date(),
        description: `Revert deducted 1% for bet on match odds ${matchOddData?.eventType}/${matchOddData.eventName}-${matchOddData.teamName} on odds ${matchOddData.odds}/${matchOddData.betType} of stake ${matchOddData.amount} `,
        uniqueId: uniqueId,
        betId: [matchDetails?.find((item) => item?.type == racingBettingType.matchOdd)?.id]
      });
    });

    // deducting 1% from match odd win amount
    if (parseFloat(getMultipleAmount?.winAmountMatchOdd) > 0) {
      profitLoss -= parseFloat(((parseFloat(getMultipleAmount?.winAmountMatchOdd) / 100)).toFixed(2));
    }

    const userCurrBalance = Number(
      (user.user.userBalance.currentBalance - profitLoss).toFixed(2)
    );

    let userBalanceData = {
      currentBalance: userCurrBalance,
      profitLoss: user.user.userBalance.profitLoss - profitLoss,
      myProfitLoss: user.user.userBalance.myProfitLoss - profitLoss,
      exposure: user.user.userBalance.exposure,
    }

    // let totalCommissionData = 0;
    // let userCommission = commissionData?.find((item) => item?.userId == user.user.id);
    // if (userCommission) {
    //   userBalanceData.totalCommission = parseFloat(user.user.userBalance.totalCommission) - parseFloat(userCommission?.amount || 0);
    //   totalCommissionData += parseFloat(userCommission?.amount || 0);
    // }

    if (user.user.createBy === user.user.id) {
      superAdminData[user.user.id] = {
        role: user.user.roleName,
        profitLoss: profitLoss,
        myProfitLoss: profitLoss,
        exposure: maxLoss,
        // totalCommission: parseFloat(commissionData?.find((item) => item?.userId == user.user.id)?.amount || 0)
      };
    }

    let matchTeamRates = {}
    Object.keys(redisData)?.forEach((plData) => {
      matchTeamRates[plData] = JSON.stringify(redisData[plData]);
    });

    await updateUserBalanceData(user.user.id, {
      profitLoss: -profitLoss,
      myProfitLoss: -profitLoss,
      exposure: maxLoss,
      // totalCommission: -totalCommissionData
    });

    if (userRedisData?.exposure) {

      await incrementValuesRedis(user.user.id, {
        currentBalance: -profitLoss,
        profitLoss: -profitLoss,
        myProfitLoss: -profitLoss,
        exposure: maxLoss,
        [redisKeys.userMatchExposure + matchId]: maxLoss
      }, matchTeamRates);
    }

    logger.info({
      message: "user save at un declare result",
      data: user
    });

    sendMessageToUser(user.user.id, redisEventName, {
      ...user.user, betId, matchId, matchExposure: maxLoss, userBalanceData, profitLoss: redisData[`${matchId}${redisKeys.profitLoss}`],
      betType: merketBetType,
    });

    // deducting 1% from match odd win amount 
    if (parseFloat(getMultipleAmount?.winAmountMatchOdd) > 0) {
      user.user.userBalance.currentBalance = parseFloat(parseFloat(user.user.userBalance.currentBalance + (parseFloat(getMultipleAmount?.winAmountMatchOdd) / 100)).toFixed(2));
    }

    let currBal = user.user.userBalance.currentBalance;

    const transactions = [
      ...(result != resultType.noResult ? [{
        winAmount: parseFloat(parseFloat(getMultipleAmount.winAmount).toFixed(2)),
        lossAmount: parseFloat(parseFloat(getMultipleAmount.lossAmount).toFixed(2)),
        type:"MATCH ODDS",
        result: result,
        betId: betId
      }] : [])
    ];


    transactions?.forEach((item, uniqueId) => {
      currBal = currBal - item.winAmount + item.lossAmount;
      bulkWalletRecord.push({
        matchId: matchId,
        actionBy: userId,
        searchId: user.user.id,
        userId: user.user.id,
        amount: -(item.winAmount - item.lossAmount),
        transType: -(item.winAmount - item.lossAmount) < 0 ? transType.loss : transType.win,
        closingBalance: currBal,
        description: `Revert ${user?.eventType}/${user?.eventName}/${item.type} - ${matchDetails?.[0]?.runners?.find((runnerData) => runnerData?.id == item.result)?.runnerName}`,
        createdAt: new Date(),
        uniqueId: uniqueId,
        betId: item?.betId
      });
    });

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

        Object.keys(redisData)?.forEach((item) => {
          if (upperUserObj[patentUser.id][item]) {
            Object.keys(redisData[item])?.forEach((plKeys) => {
              if (upperUserObj[patentUser.id]?.[item]?.[plKeys]) {
                upperUserObj[patentUser.id][item][plKeys] += -parseFloat((parseFloat(redisData[item][plKeys]) * parseFloat(user?.user[`${partnershipPrefixByRole[patentUser?.roleName]}Partnership`]) / 100).toFixed(2));
              }
              else {
                upperUserObj[patentUser.id][item][plKeys] = -parseFloat((parseFloat(redisData[item][plKeys]) * parseFloat(user?.user[`${partnershipPrefixByRole[patentUser?.roleName]}Partnership`]) / 100).toFixed(2));
              }
            });
          }
          else {
            upperUserObj[patentUser.id][item] ={};
            Object.keys(redisData[item])?.forEach((plKeys) => {
              if (upperUserObj[patentUser.id]?.[item]?.[plKeys]) {
                upperUserObj[patentUser.id][item][plKeys] += -parseFloat((parseFloat(redisData[item][plKeys]) * parseFloat(user?.user[`${partnershipPrefixByRole[patentUser?.roleName]}Partnership`]) / 100).toFixed(2));
              }
              else {
                upperUserObj[patentUser.id][item][plKeys] = -parseFloat((parseFloat(redisData[item][plKeys]) * parseFloat(user?.user[`${partnershipPrefixByRole[patentUser?.roleName]}Partnership`]) / 100).toFixed(2));
              }
            });
          }
        });

      } else {
        upperUserObj[patentUser.id] = { profitLoss: profitLoss, myProfitLoss: myProfitLoss, exposure: maxLoss };

        // if (!parentCommissionIds.has(patentUser.id)) {
        //   parentCommissionIds.add(patentUser.id);

        //   let userCommission = commissionData?.find((item) => item?.userId == patentUser.id);
        //   if (userCommission) {
        //     upperUserObj[patentUser.id].totalCommission = parseFloat((parseFloat(userCommission?.amount || 0) * parseFloat(upLinePartnership) / 100).toFixed(2));
        //   }
        // }

        Object.keys(redisData)?.forEach((item) => {
          upperUserObj[patentUser.id][item] = {};
          Object.keys(redisData[item])?.forEach((plKeys) => {
            if (upperUserObj[patentUser.id]?.[item]?.[plKeys]) {
              upperUserObj[patentUser.id][item][plKeys] += -parseFloat((parseFloat(redisData[item][plKeys]) * parseFloat(user?.user[`${partnershipPrefixByRole[patentUser?.roleName]}Partnership`]) / 100).toFixed(2));
            }
            else {
              upperUserObj[patentUser.id][item][plKeys] = -parseFloat((parseFloat(redisData[item][plKeys]) * parseFloat(user?.user[`${partnershipPrefixByRole[patentUser?.roleName]}Partnership`]) / 100).toFixed(2));
            }
          });
        });
      }

      if (patentUser.createBy === patentUser.id) {
        superAdminData[patentUser.id] = {
          ...upperUserObj[patentUser.id],
          role: patentUser.roleName,
        };
      }
    }


    Object.keys(redisData)?.forEach((item) => {
      if (user.user.superParentType == userRoleConstant.fairGameAdmin) {
        if (faAdminCal.admin?.[user.user.superParentId]?.[item]) {
          Object.keys(redisData[item])?.forEach((plKeys) => {
            if (faAdminCal.admin[user.user.superParentId]?.[item]?.[plKeys]) {
              faAdminCal.admin[user.user.superParentId][item][plKeys] += -parseFloat((parseFloat(redisData[item][plKeys]) * parseFloat(user?.user[`faPartnership`]) / 100).toFixed(2));
            }
            else {
              faAdminCal.admin[user.user.superParentId][item][plKeys] = -parseFloat((parseFloat(redisData[item][plKeys]) * parseFloat(user?.user[`faPartnership`]) / 100).toFixed(2));
            }
          });
        }
        else {
          if (!faAdminCal.admin[user.user.superParentId]) {
            faAdminCal.admin[user.user.superParentId] = {};
          }
          faAdminCal.admin[user.user.superParentId][item] ={};
          Object.keys(redisData[item])?.forEach((plKeys) => {
            if (faAdminCal.admin[user.user.superParentId][item]?.[plKeys]) {
              faAdminCal.admin[user.user.superParentId][item][plKeys] += -parseFloat((parseFloat(redisData[item][plKeys]) * parseFloat(user?.user[`faPartnership`]) / 100).toFixed(2));
            }
            else {
              faAdminCal.admin[user.user.superParentId][item][plKeys] = -parseFloat((parseFloat(redisData[item][plKeys]) * parseFloat(user?.user[`faPartnership`]) / 100).toFixed(2));
            }
          });
        }
      }
      if (faAdminCal.wallet?.[item]) {
        Object.keys(redisData[item])?.forEach((plKeys) => {
          if (faAdminCal.wallet?.[item]?.[plKeys]) {
            faAdminCal.wallet[item][plKeys] += -parseFloat((parseFloat(redisData[item][plKeys]) * parseFloat(user?.user[`fwPartnership`]) / 100).toFixed(2));
          }
          else {
            faAdminCal.wallet[item][plKeys] = -parseFloat((parseFloat(redisData[item][plKeys]) * parseFloat(user?.user[`fwPartnership`]) / 100).toFixed(2));
          }
        });
      }
      else {
        faAdminCal.wallet[item] ={};
        Object.keys(redisData[item])?.forEach((plKeys) => {
          if (faAdminCal.wallet[item]?.[plKeys]) {
            faAdminCal.wallet[item][plKeys] += -parseFloat((parseFloat(redisData[item][plKeys]) * parseFloat(user?.user[`fwPartnership`]) / 100).toFixed(2));
          }
          else {
            faAdminCal.wallet[item][plKeys] = -parseFloat((parseFloat(redisData[item][plKeys]) * parseFloat(user?.user[`fwPartnership`]) / 100).toFixed(2));
          }
        });
      }
    });

    faAdminCal.admin[user.user.superParentId] = {
      ...faAdminCal.admin[user.user.superParentId],
      profitLoss: profitLoss + (faAdminCal.admin[user.user.superParentId]?.profitLoss || 0),
      exposure: maxLoss + (faAdminCal.admin[user.user.superParentId]?.exposure || 0),
      myProfitLoss: parseFloat((parseFloat(faAdminCal.admin[user.user.superParentId]?.myProfitLoss || 0) + (parseFloat(profitLoss) * parseFloat(user.user.fwPartnership) / 100)).toFixed(2)),
      role: user.user.superParentType
    }

    faAdminCal.fwWalletDeduction = (faAdminCal.fwWalletDeduction || 0);
  };
  return { fwProfitLoss, faAdminCal, superAdminData };
}