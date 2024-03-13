const { IsNull, In } = require("typeorm");
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
} = require("../config/contants");
const { logger } = require("../config/logger");
const { getMatchBetPlaceWithUser, addNewBet, getMultipleAccountProfitLoss, getDistinctUserBetPlaced, findAllPlacedBetWithUserIdAndBetId, updatePlaceBet, getBet, getMultipleAccountMatchProfitLoss, getTotalProfitLoss, getAllMatchTotalProfitLoss, getBetsProfitLoss, getSessionsProfitLoss, getBetsWithMatchId, findAllPlacedBet } = require("../services/betPlacedService");
const {
  forceLogoutUser,
  calculateProfitLossForSessionToResult,
  calculatePLAllBet,
  calculateProfitLossSession,
  calculateProfitLossForMatchToResult,
  profitLossPercentCol,
  settingBetsDataAtLogin,
} = require("../services/commonService");
const {
  updateDomainData,
  addDomainData,
  getDomainDataByDomain,
  getDomainDataByUserId,
} = require("../services/domainDataService");
const { updateUserDataRedis, hasUserInCache, getUserRedisData, deleteKeyFromUserRedis, getUserRedisKey, getUserRedisKeys } = require("../services/redis/commonfunction");
const { insertTransactions } = require("../services/transactionService");
const {
  addInitialUserBalance,
  getUserBalanceDataByUserId,
  updateUserBalanceByUserId,
  getAllUsersBalanceSum,
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
  getSuperAdminDataBalance,
  getChildsWithOnlyUserRole,
  getUsers,
  getChildUserBalanceSum,
  getAllUsersBalanceSumByFgId,
} = require("../services/userService");
const { sendMessageToUser } = require("../sockets/socketManager");
const { ErrorResponse, SuccessResponse } = require("../utils/response");
const { insertCommissions, getCombinedCommission, deleteCommission } = require("../services/commissionService");
const { insertButton } = require("../services/buttonService");

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
      profitLoss: 0,
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
        closingBalance: user.creditRefrence,
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

    insertTransactions(bulkWalletRecord);
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
      if (parentExposure < 0) {
        logger.info({
          message: "Exposure in negative for user: ",
          data: {
            betId,
            matchId,
            parentUser,
          },
        });
        parentUser.exposure = 0;
      }
      updateUserBalanceByUserId(key, {
        profitLoss: parentUser.profitLoss,
        myProfitLoss: parentUser.myProfitLoss,
        exposure: parentUser.exposure,
        totalCommission: parentUser.totalCommission
      });
      logger.info({
        message: "Declare result db update for parent ",
        data: {
          betId,
          parentUser,
        },
      });
      if (parentUserRedisData?.exposure) {
        updateUserDataRedis(key, {
          exposure: parentUser.exposure,
          profitLoss: parentUser.profitLoss,
          myProfitLoss: parentUser.myProfitLoss,
        });
      }
      const redisSessionExposureName =
        redisKeys.userSessionExposure + matchId;
      let parentRedisUpdateObj = {};
      let sessionExposure = 0;
      if (parentUserRedisData?.[redisSessionExposureName]) {
        sessionExposure =
          parseFloat(parentUserRedisData[redisSessionExposureName]) || 0;
      }
      if (parentUserRedisData?.[betId + "_profitLoss"]) {
        let redisData = JSON.parse(parentUserRedisData[betId + "_profitLoss"]);
        sessionExposure = sessionExposure - (redisData.maxLoss || 0);
        parentRedisUpdateObj[redisSessionExposureName] = sessionExposure;
      }
      await deleteKeyFromUserRedis(key, betId + "_profitLoss");

      sendMessageToUser(key, socketData.sessionResult, {
        ...parentUser,
        betId,
        matchId,
        sessionExposure: sessionExposure,
      });
    }
    insertCommissions(commissionReport);

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

    if (userRedisData?.exposure) {
      await updateUserDataRedis(user.user.id, { [redisSesionExposureName]: redisSesionExposureValue });
    }


    logger.info({
      maxLoss: maxLoss,
      userExposure: redisSesionExposureValue
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
      currentBalance: parseFloat(userCurrBalance),
      profitLoss: user.user.userBalance.profitLoss + profitLoss,
      myProfitLoss: user.user.userBalance.myProfitLoss + profitLoss,
      exposure: user.user.userBalance.exposure
    };

    if (commission[user.user.id]) {
      userBalanceData.totalCommission = Number(((parseFloat(user.user.userBalance.totalCommission) + parseFloat(commission[user.user.id]))).toFixed(2));
    }
    await updateUserBalanceByUserId(user.user.id, userBalanceData);

    if (userRedisData?.exposure) {
      let { totalCommission, ...userBalance } = userBalanceData;
      updateUserDataRedis(user.user.id, userBalance);
      await deleteKeyFromUserRedis(user.user.id, betId + "_profitLoss");

    }
    await addUser(user.user);

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

    sendMessageToUser(user.user.id, redisEventName, { ...user.user, betId, matchId, sessionExposure: redisSesionExposureValue, userBalanceData });

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

      let parentCommission = parseFloat( ( ((parseFloat(patentUser?.sessionCommission) * parseFloat(totalStack)) / 10000) * parseFloat(upLinePartnership) ).toFixed(2));

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
              matchStartDate:new Date( match?.startAt),
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
      if (parentExposure < 0) {
        logger.info({
          message: "Exposure in negative for user: ",
          data: {
            betId,
            matchId,
            parentUser,
          },
        });
        parentUser.exposure = 0;
      }
      addInitialUserBalance(parentUser);
      logger.info({
        message: "Declare result db update for parent ",
        data: {
          betId,
          parentUser,
        },
      });
      let parentRedisUpdateObj = {};
      if (parentUserRedisData?.exposure) {
        parentRedisUpdateObj = {
          exposure: parentUser.exposure
        };
      }
      const redisSessionExposureName =
        redisKeys.userSessionExposure + matchId;
      let sessionExposure = 0;
      if (parentUserRedisData?.[redisSessionExposureName]) {
        sessionExposure =
          parseFloat(parentUserRedisData[redisSessionExposureName]) || 0;
      }
      if (parentUserRedisData?.[betId + "_profitLoss"]) {
        let redisData = JSON.parse(
          parentUserRedisData[betId + "_profitLoss"]
        );
        sessionExposure = sessionExposure - (redisData.maxLoss || 0);
        parentRedisUpdateObj[redisSessionExposureName] = sessionExposure;
      }
      await deleteKeyFromUserRedis(key, betId + "_profitLoss");

      if (
        parentUserRedisData?.exposure &&
        Object.keys(parentRedisUpdateObj).length > 0
      ) {
        updateUserDataRedis(key, parentRedisUpdateObj);
      }
      sendMessageToUser(key, socketData.sessionResult, {
        ...parentUser,
        betId,
        matchId,
        sessionExposure: sessionExposure,
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
      updateUserDataRedis(user.user.id, {
        exposure: user.user.userBalance.exposure,
        [redisSesionExposureName]: redisSesionExposureValue,
      });
      await deleteKeyFromUserRedis(user.user.id, betId + "_profitLoss");
    }
    await updateUserBalanceByUserId(user.user.id, { exposure: user.user.userBalance.exposure });

    if (user.user.createBy === user.user.id) {
      superAdminData[user.user.id] = {
        exposure: maxLoss
      };
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
    insertTransactions(bulkWalletRecord);
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
      if (parentExposure < 0) {
        logger.info({
          message: "Exposure in negative for user: ",
          data: {
            betId,
            matchId,
            parentUser,
          },
        });
        parentUser.exposure = 0;
      }
      addInitialUserBalance(parentUser);
      logger.info({
        message: "Declare result db update for parent ",
        data: {
          betId,
          parentUser,
        },
      });
      let parentRedisUpdateObj = {};

      if (parentUserRedisData?.exposure) {
        parentRedisUpdateObj = {
          exposure: parentUser.exposure,
          profitLoss: parentUser.profitLoss,
          myProfitLoss: parentUser.myProfitLoss,
          [betId + redisKeys.profitLoss]: JSON.stringify(value?.profitLossObj)
        };
      }
      const redisSessionExposureName =
        redisKeys.userSessionExposure + matchId;
      let sessionExposure = 0;
      if (parentUserRedisData?.[redisSessionExposureName]) {
        sessionExposure =
          parseFloat(parentUserRedisData[redisSessionExposureName]) || 0;
      }

      sessionExposure = sessionExposure + (value?.profitLossObj?.maxLoss || 0);
      parentRedisUpdateObj[redisSessionExposureName] = sessionExposure;


      if (
        parentUserRedisData?.exposure &&
        Object.keys(parentRedisUpdateObj).length > 0
      ) {
        updateUserDataRedis(key, parentRedisUpdateObj);
      }
      sendMessageToUser(key, socketData.sessionResultUnDeclare, {
        ...parentUser,
        betId,
        matchId,
        sessionExposure: sessionExposure,
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
    if (userRedisData?.exposure) {
      await updateUserDataRedis(user.user.id, { [redisSesionExposureName]: redisSesionExposureValue });
    }
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
      currentBalance: userCurrBalance,
      profitLoss: user.user.userBalance.profitLoss - profitLoss,
      myProfitLoss: user.user.userBalance.myProfitLoss - profitLoss,
      exposure: user.user.userBalance.exposure,
    }

    let userCommission = commissionData?.find((item) => item?.userId == user.user.id);
    if (userCommission) {
      userBalanceData.totalCommission = parseFloat(user.user.userBalance.totalCommission) - parseFloat(commissionData?.find((item) => item?.userId == user.user.id)?.amount || 0);
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


    await updateUserBalanceByUserId(user.user.id, userBalanceData);

    if (userRedisData?.exposure) {
      updateUserDataRedis(user.user.id, {
        ...userBalanceData,
        [betId + redisKeys.profitLoss]: JSON.stringify({
          upperLimitOdds: redisData?.betData?.[redisData?.betData?.length - 1]?.odds,
          lowerLimitOdds: redisData?.betData?.[0]?.odds,
          betPlaced: redisData?.betData,
          maxLoss: redisData?.maxLoss,
          totalBet: redisData.total_bet

        }),
      });
    }
    await addUser(user.user);
    logger.info({
      message: "user save at un declare result",
      data: user
    })

    sendMessageToUser(user.user.id, redisEventName, {
      ...user.user, betId, matchId, sessionExposure: redisSesionExposureValue, userBalanceData, profitLossData: JSON.stringify({
        upperLimitOdds: redisData?.betData?.[redisData?.betData?.length - 1]?.odds,
        lowerLimitOdds: redisData?.betData?.[0]?.odds,
        betPlaced: redisData?.betData,
        maxLoss: redisData?.maxLoss,
        totalBet: redisData.total_bet
      }),
      sessionDetails:resultDeclare

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
        let userCommission = commissionData?.find((item) => item?.userId == patentUser.id);
        if (userCommission) {
          upperUserObj[patentUser.id].totalCommission += parseFloat((parseFloat(userCommission?.amount || 0) * parseFloat(upLinePartnership) / 100).toFixed(2));
        }

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
    let {roleName,userId,...queryData} = req.query;
    let result;
    let select = [
      "betPlaced.id", "betPlaced.eventName", "betPlaced.teamName", "betPlaced.betType", "betPlaced.amount", "betPlaced.rate", "betPlaced.winAmount", "betPlaced.lossAmount", "betPlaced.createdAt", "betPlaced.eventType", "betPlaced.marketType", "betPlaced.odds", "betPlaced.marketBetType", "betPlaced.result", "betPlaced.matchId", "betPlaced.betId", "betPlaced.deleteReason", "betPlaced.bettingName", "match.startAt"
    ];

    select.push("user.id", "user.userName", "user.fwPartnership", "user.faPartnership");
    result = await getBet("user.id is not null", queryData, roleName, select, userId);


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
        else{
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
          else{
            item.result = betResultStatus.TIE;
          }
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
          lossAmount:item?.lossAmount,
          superParent: item?.user?.superParentId, userName:item.user?.userName
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
      matchOddWinBets
    );

    insertTransactions(bulkWalletRecord);
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
      if (parentExposure < 0) {
        logger.info({
          message: "Exposure in negative for user: ",
          data: {
            betIds,
            matchId,
            parentUser,
          },
        });
        parentUser.exposure = 0;
      }
      addInitialUserBalance(parentUser);
      logger.info({
        message: "Declare result db update for parent ",
        data: {
          betIds,
          parentUser,
        },
      });
      if (parentUserRedisData?.exposure) {
        updateUserDataRedis(key, {
          exposure: parentUser.exposure,
          profitLoss: parentUser.profitLoss,
          myProfitLoss: parentUser.myProfitLoss,
        });
      }

      await deleteKeyFromUserRedis(key, redisKeys.userTeamARate + matchId, redisKeys.userTeamBRate + matchId, redisKeys.userTeamCRate + matchId, redisKeys.yesRateTie + matchId, redisKeys.noRateTie + matchId, redisKeys.yesRateComplete + matchId, redisKeys.noRateComplete + matchId);

      sendMessageToUser(key, socketData.matchResult, {
        ...parentUser,
        betIds,
        matchId
      });
    }
    insertCommissions(commissionReport);

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


const calculateProfitLossMatchForUserDeclare = async (users, betId, matchId, fwProfitLoss, redisEventName, userId, bulkWalletRecord, upperUserObj, result, matchData, commission, bulkCommission, commissionReport, currBetId, matchOddWinBets) => {

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
    matchOddWinBets?.filter((item) => item.user.id == user.user.id)?.forEach((matchOddData) => {
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

    if (user.user.matchCommission) {
      if (user.user.matchComissionType == matchComissionTypeConstant.entryWise) {
        userBalanceData.totalCommission = parseFloat((parseFloat(user.user.userBalance.totalCommission) + parseFloat(getLossAmount) * parseFloat(user.user.matchCommission) / 100).toFixed(2));
      }
      else if (userOriginalProfitLoss < 0) {
        userBalanceData.totalCommission = parseFloat((parseFloat(user.user.userBalance.totalCommission) + Math.abs(parseFloat(userOriginalProfitLoss)) * parseFloat(user.user.matchCommission) / 100).toFixed(2));
      }
    }

    await updateUserBalanceByUserId(user.user.id, userBalanceData);

    if (userRedisData?.exposure) {
      let { totalCommission, ...userBalance } = userBalanceData;
      updateUserDataRedis(user.user.id, userBalance);

    }
    await addUser(user.user);

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

    const transactions=[
      ...(result != resultType.tie && result != resultType.noResult && parseFloat(getMultipleAmount.matchOddBetsCount||0)>0 ? [{
        winAmount: parseFloat(getMultipleAmount.winAmount),
        lossAmount: parseFloat(getMultipleAmount.lossAmount),
        type: "MATCH ODDS",
        result: result
      }] : []),
      ...(result != resultType.noResult && parseFloat(getMultipleAmount.tiedBetsCount||0)>0 ? [{
        winAmount: parseFloat(getMultipleAmount.winAmountTied),
        lossAmount: parseFloat(getMultipleAmount.lossAmountTied),
        type: "Tied Match",
        result: result == resultType.tie ? "YES" : "NO"
      }] : []),
      ...(parseFloat(getMultipleAmount.completeBetsCount || 0) > 0 ? [{
        winAmount: parseFloat(getMultipleAmount.winAmountComplete),
        lossAmount: parseFloat(getMultipleAmount.lossAmountComplete),
        type: "Complete Match",
        result: "YES"
      }]:[])
    ];

    transactions.forEach((item)=>{
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
      let parentCommission = parseFloat(( ( (parseFloat(patentUser?.matchCommission) * ((patentUser.matchComissionType == matchComissionTypeConstant.entryWise ? getLossAmount : userOriginalProfitLoss < 0 ? Math.abs(userOriginalProfitLoss) : 0))) / 10000) * parseFloat(upLinePartnership)).toFixed(2));


      if (upperUserObj[patentUser.id]) {
        upperUserObj[patentUser.id].profitLoss = upperUserObj[patentUser.id].profitLoss + profitLoss;
        upperUserObj[patentUser.id].myProfitLoss = upperUserObj[patentUser.id].myProfitLoss + myProfitLoss;
        upperUserObj[patentUser.id].exposure = upperUserObj[patentUser.id].exposure + maxLoss;

        if (patentUser?.matchCommission && parseFloat(patentUser?.matchCommission) != 0) {
          upperUserObj[patentUser.id].totalCommission += parentCommission;
        }
      } else {
        upperUserObj[patentUser.id] = { profitLoss: profitLoss , myProfitLoss: myProfitLoss, exposure: maxLoss, ...(patentUser?.matchCommission && parseFloat(patentUser?.matchCommission) != 0 ? { totalCommission: parentCommission } : {}) };
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
      myProfitLoss: parseFloat((((faAdminCal.userData?.[user.user.superParentId]?.profitLoss || 0) ) + ((profitLoss) * (user.user.superParentType == userRoleConstant.fairGameAdmin ? parseFloat(user.user.fwPartnership) : 1) / 100)).toFixed(2)),
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
      commissionData,matchOddsWinBets
    );
    deleteCommission(matchOddId);

    insertTransactions(bulkWalletRecord);
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
      if (parentExposure < 0) {
        logger.info({
          message: "Exposure in negative for user: ",
          data: {
            matchId,
            parentUser,
          },
        });
        parentUser.exposure = 0;
      }
      updateUserBalanceByUserId(parentUser.userId, parentUser);
      logger.info({
        message: "Declare result db update for parent ",
        data: {
          parentUser,
        },
      });

      let parentRedisUpdateObj = {};

      if (parentUserRedisData?.exposure) {
        parentRedisUpdateObj = {
          ...value,
          exposure: parentUser.exposure,
          profitLoss: parentUser.profitLoss,
          myProfitLoss: parentUser.myProfitLoss,
        };
        updateUserDataRedis(key, parentRedisUpdateObj);
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

const calculateProfitLossMatchForUserUnDeclare = async (users, betId, matchId, fwProfitLoss, resultDeclare, redisEventName, userId, bulkWalletRecord, upperUserObj, matchData, commissionData, matchOddsWinBets) => {

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

    let teamARate = parseFloat(parseFloat(redisData?.teamARate||0).toFixed(2)) ?? Number.MAX_VALUE;
    let teamBRate = parseFloat(parseFloat(redisData?.teamBRate||0).toFixed(2)) ?? Number.MAX_VALUE;
    let teamCRate = parseFloat(parseFloat(redisData?.teamCRate||0).toFixed(2)) ?? Number.MAX_VALUE;

    let teamNoRateTie = parseFloat(parseFloat(redisData?.teamNoRateTie||0).toFixed(2)) ?? Number.MAX_VALUE;
    let teamYesRateTie = parseFloat(parseFloat(redisData?.teamYesRateTie||0).toFixed(2)) ?? Number.MAX_VALUE;

    let teamNoRateComplete = parseFloat(parseFloat(redisData?.teamNoRateComplete||0).toFixed(2)) ?? Number.MAX_VALUE;
    let teamYesRateComplete = parseFloat(parseFloat(redisData?.teamYesRateComplete||0).toFixed(2)) ?? Number.MAX_VALUE;

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
    matchOddsWinBets?.filter((item) => item.createBy == user.user.id)?.forEach((matchOddData) => {
      userCurrentBalance += parseFloat(parseFloat((matchOddData?.winAmount) / 100).toFixed(2))
      bulkWalletRecord.push({
        matchId: matchId,
        actionBy: userId,
        searchId: user.user.id,
        userId: user.user.id,
        amount: parseFloat(parseFloat((matchOddData?.winAmount) / 100).toFixed(2)),
        transType: transType.win,
        closingBalance: userCurrentBalance,
        createdAt:new Date(),
        description: `Revert deducted 1% for bet on match odds ${matchOddData?.eventType}/${matchOddData.eventName}-${matchOddData.teamName} on odds ${matchOddData.odds}/${matchOddData.betType} of stake ${matchOddData.amount} `,
      });
    });


  // deducting 1% from match odd win amount 
  if (parseFloat(getMultipleAmount?.winAmountMatchOdd) > 0) {
    profitLoss -=  parseFloat(((parseFloat(getMultipleAmount?.winAmountMatchOdd) / 100)).toFixed(2));
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

    await updateUserBalanceByUserId(user.user.id, userBalanceData);

    let userCommission = commissionData?.find((item) => item?.userId == user.user.id);
    if (userCommission) {
      userBalanceData.totalCommission = parseFloat(user.user.userBalance.totalCommission) - parseFloat(userCommission?.amount || 0);
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

    if (userRedisData?.exposure) {
      const { totalCommission, ...balanceDate } = userBalanceData;
      updateUserDataRedis(user.user.id, {
        ...matchTeamRates,
        ...balanceDate,
        [redisKeys.userMatchExposure + matchId]: maxLoss
      });
    }
    await updateUserBalanceByUserId(user.user.id, userBalanceData);
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
      ...(result != resultType.tie && result != resultType.noResult && parseFloat(getMultipleAmount.matchOddBetsCount||0) > 0 ? [{
        winAmount: parseFloat(parseFloat(getMultipleAmount.winAmount).toFixed(2)),
        lossAmount: parseFloat(parseFloat(getMultipleAmount.lossAmount).toFixed(2)),
        type: "MATCH ODDS",
        result: result
      }] : []),
      ...(result != resultType.noResult && parseFloat(getMultipleAmount.tiedBetsCount || 0) > 0 ? [{
        winAmount: parseFloat(parseFloat(getMultipleAmount.winAmountTied).toFixed(2)),
        lossAmount: parseFloat(parseFloat(getMultipleAmount.lossAmountTied).toFixed(2)),
        type: "Tied Match",
        result: result == resultType.tie ? "YES" : "NO"
      }] : []),
      
      ...(parseFloat(getMultipleAmount.completeBetsCount || 0) > 0 ? [{
        winAmount: parseFloat(parseFloat(getMultipleAmount.winAmountComplete).toFixed(2)),
        lossAmount: parseFloat(parseFloat(getMultipleAmount.lossAmountComplete).toFixed(2)),
        type: "Complete Match",
        result: "YES"
      }]:[])
    ];


    transactions?.forEach((item) => {
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
        upperUserObj[patentUser.id].profitLoss = upperUserObj[patentUser.id].profitLoss + profitLoss ;
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

        if(!parentCommissionIds.has(patentUser.id)){
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
          if(!faAdminCal.admin[user.user.superParentId]){
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
    let { user, startDate, endDate, matchId, searchId } = req.body;
    user = user || req.user;
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
    queryColumns = await profitLossPercentCol(user, queryColumns);
    totalLoss = `(Sum(CASE WHEN placeBet.result = 'LOSS' then ROUND(placeBet.lossAmount / 100 * ${queryColumns}, 2) ELSE 0 END) - Sum(CASE WHEN placeBet.result = 'WIN' then ROUND(placeBet.winAmount / 100 * ${queryColumns}, 2) ELSE 0 END)) as "totalLoss"`;

    if(user.roleName == userRoleConstant.user){
      totalLoss = '-' + totalLoss;
    }

    let childrenId = []
    if(user.roleName == userRoleConstant.fairGameWallet){
      childrenId = await getAllUsersByRole(userRoleConstant.user, ["id"]);
    }
    else if(user.roleName == userRoleConstant.fairGameAdmin){
      childrenId = await getUsers({ superParentId: user.id, roleName: userRoleConstant.user });
      childrenId = childrenId[0];
    }
     else {
      let userId = user.id;
      if (searchId){
        userId = searchId;
      }
      childrenId = await getChildsWithOnlyUserRole(userId);
    }

    childrenId = childrenId.map(item => item.id);
    if (!childrenId.length) {
      return SuccessResponse({
        statusCode: 200, message: { msg: "fetched", keys: { type: "Profit loss" } }, data: []
      }, req, res);
    }
    where.createBy = In(childrenId);

    const result = await getTotalProfitLoss(where, startDate, endDate, totalLoss);
    return SuccessResponse(
      {
        statusCode: 200, message: { msg: "fetched", keys: { type: "Total profit loss" } }, data: result   
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
    let { user, type, startDate, endDate, searchId } = req.body;
    user = user || req.user;

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
    queryColumns = await profitLossPercentCol(user, queryColumns);
    let rateProfitLoss = `(Sum(CASE WHEN placeBet.result = '${betResultStatus.LOSS}' and (placeBet.betType = '${betType.BACK}' or placeBet.betType = '${betType.LAY}') then ROUND(placeBet.lossAmount / 100 * ${queryColumns}, 2) ELSE 0 END) - Sum(CASE WHEN placeBet.result = '${betResultStatus.WIN}' and (placeBet.betType = '${betType.BACK}' or placeBet.betType = '${betType.LAY}') then ROUND(placeBet.winAmount / 100 * ${queryColumns}, 2) ELSE 0 END)) as "rateProfitLoss"`;
    let sessionProfitLoss = `(Sum(CASE WHEN placeBet.result = '${betResultStatus.LOSS}' and (placeBet.betType = '${betType.YES}' or placeBet.betType = '${betType.NO}') then ROUND(placeBet.lossAmount / 100 * ${queryColumns}, 2) ELSE 0 END) - Sum(CASE WHEN placeBet.result = '${betResultStatus.WIN}' and (placeBet.betType = '${betType.YES}' or placeBet.betType = '${betType.NO}') then ROUND(placeBet.winAmount / 100 * ${queryColumns}, 2) ELSE 0 END)) as "sessionProfitLoss"`;

    if(user.roleName == userRoleConstant.user){
      rateProfitLoss = '-' + rateProfitLoss;
      sessionProfitLoss = '-' + sessionProfitLoss;
    }

    let childrenId = [];
    if(user.roleName == userRoleConstant.fairGameWallet){
      childrenId = await getAllUsersByRole(userRoleConstant.user, ["id"]);
    }
    else if(user.roleName == userRoleConstant.fairGameAdmin){
      childrenId = await getUsers({ superParentId: user.id, roleName: userRoleConstant.user });
      childrenId = childrenId[0];
    }
     else {
      let userId = user.id;
      if (searchId){
        userId = searchId;
      }
      childrenId = await getChildsWithOnlyUserRole(userId);
    }

    childrenId = childrenId.map(item => item.id);
    if (!childrenId.length) {
      return SuccessResponse({
        statusCode: 200, message: { msg: "fetched", keys: { type: "Profit loss" } }, data: []
      }, req, res);
    }
    where.createBy = In(childrenId);

    const { result } = await getAllMatchTotalProfitLoss(where, startDate, endDate, sessionProfitLoss, rateProfitLoss);
    return SuccessResponse(
      {
        statusCode: 200, message: { msg: "fetched", keys: { type: "Total profit loss" } }, data: { result }
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
    let { user, matchId, betId, isSession,searchId } = req.body;
    user = user || req.user;

    let queryColumns = ``;
    let where = { marketBetType: isSession ? marketBetType.SESSION : marketBetType.MATCHBETTING };

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
    queryColumns = await profitLossPercentCol(user, queryColumns);
    let totalLoss = `(Sum(CASE WHEN placeBet.result = '${betResultStatus.LOSS}' then ROUND(placeBet.lossAmount / 100 * ${queryColumns}, 2) ELSE 0 END) - Sum(CASE WHEN placeBet.result = '${betResultStatus.WIN}' then ROUND(placeBet.winAmount / 100 * ${queryColumns}, 2) ELSE 0 END)) as "totalLoss"`;

    if(user.roleName == userRoleConstant.user){
      totalLoss = '-' + totalLoss;
    }

    let childrenId = []
    if(user.roleName == userRoleConstant.fairGameWallet){
      childrenId = await getAllUsersByRole(userRoleConstant.user, ["id"]);
    }
    else if(user.roleName == userRoleConstant.fairGameAdmin){
      childrenId = await getUsers({ superParentId: user.id, roleName: userRoleConstant.user });
      childrenId = childrenId[0];
    }
     else {
      let userId = user.id;
      if (searchId){
        userId = searchId;
      }
      childrenId = await getChildsWithOnlyUserRole(userId);
    }

    childrenId = childrenId.map(item => item.id);
    if (!childrenId.length) {
      return SuccessResponse({
        statusCode: 200, message: { msg: "fetched", keys: { type: "Profit loss" } }, data: []
      }, req, res);
    }
    where.createBy = In(childrenId);

    const result = await getBetsProfitLoss(where, totalLoss);
    return SuccessResponse(
      {
        statusCode: 200, message: { msg: "fetched", keys: { type: "Total profit loss" } }, data: result
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
    let { user, matchId, searchId } = req.body;
    user = user || req.user;

    let queryColumns = ``;
    let where = { marketBetType: marketBetType.SESSION, matchId: matchId };


    if (!user) {
      return ErrorResponse(
        { statusCode: 400, message: { msg: "invalidData" } },
        req,
        res
      );
    }
    queryColumns = await profitLossPercentCol(user, queryColumns);
    let totalLoss = `(Sum(CASE WHEN placeBet.result = '${betResultStatus.LOSS}' then ROUND(placeBet.lossAmount / 100 * ${queryColumns}, 2) ELSE 0 END) - Sum(CASE WHEN placeBet.result = '${betResultStatus.WIN}' then ROUND(placeBet.winAmount / 100 * ${queryColumns}, 2) ELSE 0 END)) as "totalLoss"`;

    if(user.roleName == userRoleConstant.user){
      totalLoss = '-' + totalLoss;
    }

    let childrenId = []
    if(user.roleName == userRoleConstant.fairGameWallet){
      childrenId = await getAllUsersByRole(userRoleConstant.user, ["id"]);
    }
    else if(user.roleName == userRoleConstant.fairGameAdmin){
      childrenId = await getUsers({ superParentId: user.id, roleName: userRoleConstant.user });
      childrenId = childrenId[0];
    }
     else {
      let userId = user.id;
      if (searchId){
        userId = searchId;
      }
      childrenId = await getChildsWithOnlyUserRole(userId);
    }

    childrenId = childrenId.map(item => item.id);
    if (!childrenId.length) {
      return SuccessResponse({
        statusCode: 200, message: { msg: "fetched", keys: { type: "Profit loss" } }, data: []
      }, req, res);
    }
    where.createBy = In(childrenId);

    const result = await getSessionsProfitLoss(where, totalLoss);
    return SuccessResponse(
      {
        statusCode: 200, message: { msg: "fetched", keys: { type: "Session profit loss" } }, data: result
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

exports.getBetCount = async (req,res)=>{
  try {
    const parentId = req.query.parentId;
    const result = await getBetsWithMatchId(parentId ?  ` AND user.superParentId = '${parentId}'` : "");
    return SuccessResponse(
      {
        statusCode: 200,  data: result
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
    if(roleName == userRoleConstant.fairGameWallet){
      let childUsersBalances = await getAllUsersBalanceSum();
      balanceSum[id] = parseFloat(parseFloat(childUsersBalances?.balance).toFixed(2));
    }
    else if (roleName == userRoleConstant.fairGameAdmin) {
      let childUsersBalances = await getAllUsersBalanceSumByFgId(id);
      balanceSum[id] = parseFloat(parseFloat(childUsersBalances?.balance).toFixed(2));
    }
    else{
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

    const resUserData=[];

    for(let userData of userIds?.split("|")){
      userData=JSON.parse(userData);
      const isUserExist=await hasUserInCache(userData?.id);
      let userProfitLossData={};

      if (isUserExist) {
        let betsData = await getUserRedisKeys(userData?.id, [redisKeys.userTeamARate + matchId, redisKeys.userTeamBRate + matchId, redisKeys.userTeamCRate + matchId]);
        userProfitLossData.tramRateA =betsData?.[0]? parseFloat(betsData?.[0])?.toFixed(2):0;
        userProfitLossData.tramRateB = betsData?.[1]? parseFloat(betsData?.[1])?.toFixed(2):0;
        userProfitLossData.tramRateC = betsData?.[2]? parseFloat(betsData?.[2])?.toFixed(2):0;
      }
      else {
        let betsData = await settingBetsDataAtLogin(userData);
        userProfitLossData = {
          tramRateA: betsData?.[redisKeys.userTeamARate + matchId] ? parseFloat(betsData?.[redisKeys.userTeamARate + matchId]).toFixed(2) : 0, tramRateB: betsData?.[redisKeys.userTeamBRate + matchId] ? parseFloat(betsData?.[redisKeys.userTeamBRate + matchId]).toFixed(2) : 0, teamCRate: betsData?.[redisKeys.userTeamCRate + matchId] ? parseFloat(betsData?.[redisKeys.userTeamCRate + matchId]).toFixed(2) : 0
        }   
      }
      userProfitLossData.userName = userData?.userName;
      resUserData.push(userProfitLossData);
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