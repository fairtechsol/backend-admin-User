const grpc = require("@grpc/grpc-js");
const { __mf } = require("i18n");
const { logger } = require("../../../config/logger");
const lodash = require("lodash");
const { userRoleConstant, partnershipPrefixByRole, betResultStatus, marketBetType, matchBettingType, expertDomain, socketData, redisKeys, sessionBettingType, walletDomain } = require("../../../config/contants");
const { getBet, updatePlaceBet, getUserSessionsProfitLoss, getBetsProfitLoss, findAllPlacedBet, deleteBet, getBetsWithMatchId } = require("../../../services/betPlacedService");
const { getChildsWithOnlyUserRole, getAllUsers, getUserById } = require("../../../services/userService");
const { profitLossPercentCol, childIdquery, findUserPartnerShipObj, calculatePLAllBet, mergeProfitLoss, forceLogoutUser, calculateProfitLossForRacingMatchToResult, calculateRacingRate, parseRedisData } = require("../../../services/commonService");
const { In, IsNull, Not } = require("typeorm");
const { getQueryColumns } = require("../../../services/commonService");
const { getUserRedisData, incrementValuesRedis } = require("../../../services/redis/commonfunction");
const { getMatchData } = require("../../../services/matchService");
const { getUserBalanceDataByUserId, updateUserExposure } = require("../../../services/userBalanceService");
const { updateUser } = require("../../../controllers/userController");
const { sendMessageToUser } = require("../../../sockets/socketManager");
const { walletSessionBetDeleteQueue, expertSessionBetDeleteQueue, walletTournamentMatchBetDeleteQueue, expertTournamentMatchBetDeleteQueue } = require("../../../queue/consumer");
const { getTournamentBettingHandler } = require("../../grpcClient/handlers/expert/matchHandler");
const { lockUnlockUserByUserPanelHandler } = require("../../grpcClient/handlers/wallet/userHandler");

exports.getPlacedBets = async (call) => {
  try {
    let { roleName, userId, ...queryData } = JSON.parse(call.request.query || "{}");
    let result;
    let select = [
      "betPlaced.id", "betPlaced.verifyBy", "betPlaced.isVerified", "betPlaced.eventName", "betPlaced.teamName", "betPlaced.betType", "betPlaced.amount", "betPlaced.rate", "betPlaced.winAmount", "betPlaced.lossAmount", "betPlaced.createdAt", "betPlaced.eventType", "betPlaced.marketType", "betPlaced.odds", "betPlaced.marketBetType", "betPlaced.result", "betPlaced.matchId", "betPlaced.betId", "betPlaced.deleteReason", "betPlaced.bettingName", "match.startAt", "match.teamC", "betPlaced.runnerId", "betPlaced.isCommissionActive"
    ];

    if (roleName == userRoleConstant.user) {
      select.push("user.id", "user.userName");
      result = await getBet({ createBy: userId }, queryData, roleName, select, null, true);
    } else if (roleName && ![userRoleConstant.fairGameAdmin, userRoleConstant.fairGameWallet].includes(roleName)) {
      let childsId = await getChildsWithOnlyUserRole(userId);
      childsId = childsId.map(item => item.id);
      if (!childsId.length) {
        return { data: JSON.stringify({ count: 0, rows: [] }) }
      }
      let partnershipColumn = partnershipPrefixByRole[roleName] + 'Partnership';
      select.push("user.id", "user.userName", `user.${partnershipColumn}`);
      result = await getBet({ createBy: In(childsId) }, queryData, roleName, select, null, true);
    }
    else {
      const demoUsers = await getAllUsers({ isDemo: true });
      select.push("user.id", "user.userName", "user.fwPartnership", "user.faPartnership");
      result = await getBet(`user.id is not null ${demoUsers?.length ? `and betPlaced.createBy not in ('${demoUsers?.map((item) => item?.id).join("','")}')` : ""}`, queryData, roleName, select, userId);
    }

    if (!result[1]) {
      return { data: JSON.stringify({ count: 0, rows: [] }) }

    }
    const domainUrl = `${call.call.host}`;
    result[0] = result?.[0]?.map((item) => {
      return {
        ...item,
        domain: domainUrl,
      };
    });

    return { data: JSON.stringify({ count: result[1], rows: result[0] }) }

  } catch (err) {
    logger.error({
      error: "Error in get bet for wallet",
      stack: err.stack,
      message: err.message,
    })
    throw {
      code: grpc.status.INTERNAL,
      message: err?.message || __mf("internalServerError"),
    };
  }

};

exports.verifyBet = async (call) => {
  try {
    let { isVerified, id, verifyBy } = call.request;
    await updatePlaceBet({ id: id }, { isVerified: isVerified, verifyBy: verifyBy })
    return {};
  } catch (error) {
    logger.error({
      error: `Error at verify bet.`,
      stack: error.stack,
      message: error.message,
    });
    throw {
      code: grpc.status.INTERNAL,
      message: err?.message || __mf("internalServerError"),
    };
  }
}

exports.getSessionBetProfitLossExpert = async (call) => {
  try {
    let { betId } = call?.request;

    let queryColumns = ``;
    let where = { betId: betId };

    queryColumns = await profitLossPercentCol({ roleName: userRoleConstant.fairGameWallet }, queryColumns);
    let sessionProfitLoss = `(Sum(CASE WHEN placeBet.result = '${betResultStatus.LOSS}' and (placeBet.marketBetType = '${marketBetType.SESSION}') then ROUND(placeBet.lossAmount / 100 * ${queryColumns}, 2) ELSE 0 END) - Sum(CASE WHEN placeBet.result = '${betResultStatus.WIN}' and (placeBet.marketBetType = '${marketBetType.SESSION}') then ROUND(placeBet.winAmount / 100 * ${queryColumns}, 2) ELSE 0 END)) as "sessionProfitLoss", COUNT(placeBet.id) as "totalBet"`;

    const userData = await getUserSessionsProfitLoss(where, [sessionProfitLoss, 'user.userName as "userName"', 'user.id as "userId"']);

    return { data: JSON.stringify(userData) };
  } catch (error) {
    logger.error({
      context: `Error in get bet profit loss.`,
      error: error.message,
      stake: error.stack,
    });
    throw {
      code: grpc.status.INTERNAL,
      message: error?.message || __mf("internalServerError"),
    };
  }
}

exports.getResultBetProfitLoss = async (call) => {
  try {
    let { user, matchId, betId, isSession, searchId, partnerShipRoleName } = call.request;
   
    if (!user) {
      throw {
        code: grpc.status.INVALID_ARGUMENT,
        message: __mf("invalidData"),
      };
    }
   
    const domainUrl = `${call?.call?.host}`;

    const result = await getBetsProfitLoss(user.id, matchId || null, betId || null, searchId || null, partnerShipRoleName, domainUrl, isSession);
    return { data: JSON.stringify(result) };
  } catch (error) {
    logger.error({
      context: `Error in get bet profit loss.`,
      error: error.message,
      stake: error.stack,
    });
    throw {
      code: grpc.status.INTERNAL,
      message: error?.message || __mf("internalServerError"),
    };
  }
}

exports.deleteMultipleBet = async (call) => {
  try {
    let {
      matchId, data, deleteReason, isPermanentDelete
    } = call.request;
    data = JSON.parse(call.request.data);

    if (data?.length == 0) {
      throw {
        code: grpc.status.INVALID_ARGUMENT,
        message: __mf("NoData"),
      };
    }
    let placedBetIdArray = [];
    data.forEach(obj => {
      placedBetIdArray.push(obj.placeBetId);
    });
    let placedBet = await findAllPlacedBet({ matchId: matchId, id: In(placedBetIdArray) });
    let updateObj = {};
    placedBet.forEach(bet => {
      let isSessionBet = false;
      let isTournamentBet = false;
      if (bet.marketBetType == 'SESSION') {
        isSessionBet = true;
      }
      else if (bet.marketType == matchBettingType.tournament) {
        isTournamentBet = true;
        isAnyMatchBet = true;
      }
      if (!updateObj[bet.createBy]) {
        updateObj[bet.createBy] = { [bet.betId]: { isSessionBet: isSessionBet, isTournamentBet: isTournamentBet, array: [bet] } };
      } else {
        if (!updateObj[bet.createBy][bet.betId]) {
          updateObj[bet.createBy][bet.betId] = { isSessionBet: isSessionBet, isTournamentBet: isTournamentBet, array: [bet] };
        } else {
          updateObj[bet.createBy][bet.betId].array.push(bet);
        }
      }
    });
    let tournamentBettingDetail;
    try {
      apiResponse = await getTournamentBettingHandler({ matchId: matchId });
    } catch (error) {
      logger.info({
        info: `Error at get match details for delete match bet.`,
        data: call.request
      });
      throw error;
    }
    let { matchBetting: matchBettingTournament } = apiResponse.data;
    tournamentBettingDetail = matchBettingTournament;

    const domainUrl = `${call.call.host}`;
    if (Object.keys(updateObj).length > 0) {
      for (let key in updateObj) {
        let userId = key;
        let userDataDelete = updateObj[key];
        for (let value in userDataDelete) {
          let betId = value;
          let bet = userDataDelete[value];
          if (bet.isSessionBet) {
            await updateUserAtSession(userId, betId, matchId, bet.array, deleteReason, domainUrl, isPermanentDelete);
          }
          else if (bet.isTournamentBet) {
            await updateUserAtMatchOddsTournament(userId, betId, matchId, bet.array, deleteReason, domainUrl, tournamentBettingDetail?.find((item) => item?.id == betId)?.runners, isPermanentDelete);
          }

        };
      }
    }
    if (isPermanentDelete) {
      await deleteBet({ id: In(placedBetIdArray) });
    }
    return {};
  } catch (error) {
    logger.error({
      error: `Error at delete bet for the user.`,
      stack: error.stack,
      message: error.message,
    });
    throw {
      code: grpc.status.INTERNAL,
      message: error?.message || __mf("internalServerError"),
    };
  }
}

const updateUserAtSession = async (userId, betId, matchId, bets, deleteReason, domainUrl, isPermanentDelete) => {
  let userRedisData = await getUserRedisData(userId);
  let isUserLogin = userRedisData ? true : false;
  let userOldExposure = 0;
  let betPlacedId = bets.map(bet => bet.id);
  let partnershipObj = {};
  let oldSessionExposure = 0, oldMaxLoss = 0;
  let redisName = `${betId}_profitLoss`;
  let socketSessionEvent = socketData.sessionDeleteBet;
  let redisSesionExposureName = redisKeys.userSessionExposure + matchId;
  let oldProfitLoss;
  let currUserBalance;
  const matchDetail = await getMatchData({ id: matchId }, ["id", "teamC"])

  if (isUserLogin) {
    userOldExposure = parseFloat(userRedisData.exposure);
    partnershipObj = JSON.parse(userRedisData.partnerShips);
    oldSessionExposure = userRedisData[redisSesionExposureName];
    oldProfitLoss = userRedisData[redisName];
    currUserBalance = parseFloat(userRedisData.currentBalance);
  } else {
    let user = await getUserById(userId);
    let partnership = await findUserPartnerShipObj(user);
    partnershipObj = JSON.parse(partnership);
    let userBalance = await getUserBalanceDataByUserId(userId);
    userOldExposure = userBalance.exposure;
    currUserBalance = parseFloat(userBalance.currentBalance);


    let placedBet = await findAllPlacedBet({ matchId: matchId, betId: betId, createBy: userId, deleteReason: IsNull() });
    let userAllBetProfitLoss = await calculatePLAllBet(placedBet, placedBet?.[0]?.marketType, 100, null, null, matchDetail);
    oldProfitLoss = {
      lowerLimitOdds: userAllBetProfitLoss.lowerLimitOdds,
      upperLimitOdds: userAllBetProfitLoss.upperLimitOdds,
      maxLoss: userAllBetProfitLoss.maxLoss,
      betPlaced: userAllBetProfitLoss.betData,
      totalBet: userAllBetProfitLoss.total_bet
    }
    oldProfitLoss = JSON.stringify(oldProfitLoss);
  }

  if (oldProfitLoss) {
    oldProfitLoss = JSON.parse(oldProfitLoss);
    oldMaxLoss = parseFloat(oldProfitLoss.maxLoss);
  }
  let oldLowerLimitOdds = parseFloat(oldProfitLoss.lowerLimitOdds);
  let oldUpperLimitOdds = parseFloat(oldProfitLoss.upperLimitOdds);
  let userDeleteProfitLoss = await calculatePLAllBet(bets, bets?.[0]?.marketType, 100, oldLowerLimitOdds, oldUpperLimitOdds, matchDetail);

  if (![sessionBettingType.oddEven, sessionBettingType.fancy1, sessionBettingType.cricketCasino].includes(bets?.[0]?.marketType)) {
    await mergeProfitLoss(userDeleteProfitLoss.betData, oldProfitLoss.betPlaced);
  }
  let oldBetPlacedPL = oldProfitLoss.betPlaced;
  let newMaxLoss = 0;

  oldProfitLoss.totalBet = oldProfitLoss.totalBet - userDeleteProfitLoss.total_bet;
  if ([sessionBettingType.oddEven, sessionBettingType.fancy1, sessionBettingType.cricketCasino].includes(bets?.[0]?.marketType)) {
    for (let item of Object.keys(userDeleteProfitLoss.betData)) {
      oldBetPlacedPL[item] = oldBetPlacedPL[item] - userDeleteProfitLoss.betData[item];
      if (newMaxLoss < Math.abs(oldBetPlacedPL[item]) && oldBetPlacedPL[item] < 0) {
        newMaxLoss = Math.abs(oldBetPlacedPL[item]);
      }
    }
  }
  else {
    for (let i = 0; i < oldBetPlacedPL.length; i++) {
      oldBetPlacedPL[i].profitLoss = oldBetPlacedPL[i].profitLoss - userDeleteProfitLoss.betData[i].profitLoss;
      if (newMaxLoss < Math.abs(oldBetPlacedPL[i].profitLoss) && oldBetPlacedPL[i].profitLoss < 0) {
        newMaxLoss = Math.abs(oldBetPlacedPL[i].profitLoss);
      }

    }
  }
  oldProfitLoss.betPlaced = oldBetPlacedPL;
  oldProfitLoss.maxLoss = newMaxLoss;
  let exposureDiff = oldMaxLoss - newMaxLoss;

  await updateUserExposure(userId, -exposureDiff);

  // blocking user if its exposure would increase by current balance
  const userCreatedBy = await getUserById(userId, ["createBy", "userBlock", "autoBlock", "superParentId"]);

  if (userOldExposure - exposureDiff > currUserBalance && !userCreatedBy.userBlock) {
    await updateUser(userId, {
      autoBlock: true,
      userBlock: true,
      userBlockedBy: userCreatedBy?.createBy == userId ? userCreatedBy?.superParentId : userCreatedBy?.createBy
    });

    if (userCreatedBy?.createBy == userId) {
      await lockUnlockUserByUserPanelHandler(
        {
          userId: userId, userBlock: true, parentId: userCreatedBy?.superParentId, autoBlock: true
        }
      ).catch(error => {
        logger.error({
          error: `Error at auto block user.`,
          stack: error.stack,
          message: error.message,
        });
        throw error
      });
    }

    if (isUserLogin) {
      forceLogoutUser(userId);
    }
  }
  else if (userCreatedBy.autoBlock && userCreatedBy.userBlock && userOldExposure - exposureDiff <= currUserBalance) {
    await updateUser(userId, {
      autoBlock: false,
      userBlock: false,
      userBlockedBy: null
    });

    if (userCreatedBy?.createBy == userId) {
      await lockUnlockUserByUserPanelHandler(
        {
          userId: userId, userBlock: false, parentId: null, autoBlock: false
        }
      ).catch(error => {
        logger.error({
          error: `Error at auto block user.`,
          stack: error.stack,
          message: error.message,
        });
        throw error
      });
    }
  }

  if (isUserLogin) {
    let redisObject = {
      [redisSesionExposureName]: oldSessionExposure - exposureDiff,
      exposure: userOldExposure - exposureDiff,
      [redisName]: JSON.stringify(oldProfitLoss)
    }
    await incrementValuesRedis(userId, {
      exposure: -exposureDiff,
      [redisSesionExposureName]: -exposureDiff
    }, {
      [redisName]: JSON.stringify(oldProfitLoss)
    });
    sendMessageToUser(userId, socketSessionEvent, {
      currentBalance: userRedisData?.currentBalance,
      exposure: redisObject?.exposure,
      sessionExposure: redisObject[redisSesionExposureName],
      profitLoss: oldProfitLoss,
      bets: bets,
      betId: betId,
      deleteReason: deleteReason,
      matchId: matchId,
      betPlacedId: betPlacedId,
      isPermanentDelete: isPermanentDelete
    });
  }

  await updatePlaceBet({ matchId: matchId, id: In(betPlacedId) }, { deleteReason: deleteReason, result: betResultStatus.UNDECLARE });

  Object.keys(partnershipPrefixByRole)
    ?.filter(
      (item) =>
        item != userRoleConstant.fairGameAdmin &&
        item != userRoleConstant.fairGameWallet && item != userRoleConstant.expert
    )
    ?.map(async (item) => {
      let partnerShipKey = `${partnershipPrefixByRole[item]}`;

      // Check if partnershipId exists in partnershipObj
      if (partnershipObj[`${partnerShipKey}PartnershipId`]) {
        let partnershipId = partnershipObj[`${partnerShipKey}PartnershipId`];
        let partnership = partnershipObj[`${partnerShipKey}Partnership`];

        try {
          // Get user data from Redis or balance data by userId
          let masterRedisData = await getUserRedisData(partnershipId);

          if (lodash.isEmpty(masterRedisData)) {
            // If masterRedisData is empty, update partner exposure
            await updateUserExposure(partnershipId, (-exposureDiff));
          } else {
            // If masterRedisData exists, update partner exposure and session data
            let masterExposure = parseFloat(masterRedisData.exposure) ?? 0;
            let partnerExposure = (masterExposure || 0) - exposureDiff;

            await updateUserExposure(partnershipId, (-exposureDiff));

            let oldProfitLossParent = JSON.parse(masterRedisData[redisName]);
            let parentPLbetPlaced = oldProfitLossParent?.betPlaced || [];
            let newMaxLossParent = 0;
            let oldMaxLossParent = oldProfitLossParent?.maxLoss;

            if (![sessionBettingType.oddEven, sessionBettingType.fancy1, sessionBettingType.cricketCasino].includes(bets?.[0]?.marketType)) {
              await mergeProfitLoss(userDeleteProfitLoss.betData, parentPLbetPlaced);
            }

            if ([sessionBettingType.oddEven, sessionBettingType.fancy1, sessionBettingType.cricketCasino].includes(bets?.[0]?.marketType)) {
              Object.keys(userDeleteProfitLoss.betData).forEach((ob, index) => {
                let partnershipData = (userDeleteProfitLoss.betData[ob] * partnership) / 100;
                parentPLbetPlaced[ob] = parentPLbetPlaced[ob] + partnershipData;
                if (newMaxLossParent < Math.abs(parentPLbetPlaced[ob]) && parentPLbetPlaced[ob] < 0) {
                  newMaxLossParent = Math.abs(parentPLbetPlaced[ob]);
                }
              });
            }
            else {

              userDeleteProfitLoss.betData.forEach((ob, index) => {
                let partnershipData = (ob.profitLoss * partnership) / 100;
                if (ob.odds == parentPLbetPlaced[index].odds) {
                  parentPLbetPlaced[index].profitLoss = parseFloat((parseFloat(parentPLbetPlaced[index].profitLoss) + partnershipData).toFixed(2));
                  if (newMaxLossParent < Math.abs(parentPLbetPlaced[index].profitLoss) && parentPLbetPlaced[index].profitLoss < 0) {
                    newMaxLossParent = Math.abs(parentPLbetPlaced[index].profitLoss);
                  }
                }
              });
            }
            oldProfitLossParent.betPlaced = parentPLbetPlaced;
            oldProfitLossParent.maxLoss = newMaxLossParent;
            oldProfitLossParent.totalBet = oldProfitLossParent.totalBet - userDeleteProfitLoss.total_bet;

            let sessionExposure = parseFloat(masterRedisData[redisSesionExposureName]) - oldMaxLossParent + newMaxLossParent;
            let redisObj = {
              [redisName]: JSON.stringify(oldProfitLossParent),
              [redisSesionExposureName]: sessionExposure,
              exposure: partnerExposure
            };

            await incrementValuesRedis(partnershipId, { exposure: -exposureDiff, [redisSesionExposureName]: -exposureDiff }, { [redisName]: JSON.stringify(oldProfitLossParent), });

            // Send data to socket for session bet placement
            sendMessageToUser(partnershipId, socketSessionEvent, {
              exposure: redisObj?.exposure,
              sessionExposure: redisObj[redisSesionExposureName],
              profitLoss: oldProfitLossParent,
              bets: bets,
              betId: betId,
              deleteReason: deleteReason,
              matchId: matchId,
              betPlacedId: betPlacedId,
              isPermanentDelete: isPermanentDelete
            });

          }
        } catch (error) {
          // Log error if any during exposure update
          logger.error({
            context: `error in ${item} exposure update`,
            process: `User ID : ${userId} and ${item} id ${partnershipId}`,
            error: error.message,
            stake: error.stack,
          });
        }
      }
    });

  let queueObject = {
    userId: userId,
    partnership: partnershipObj,
    userDeleteProfitLoss: userDeleteProfitLoss,
    exposureDiff: exposureDiff,
    betId: betId,
    matchId: matchId,
    deleteReason: deleteReason,
    domainUrl: domainUrl,
    betPlacedId: betPlacedId,
    sessionType: bets?.[0]?.marketType,
    isPermanentDelete: isPermanentDelete
  }
  const walletJob = walletSessionBetDeleteQueue.createJob(queueObject);
  await walletJob.save();

  const expertJob = expertSessionBetDeleteQueue.createJob(queueObject);
  await expertJob.save();

}

const updateUserAtMatchOddsTournament = async (userId, betId, matchId, bets, deleteReason, domainUrl, runners, isPermanentDelete) => {
  let userRedisData = await getUserRedisData(userId);
  let isUserLogin = !!userRedisData;
  let userOldExposure = 0;
  let betPlacedId = bets.map(bet => bet.id);
  let partnershipObj = {};
  let socketSessionEvent = socketData.matchDeleteBet;
  let teamRates = {};
  let matchBetType = bets?.[0].marketType;
  let currUserBalance;

  if (isUserLogin) {
    userOldExposure = parseFloat(userRedisData.exposure);
    partnershipObj = JSON.parse(userRedisData.partnerShips);
    teamRates = JSON.parse(userRedisData[`${betId}${redisKeys.profitLoss}_${matchId}`]);
    currUserBalance = parseFloat(userRedisData.currentBalance);
  } else {
    let user = await getUserById(userId);
    let partnership = await findUserPartnerShipObj(user);
    partnershipObj = JSON.parse(partnership);
    let userBalance = await getUserBalanceDataByUserId(userId);
    userOldExposure = userBalance.exposure;
    currUserBalance = parseFloat(userBalance.currentBalance);
    let redisData = await calculateProfitLossForRacingMatchToResult([betId], userId, { runners });
    teamRates = redisData[`${betId}${redisKeys.profitLoss}_${matchId}`];
  }

  let maximumLossOld = Math.min(...Object.values(teamRates), 0);

  let newTeamRate = runners.reduce((acc, key) => {
    acc[key?.id] = 0;
    return acc;
  }, {});

  for (const element of bets) {
    let data = {
      runners: runners,
      winAmount: element.winAmount,
      lossAmount: element.lossAmount,
      bettingType: element.betType,
      runnerId: element.runnerId
    };
    newTeamRate = await calculateRacingRate(newTeamRate, data, 100);
  }

  // do not chagne any value in newTeamRate object this is using for parent calculation
  Object.keys(teamRates)?.forEach((item) => {
    teamRates[item] -= newTeamRate[item];
    teamRates[item] = parseRedisData(item, teamRates);
  });

  let maximumLoss = Math.min(...Object.values(teamRates), 0);
  maximumLoss = Math.abs(maximumLoss);
  maximumLossOld = Math.abs(maximumLossOld);

  let exposureDiff = maximumLossOld - maximumLoss;

  await updateUserExposure(userId, (-exposureDiff));

  // blocking user if its exposure would increase by current balance
  const userCreatedBy = await getUserById(userId, ["createBy", "userBlock", "autoBlock", "superParentId"]);

  if (userOldExposure - exposureDiff > currUserBalance && !userCreatedBy.userBlock) {
    await updateUser(userId, {
      autoBlock: true,
      userBlock: true,
      userBlockedBy: userCreatedBy?.createBy == userId ? userCreatedBy.superParentId : userCreatedBy.createBy
    });

    if (userCreatedBy?.createBy == userId) {
      await lockUnlockUserByUserPanelHandler(
        {
          userId: userId, userBlock: true, parentId: userCreatedBy.superParentId, autoBlock: true
        }
      ).catch(error => {
        logger.error({
          error: `Error at auto block user.`,
          stack: error.stack,
          message: error.message,
        });
        throw error
      });
    }

    if (isUserLogin) {
      forceLogoutUser(userId);
    }
  }
  else if (userCreatedBy.autoBlock && userCreatedBy.userBlock && userOldExposure - exposureDiff <= currUserBalance) {
    await updateUser(userId, {
      autoBlock: false,
      userBlock: false,
      userBlockedBy: null
    });

    if (userCreatedBy?.createBy == userId) {
      await lockUnlockUserByUserPanelHandler(
        {
          userId: userId, userBlock: false, parentId: null, autoBlock: false
        }
      ).catch(error => {
        logger.error({
          error: `Error at auto block user.`,
          stack: error.stack,
          message: error.message,
        });
        throw error
      });
    }
  }

  if (isUserLogin) {
    let redisObject = {
      [`${betId}${redisKeys.profitLoss}_${matchId}`]: JSON.stringify(teamRates)
    }
    await incrementValuesRedis(userId, {
      [redisKeys.userMatchExposure + matchId]: -exposureDiff,
      [redisKeys.userAllExposure]: -exposureDiff
    }, redisObject);

    sendMessageToUser(userId, socketSessionEvent, {
      currentBalance: userRedisData?.currentBalance,
      exposure: userOldExposure - exposureDiff,
      bets: bets,
      betId: betId,
      deleteReason: deleteReason,
      matchId: matchId,
      betPlacedId: betPlacedId,
      matchBetType,
      teamRate: teamRates,
      isPermanentDelete: isPermanentDelete
    });
  }
  await updatePlaceBet({ matchId: matchId, id: In(betPlacedId) }, { deleteReason: deleteReason, result: betResultStatus.UNDECLARE });

  Object.keys(partnershipPrefixByRole)
    ?.filter(
      (item) =>
        item != userRoleConstant.fairGameAdmin &&
        item != userRoleConstant.fairGameWallet && item != userRoleConstant.expert
    )
    ?.map(async (item) => {
      let partnerShipKey = `${partnershipPrefixByRole[item]}`;

      // Check if partnershipId exists in partnershipObj
      if (partnershipObj[`${partnerShipKey}PartnershipId`]) {
        let partnershipId = partnershipObj[`${partnerShipKey}PartnershipId`];
        let partnership = partnershipObj[`${partnerShipKey}Partnership`];

        try {
          // Get user data from Redis or balance data by userId
          let masterRedisData = await getUserRedisData(partnershipId);
          await updateUserExposure(partnershipId, (-exposureDiff));

          if (!lodash.isEmpty(masterRedisData)) {
            // If masterRedisData exists, update partner exposure and session data
            let masterExposure = parseFloat(masterRedisData.exposure) ?? 0;
            let partnerExposure = masterExposure - exposureDiff;

            let masterTeamRates = JSON.parse(masterRedisData[`${betId}${redisKeys.profitLoss}_${matchId}`]);

            masterTeamRates = Object.keys(masterTeamRates).reduce((acc, key) => {
              acc[key] = parseFloat((parseRedisData(key, masterTeamRates) + ((newTeamRate[key] * partnership) / 100)).toFixed(2));
              return acc;
            }, {});

            let redisObj = {
              [`${betId}${redisKeys.profitLoss}_${matchId}`]: JSON.stringify(masterTeamRates)
            }
            await incrementValuesRedis(partnershipId, {
              exposure: -exposureDiff,
              [redisKeys.userMatchExposure + matchId]: -exposureDiff,
            }, redisObj);
            // Send data to socket for session bet placement
            sendMessageToUser(partnershipId, socketSessionEvent, {
              currentBalance: userRedisData?.currentBalance,
              exposure: partnerExposure,
              bets: bets,
              betId: betId,
              deleteReason: deleteReason,
              matchId: matchId,
              betPlacedId: betPlacedId,
              matchBetType,
              teamRate: masterTeamRates,
              isPermanentDelete: isPermanentDelete
            });

          }
        } catch (error) {
          // Log error if any during exposure update
          logger.error({
            context: `error in ${item} exposure update for delete match bet`,
            process: `User ID : ${userId} and ${item} id ${partnershipId}`,
            error: error.message,
            stake: error.stack,
          });
        }
      }
    });

  let queueObject = {
    userId: userId,
    partnership: partnershipObj,
    exposureDiff: exposureDiff,
    betId: betId,
    matchId: matchId,
    deleteReason: deleteReason,
    domainUrl: domainUrl,
    betPlacedId: betPlacedId,
    matchBetType, newTeamRate, isPermanentDelete
  }

  const walletJob = walletTournamentMatchBetDeleteQueue.createJob(queueObject);
  await walletJob.save();

  const expertJob = expertTournamentMatchBetDeleteQueue.createJob(queueObject);
  await expertJob.save();
}

exports.changeBetsDeleteReason = async (call) => {
  try {
    let { deleteReason, betIds, matchId } = call.request;
    betIds = JSON.parse(betIds);
    await updatePlaceBet({ id: In(betIds), deleteReason: Not(IsNull()) }, { deleteReason: deleteReason });

    const userIds = await findAllPlacedBet({ id: In(betIds) }, ["createBy", "id"]);

    const userWiseBetId = {};
    const walletWiseBetId = {};

    for (let item of userIds) {
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
        const superAdminIds = Object.keys(partnership)?.filter((items) => [`${partnershipPrefixByRole[userRoleConstant.fairGameAdmin]}PartnershipId`, `${partnershipPrefixByRole[userRoleConstant.fairGameWallet]}PartnershipId`].includes(items))?.map((items) => partnership[items]);
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

    Object.keys(userWiseBetId)?.forEach((item) => {
      sendMessageToUser(item, socketData.updateDeleteReason, {
        betIds: userWiseBetId?.[item]?.bets,
        deleteReason: deleteReason,
        matchId: matchId
      });
    });
    return { data: JSON.stringify(walletWiseBetId) }
  } catch (err) {
    throw {
      code: grpc.status.INTERNAL,
      message: err?.message || __mf("internalServerError"),
    };
  }
};


exports.getBetCount = async (call) => {
  try {
    const { parentId, matchId } = call.request;
    const result = await getBetsWithMatchId((parentId ? ` AND user.superParentId = '${parentId}'` : ""), (matchId ? { matchId: matchId } : {}));

    return { data: JSON.stringify(result) }


  } catch (error) {
    logger.error({
      context: `Error in get bet count.`,
      error: error.message,
      stake: error.stack,
    });
    throw {
      code: grpc.status.INTERNAL,
      message: err?.message || __mf("internalServerError"),
    };
  }
}