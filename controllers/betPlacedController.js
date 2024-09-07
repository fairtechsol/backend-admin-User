const betPlacedService = require('../services/betPlacedService');
const userService = require('../services/userService');
const { ErrorResponse, SuccessResponse } = require('../utils/response')
const { betStatusType, teamStatus, matchBettingType, betType, redisKeys, betResultStatus, marketBetType, userRoleConstant, manualMatchBettingType, expertDomain, partnershipPrefixByRole, microServiceDomain, tiedManualTeamName, socketData, rateCuttingBetType, marketBettingTypeByBettingType, otherEventMatchBettingRedisKey, walletDomain, gameType, matchBettingsTeamName, matchWithTeamName, racingBettingType, casinoMicroServiceDomain, cardGameType, sessionBettingType } = require("../config/contants");
const { logger } = require("../config/logger");
const { getUserRedisData, updateMatchExposure, getUserRedisKey, incrementValuesRedis, setCardBetPlaceRedis } = require("../services/redis/commonfunction");
const { getUserById } = require("../services/userService");
const { apiCall, apiMethod, allApiRoutes } = require("../utils/apiService");
const { calculateRate, calculateProfitLossSession, calculatePLAllBet, mergeProfitLoss, findUserPartnerShipObj, calculateProfitLossForMatchToResult, forceLogoutUser, calculateProfitLossForOtherMatchToResult,getRedisKeys, parseRedisData, calculateRacingRate, calculateProfitLossForRacingMatchToResult, profitLossPercentCol, calculateProfitLossSessionOddEven, calculateProfitLossSessionCasinoCricket, calculateProfitLossSessionFancy1 } = require('../services/commonService');
const { MatchBetQueue, WalletMatchBetQueue, SessionMatchBetQueue, WalletSessionBetQueue, ExpertSessionBetQueue, ExpertMatchBetQueue, walletSessionBetDeleteQueue, expertSessionBetDeleteQueue, walletMatchBetDeleteQueue, expertMatchBetDeleteQueue, MatchRacingBetQueue, WalletMatchRacingBetQueue, ExpertMatchRacingBetQueue, walletRaceMatchBetDeleteQueue, expertRaceMatchBetDeleteQueue, CardMatchBetQueue, WalletCardMatchBetQueue, ExpertCardMatchBetQueue } = require('../queue/consumer');
const { In, Not, IsNull } = require('typeorm');
let lodash = require("lodash");
const { getUserBalanceDataByUserId, updateUserExposure } = require('../services/userBalanceService');
const { sendMessageToUser } = require('../sockets/socketManager');
const { getCardMatch } = require('../services/cardMatchService');
const { CardProfitLoss } = require('../services/cardService/cardProfitLossCalc');
const { getMatchData } = require('../services/matchService');

exports.getBet = async (req, res) => {
  try {
    const reqUser = req.user;
    let { isCurrentBets, ...query } = req.query;
    let where = {};
    let result;
    
    let select = [
      "betPlaced.id", "betPlaced.teamName", "betPlaced.eventName", "betPlaced.betType", "betPlaced.amount", "betPlaced.rate", "betPlaced.winAmount", "betPlaced.lossAmount", "betPlaced.createdAt", "betPlaced.eventType", "betPlaced.marketType", "betPlaced.odds", "betPlaced.marketBetType", "betPlaced.result", "match.title", "match.startAt", "betPlaced.deleteReason", "betPlaced.ipAddress", "betPlaced.browserDetail", "betPlaced.bettingName", "match.id"
    ];

    if (isCurrentBets) {
      select.push("racingMatch.title", "racingMatch.startAt", "racingMatch.id")
    }

    if (query.status && query.status == "MATCHED") {
      where.result = In([betResultStatus.LOSS, betResultStatus.TIE, betResultStatus.WIN]);
      query = lodash.omit(query, ['status']);
    }
    else if (query.status && query.status == betResultStatus.PENDING) {
      where.result = betResultStatus.PENDING;
      query = lodash.omit(query, ['status']);
    }
    else if (query.status && query.status == "DELETED") {
      where.deleteReason = Not(IsNull());
      where.result = betResultStatus.UNDECLARE;
      query = lodash.omit(query, ['status']);
    } else {
      query = lodash.omit(query, ['status']);
    }

    if (reqUser.roleName == userRoleConstant.user) {
      where.createBy = reqUser.id;
      result = await betPlacedService.getBet(where, query, reqUser.roleName, select, null, true, isCurrentBets);
    } else {
      let childsId = await userService.getChildsWithOnlyUserRole(reqUser.id);
      childsId = childsId.map(item => item.id);
      if (!childsId.length) {
        return SuccessResponse({
          statusCode: 200, message: { msg: "fetched", keys: { type: "Bet" } }, data: {
            count: 0,
            rows: []
          }
        }, req, res)
      }
      let partnershitColumn = partnershipPrefixByRole[reqUser.roleName] + 'Partnership';
      select.push("user.id", "user.userName", `user.${partnershitColumn}`);
      where.createBy = In(childsId);
      result = await betPlacedService.getBet(where, query, reqUser.roleName, select, null, true, isCurrentBets);
    }
    if (!result[1]) return SuccessResponse({
      statusCode: 200, message: { msg: "fetched", keys: { type: "Bet" } }, data: {
        count: 0,
        rows: []
      }
    }, req, res);

    return SuccessResponse({
      statusCode: 200, message: { msg: "fetched", keys: { type: "Bet" } }, data: {
        count: result[1],
        rows: result[0]
      }
    }, req, res)
  } catch (err) {
    return ErrorResponse(err, req, res)
  }

};

exports.getAccountStatementBet = async (req, res) => {
  try {
    let { query, user: reqUser } = req;
    let where = {};
    let result;
    
    let select = [
      "betPlaced.id","betPlaced.ipAddress","betPlaced.browserDetail", "betPlaced.teamName", "betPlaced.eventName", "betPlaced.betType", "betPlaced.amount", "betPlaced.rate", "betPlaced.winAmount", "betPlaced.lossAmount", "betPlaced.createdAt", "betPlaced.eventType", "betPlaced.marketType", "betPlaced.odds", "betPlaced.marketBetType", "betPlaced.result", "match.title", "match.startAt", "betPlaced.deleteReason", "betPlaced.bettingName", "match.id", "racingMatch.title", "racingMatch.startAt", "racingMatch.id", "user.userName", "createBy.userName","user.id"
    ];

    if (query.status && query.status == "MATCHED") {
      where.result = In([betResultStatus.LOSS, betResultStatus.TIE, betResultStatus.WIN]);
      query = lodash.omit(query, ['status']);
    }
    else if (query.status && query.status == betResultStatus.PENDING) {
      where.result = betResultStatus.PENDING;
      query = lodash.omit(query, ['status']);
    }
    else if (query.status && query.status == "DELETED") {
      where.deleteReason = Not(IsNull());
      where.result = betResultStatus.UNDECLARE;
      query = lodash.omit(query, ['status']);
    } else {
      query = lodash.omit(query, ['status']);
    }

    result = await betPlacedService.getAccountStatBet(where, query, select);

    return SuccessResponse({
      statusCode: 200, message: { msg: "fetched", keys: { type: "Bet" } }, data: {
        count: result?.count,
        rows: result?.data,
        totalCount: result?.totalAmountData
      }
    }, req, res)
  } catch (err) {
    return ErrorResponse(err, req, res)
  }

};

exports.getSessionProfitLoss = async (req, res) => {
  try {
    const { id: userId } = req.user;
    const { betId } = req.params;

    const sessionProfitLoss = await getUserRedisKey(
      userId,
      betId + redisKeys.profitLoss
    );

    return SuccessResponse(
      {
        statusCode: 200,
        message: { msg: "fetched", keys: { type: "Session profit loss" } },
        data: {
          profitLoss: sessionProfitLoss,
        },
      },
      req,
      res
    );
  } catch (err) {
    return ErrorResponse(err, req, res);
  }
};

exports.matchBettingBetPlaced = async (req, res) => {
  try {
    logger.info({
      info: `match betting bet placed`,
      data: req.body
    });
    let reqUser = req.user;
    let { teamA, teamB, teamC, stake, odd, betId, bettingType, matchBetType, matchId, betOnTeam, ipAddress, browserDetail, placeIndex, bettingName, mid, selectionId } = req.body;

    let userBalanceData = await userService.getUserWithUserBalanceData({ userId: reqUser.id });
    let user = userBalanceData?.user;
    if (!user) {
      logger.info({
        info: `user not found for login id ${reqUser.id}`,
        data: req.body
      });
      return ErrorResponse({ statusCode: 403, message: { msg: "notFound", keys: { name: "User" } } }, req, res);
    }
    if (user.userBlock) {
      logger.info({
        info: `user is blocked for login id ${reqUser.id}`,
        data: req.body
      });
      return ErrorResponse({ statusCode: 403, message: { msg: "user.blocked" } }, req, res);
    }
    if (user.betBlock) {
      logger.info({
        info: `user is blocked for betting id ${reqUser.id}`,
        data: req.body
      })
      return ErrorResponse({ statusCode: 403, message: { msg: "user.betBlockError" } }, req, res);
    }
    let getMatchLockData = await userService.getUserMatchLock({ matchId: matchId, userId: reqUser.id, matchLock: true });
    if (getMatchLockData?.matchLock) {
      logger.info({
        info: `user is blocked for the match ${reqUser.id}, matchId ${matchId}, betId ${betId}`,
        data: req.body
      })
      return ErrorResponse({ statusCode: 403, message: { msg: "user.matchLock" } }, req, res);
    }
    let newCalculateOdd = odd;
    let winAmount = 0, lossAmount = 0;
    if ([matchBettingType.matchOdd, matchBettingType.tiedMatch1, matchBettingType.completeMatch]?.includes(matchBetType)) {
      newCalculateOdd = (newCalculateOdd - 1) * 100;
    }
    else if ([matchBettingType.tiedMatch3]?.includes(matchBetType)) {
      newCalculateOdd = (newCalculateOdd) * 100;
    }
    if ([matchBettingType.matchOdd, matchBettingType.tiedMatch1, matchBettingType.tiedMatch3, matchBettingType.completeMatch]?.includes(matchBetType) && newCalculateOdd > 400) {
      return ErrorResponse({ statusCode: 403, message: { msg: "bet.oddNotAllow", keys: { gameType: "cricket" } } }, req, res);
    }

    if (bettingType == betType.BACK) {
      winAmount = (stake * newCalculateOdd) / 100;
      lossAmount = stake;
    }
    else if (bettingType == betType.LAY) {
      winAmount = stake;
      lossAmount = (stake * newCalculateOdd) / 100;
    }
    else {
      logger.info({
        info: `Get invalid betting type`,
        data: req.body
      });
      return ErrorResponse({ statusCode: 400, message: { msg: "invalid", keys: { name: "Bet type" } } }, req, res);
    }

    winAmount = Number(winAmount.toFixed(2));
    lossAmount = Number(lossAmount.toFixed(2));

    //fetched match details from expert
    let apiResponse = {};

    try {
      let url = expertDomain + allApiRoutes.MATCHES.MatchBettingDetail + matchId + "/?type=" + matchBetType;
      apiResponse = await apiCall(apiMethod.get, url);
    } catch (error) {
      logger.info({
        info: `Error at get match details.`,
        data: req.body
      });
      throw error?.response?.data;
    }
    let { match, matchBetting } = apiResponse.data;
    matchBetting.eventId = match?.eventId;
    if (match.matchType != gameType.cricket) {
      return ErrorResponse({ statusCode: 400, message: { msg: "bet.validGameType" } }, req, res);
    }

    if (match?.stopAt) {
      return ErrorResponse({ statusCode: 403, message: { msg: "bet.matchNotLive" } }, req, res);
    }

    let betPlacedObj = {
      matchId: matchId,
      betId: betId,
      winAmount,
      lossAmount,
      result: betResultStatus.PENDING,
      teamName: betOnTeam,
      amount: stake,
      odds: odd,
      betType: bettingType,
      rate: 0,
      createBy: reqUser.id,
      marketType: matchBetType,
      marketBetType: marketBetType.MATCHBETTING,
      ipAddress: ipAddress || req.ip || req.connection.remoteAddress,
      browserDetail: browserDetail || req.headers['user-agent'],
      eventName: match.title,
      eventType: match.matchType,
      bettingName: bettingName
    }
    await validateMatchBettingDetails(matchBetting, { ...betPlacedObj, mid, selectionId }, { teamA, teamB, teamC, placeIndex });

    const { teamArateRedisKey, teamBrateRedisKey, teamCrateRedisKey } = getRedisKeys(matchBetType, matchId, redisKeys, betId);

    let userCurrentBalance = userBalanceData.currentBalance;
    let userRedisData = await getUserRedisData(reqUser.id);
    let matchExposure = userRedisData[redisKeys.userMatchExposure + matchId] ? parseFloat(userRedisData[redisKeys.userMatchExposure + matchId]) : 0.0;
    let oldMatchExposure = userRedisData[redisKeys.userMatchExposure + matchId] ? parseFloat(userRedisData[redisKeys.userMatchExposure + matchId]) : 0.0;
    let sessionExposure = userRedisData[redisKeys.userSessionExposure + matchId] ? parseFloat(userRedisData[redisKeys.userSessionExposure + matchId]) : 0.0;
    let userTotalExposure = matchExposure + sessionExposure;

    let teamRates = {
      teamA: parseRedisData(teamArateRedisKey, userRedisData),
      teamB: parseRedisData(teamBrateRedisKey, userRedisData),
      teamC: teamCrateRedisKey ? parseRedisData(teamCrateRedisKey, userRedisData) : 0.0
    };


    let userPreviousExposure = parseFloat(userRedisData[redisKeys.userAllExposure]) || 0.0;
    let userOtherMatchExposure = userPreviousExposure - userTotalExposure;
    let userExposureLimit = parseFloat(user.exposureLimit);

    logger.info({
      info: `User's match and session exposure and teams rate in redis with userId ${reqUser.id} `,
      userCurrentBalance,
      matchExposure,
      sessionExposure,
      userTotalExposure,
      teamRates,
      userPreviousExposure,
      userOtherMatchExposure
    });

    let newTeamRateData = await calculateRate(teamRates, { teamA, teamB, teamC, winAmount, lossAmount, bettingType, betOnTeam }, 100);
    let maximumLoss = 0;
    if (teamC && teamC != '') {
      maximumLoss = Math.min(newTeamRateData.teamA, newTeamRateData.teamB, newTeamRateData.teamC);
    } else {
      maximumLoss = Math.min(newTeamRateData.teamA, newTeamRateData.teamB);
    }
    if (maximumLoss > 0) {
      maximumLoss = 0;
    }
    let newUserExposure = calculateUserExposure(userPreviousExposure, teamRates, newTeamRateData, teamC);
    if (newUserExposure > userExposureLimit) {
      logger.info({
        info: `User exceeded the limit of total exposure for a day`,
        user_id: reqUser.id,
        newUserExposure,
        userExposureLimit
      })
      return ErrorResponse({ statusCode: 400, message: { msg: "user.ExposureLimitExceed" } }, req, res);
    }
    matchExposure = Math.abs(maximumLoss);
    userCurrentBalance = userCurrentBalance - (newUserExposure);
    if (userCurrentBalance < 0) {
      logger.info({
        info: `user exposure balance insufficient to place this bet user id is ${reqUser.id}`,
        betId,
        matchId,
        userCurrentBalance,
        maximumLoss,
        newUserExposure
      })
      return ErrorResponse({ statusCode: 400, message: { msg: "userBalance.insufficientBalance" } }, req, res);
    }
    logger.info({
      info: `updating user exposure balance in redis for user id is ${reqUser.id}`,
      betId,
      matchId,
      userCurrentBalance,
      matchExposure, maximumLoss
    });

    // await updateMatchExposure(reqUser.id, matchId, matchExposure);
    let newBet = await betPlacedService.addNewBet(betPlacedObj);
    let jobData = {
      userId: reqUser.id,
      teamA, teamB, teamC, stake, odd, betId, bettingType, matchBetType, matchId, betOnTeam,
      winAmount,
      lossAmount, newUserExposure,
      userPreviousExposure,
      userCurrentBalance, teamArateRedisKey, teamBrateRedisKey, teamCrateRedisKey, newTeamRateData,
      newBet,
      userName: user.userName,
      matchExposure: matchExposure
    }

    const domainUrl = `${req.protocol}://${req.get('host')}`;

    let walletJobData = {
      domainUrl: domainUrl,
      partnerships: userRedisData.partnerShips,
      userId: reqUser.id,
      stake: jobData.stake,
      userUpdatedExposure: Math.abs(parseFloat(newUserExposure) - parseFloat(userPreviousExposure)),
      newUserExposure, userPreviousExposure,
      winAmount, lossAmount, teamRates,
      bettingType, betOnTeam, teamA, teamB, teamC, teamArateRedisKey, teamBrateRedisKey, teamCrateRedisKey, newBet,
      userName: user.userName
    }
    //add redis queue function
    const job = MatchBetQueue.createJob(jobData);
    await job.save().then(data => {
      logger.info({
        info: `add match betting job save in the redis for user ${reqUser.id}`,
        matchId, jobData
      });
    }).catch(error => {
      logger.error({
        error: `Error at match betting job save in the redis for user ${reqUser.id}.`,
        stack: error.stack,
        message: error.message,
        errorFile: error
      });
      betPlacedService.deleteBetByEntityOnError(newBet);
      throw error;
    });

    const walletJob = WalletMatchBetQueue.createJob(walletJobData);
    await walletJob.save().then(data => {
      logger.info({
        info: `add match betting job save in the redis for wallet ${reqUser.id}`,
        matchId, walletJobData
      });
    }).catch(error => {
      logger.error({
        error: `Error at match betting job save in the redis for wallet ${reqUser.id}.`,
        stack: error.stack,
        message: error.message,
        errorFile: error
      });
    });

    const expertJob = ExpertMatchBetQueue.createJob(walletJobData);
    await expertJob.save().then(data => {
      logger.info({
        info: `add match betting job save in the redis for expert ${reqUser.id}`,
        matchId, walletJobData
      });
    }).catch(error => {
      logger.error({
        error: `Error at match betting job save in the redis for expert ${reqUser.id}.`,
        stack: error.stack,
        message: error.message,
        errorFile: error
      });
      betPlacedService.deleteBetByEntityOnError(newBet);
      throw error;
    });
    return SuccessResponse({ statusCode: 200, message: { msg: "betPlaced" }, data: newBet }, req, res)


  } catch (error) {
    logger.error({
      error: `Error at match betting bet placed.`,
      stack: error.stack,
      message: error.message,
    });
    return ErrorResponse(error, req, res)
  }
}

/**
 * Handle the user's session bet placement.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @param {Function} next - Express next function.
 */
exports.sessionBetPlace = async (req, res, next) => {
  try {
    // Destructure relevant data from the request body and user object
    const {
      betId,
      betType: sessionBetType,
      browserDetail,
      eventName,
      eventType,
      matchId,
      ipAddress,
      odds,
      ratePercent,
      stake,
      teamName,
      mid,
      betPlaceIndex
    } = req.body;
    const { id } = req.user;

    // Fetch user details by ID
    let user = await getUserById(id, ["userBlock", "betBlock", "userName", "exposureLimit"]);

    if (!user) {
      logger.info({
        info: `user not found for login id ${id}`,
        data: req.body
      });
      return ErrorResponse({ statusCode: 403, message: { msg: "notFound", keys: { name: "User" } } }, req, res);
    }

    let userExposureLimit = parseFloat(user.exposureLimit);
    logger.info({
      info: `Bet placed for session matchId ${matchId}, betId ${betId}, userId ${id}`,
      data: req.body
    });
    // Check if the user is blocked
    if (user.userBlock) {
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

    // Check if the user is blocked from placing bets
    if (user.betBlock) {
      return ErrorResponse(
        {
          statusCode: 403,
          message: {
            msg: "user.betBlockError",
          },
        },
        req,
        res
      );
    }
    let getMatchLockData = await userService.getUserMatchLock({ matchId: matchId, userId: id, sessionLock: true });
    if (getMatchLockData?.sessionLock) {
      logger.info({
        info: `user is blocked for the session ${id}, matchId ${matchId}, betId ${betId}`,
        data: req.body
      });
      return ErrorResponse({ statusCode: 403, message: { msg: "user.matchLock" } }, req, res);
    }
    const matchDetail = await getMatchData({ id: matchId }, ["id", "eventId"]);

    let sessionDetails;

    try {
      // Make an API call to fetch session details for the specified match
      let response = await apiCall(
        apiMethod.get,
        expertDomain + allApiRoutes.MATCHES.sessionDetail + matchId,
        null,
        null,
        {
          id: betId,
        }
      );

      // Extract session details from the API response
      sessionDetails = response?.data;
      sessionDetails.eventId = matchDetail.eventId;
    } catch (err) {
      // Handle API call error and return an error response
      return ErrorResponse(err?.response?.data, req, res);
    }

    await validateSessionBet(sessionDetails, req.body);

    let winAmount = 0,
      loseAmount = 0;

    if (sessionDetails?.type == sessionBettingType.fancy1) {

      if (sessionBetType == betType.BACK) {
        winAmount = parseFloat((stake * (odds - 1))).toFixed(2);
        loseAmount = parseFloat(stake);
      } else if (sessionBetType == betType.LAY) {
        winAmount = parseFloat(stake);
        loseAmount = parseFloat((stake * (odds - 1))).toFixed(2);
      }
      else {
        // Return an error response for an invalid bet type
        return ErrorResponse(
          {
            statusCode: 400,
            message: {
              msg: "invalid",
              keys: {
                name: "Bet type",
              },
            },
          },
          req,
          res
        );
      }
    }
    else if ([sessionBettingType.oddEven, sessionBettingType.cricketCasino].includes(sessionDetails?.type)) {
      if (sessionBetType == betType.BACK) {
        winAmount = parseFloat((stake * (odds - 1))).toFixed(2);
        loseAmount = parseFloat(stake);
      } else if (sessionBetType == betType.LAY) {
        winAmount = parseFloat(stake);
        loseAmount = parseFloat((stake * (odds - 1))).toFixed(2);
      }
      else {
        // Return an error response for an invalid bet type
        return ErrorResponse(
          {
            statusCode: 400,
            message: {
              msg: "invalid",
              keys: {
                name: "Bet type",
              },
            },
          },
          req,
          res
        );
      }
    }
    else {
      // Calculate win and lose amounts based on the bet type
      if (sessionBetType == betType.YES) {
        winAmount = parseFloat((stake * ratePercent) / 100).toFixed(2);
        loseAmount = parseFloat(stake);
      } else if (sessionBetType == betType.NO) {
        winAmount = parseFloat(stake);
        loseAmount = parseFloat((stake * ratePercent) / 100).toFixed(2);
      } else {
        // Return an error response for an invalid bet type
        return ErrorResponse(
          {
            statusCode: 400,
            message: {
              msg: "invalid",
              keys: {
                name: "Bet type",
              },
            },
          },
          req,
          res
        );
      }
    }

    const userData = await getUserRedisData(id);

    let sessionExp = parseFloat(userData[`${redisKeys.userSessionExposure}${matchId}`]) || 0.0;


    logger.info({
      message: "Session exposure coming from redis.",
      sessionExp
    });


    let betPlaceObject = {
      winAmount: parseFloat(winAmount),
      lossAmount: parseFloat(loseAmount),
      betPlacedData: {
        userName: user.userName,
        odds: parseFloat(odds),
        betType: sessionBetType,
        stake: parseFloat(stake),
        matchId: matchId,
        betId: betId,
        rate: parseFloat(ratePercent),
        teamName: teamName
      },
      userBalance: parseFloat(userData?.currentBalance) || 0,
    };

    let totalExposure = parseFloat(userData?.exposure) || 0;

    logger.info({
      message: "Exposure and balance of user before calculation: ",
      userBalance: userData?.currentBalance || 0,
      totalExposure: userData?.exposure || 0,
    });

    let sessionProfitLossData = userData[`${betId}_profitLoss`];
    let maxSessionLoss = 0.0;
    if (sessionProfitLossData) {
      sessionProfitLossData = JSON.parse(sessionProfitLossData);
      maxSessionLoss = parseFloat(sessionProfitLossData["maxLoss"]);
    }

    let redisData;

    switch (sessionDetails?.type) {
      case sessionBettingType.session:
      case sessionBettingType.overByOver:
      case sessionBettingType.ballByBall:
        redisData = await calculateProfitLossSession(
          sessionProfitLossData,
          betPlaceObject
        );
        break;
      case sessionBettingType.oddEven:
        redisData = await calculateProfitLossSessionOddEven(sessionProfitLossData, betPlaceObject);
        break;
      case sessionBettingType.cricketCasino:
        redisData = await calculateProfitLossSessionCasinoCricket(sessionProfitLossData, betPlaceObject);
        break;
      case sessionBettingType.fancy1:
        redisData = await calculateProfitLossSessionFancy1(sessionProfitLossData, betPlaceObject);
        break;
      default:
        break;
    }


    betPlaceObject.maxLoss = Math.abs(redisData.maxLoss - maxSessionLoss);
    let redisSessionExp = Number(
      (sessionExp + redisData?.maxLoss - maxSessionLoss).toFixed(2)
    );

    totalExposure = parseFloat(parseFloat(totalExposure + redisData.maxLoss - maxSessionLoss).toFixed(2));

    if (totalExposure > userExposureLimit) {
      logger.info({
        info: `User exceeded the limit of total exposure for a day`,
        totalExposure,
        userExposureLimit
      })
      return ErrorResponse({ statusCode: 400, message: { msg: "user.ExposureLimitExceed" } }, req, res);
    }
    let redisObject = {
      [`${redisKeys.userSessionExposure}${matchId}`]: redisSessionExp,
      [`${betId}_profitLoss`]: JSON.stringify(redisData)
    };

    let newBalance =
      parseFloat(userData?.currentBalance).toFixed(2) - totalExposure;

    betPlaceObject.diffSessionExp = redisData.maxLoss - maxSessionLoss;

    if (newBalance < 0) {
      logger.info({
        info: `user exposure balance insufficient to place this bet user id is ${id}`,
        betId,
        matchId,
        userCurrentBalance: userData?.currentBalance,
        exposure: betPlaceObject.diffSessionExp
      });
      return ErrorResponse(
        {
          statusCode: 400,
          message: {
            msg: "userBalance.insufficientBalance",
          },
        },
        req,
        res
      );
    }

    const placedBet = await betPlacedService.addNewBet({
      result: betResultStatus.PENDING,
      matchId: matchId,
      betId: betId,
      amount: stake,
      odds: odds,
      winAmount: winAmount,
      lossAmount: loseAmount,
      betType: sessionBetType,
      rate: ratePercent,
      teamName: `${sessionDetails?.name} ${sessionDetails?.type == sessionBettingType.fancy1 ? "" : [sessionBettingType.oddEven, sessionBettingType.cricketCasino]?.includes(sessionDetails?.type) ? `-${teamName?.toUpperCase()}` : `/ ${ratePercent}`}`,
      marketType: sessionDetails?.type,
      marketBetType: marketBetType.SESSION,
      ipAddress: ipAddress || req.ip || req.connection.remoteAddress,
      browserDetail: browserDetail || req.headers['user-agent'],
      eventName: eventName,
      eventType: eventType,
      userId: id,
      createBy: id,
    });

    let jobData = {
      userId: id,
      placedBet: placedBet,
      newBalance: newBalance,
      betPlaceObject: betPlaceObject,
      redisObject: redisObject
    }
    //add redis queue function
    const job = SessionMatchBetQueue.createJob(jobData);
    await job.save().then(data => {
      logger.info({
        info: `add session betting job save in the redis for user ${id}`,
        matchId, jobData
      });
    }).catch(error => {
      logger.error({
        error: `Error at session betting job save in the redis for user ${id}.`,
        stack: error.stack,
        message: error.message,
        errorFile: error
      });
      betPlacedService.deleteBetByEntityOnError(placedBet);
      throw error;
    });


    const domainUrl = `${req.protocol}://${req.get('host')}`;

    let walletJobData = {
      userId: id,
      partnership: userData?.partnerShips,
      placedBet: placedBet,
      newBalance: newBalance,
      userUpdatedExposure: parseFloat(parseFloat(betPlaceObject.maxLoss).toFixed(2)),
      betPlaceObject: betPlaceObject,
      domainUrl: domainUrl
    };
    const walletJob = WalletSessionBetQueue.createJob(walletJobData);
    await walletJob.save().then(data => {
      logger.info({
        info: `add session betting job save in the redis for wallet ${id}`,
        matchId, walletJobData
      });
    }).catch(error => {
      logger.error({
        error: `Error at session betting job save in the redis for walllet ${id}.`,
        stack: error.stack,
        message: error.message,
        errorFile: error
      });
    });

    let expertJobData = {
      userId: id,
      partnership: userData?.partnerShips,
      placedBet: placedBet,
      newBalance: newBalance,
      betPlaceObject: betPlaceObject,
      domainUrl: domainUrl
    };
    const expertJob = ExpertSessionBetQueue.createJob(expertJobData);
    await expertJob.save().then(data => {
      logger.info({
        info: `add session betting job save in the redis for expert ${id}`,
        matchId, expertJobData
      });
    }).catch(error => {
      logger.error({
        error: `Error at session betting job save in the redis for expert ${id}.`,
        stack: error.stack,
        message: error.message,
        errorFile: error
      });
    });


    return SuccessResponse({ statusCode: 200, message: { msg: "betPlaced" }, data: placedBet }, req, res)

  } catch (error) {
    // Log the error details
    logger.error({
      error: `Error at session bet place for the user.`,
      stack: error.stack,
      message: error.message,
    });

    // Handle any errors and return an error response
    return ErrorResponse(error, req, res);
  }
};

const validateSessionBet = async (apiBetData, betDetails) => {
  if (apiBetData?.stopAt) {
    return ErrorResponse({ statusCode: 403, message: { msg: "bet.matchNotLive" } }, req, res);
  }
  if (apiBetData.activeStatus != betStatusType.live) {
    throw {
      message: {
        msg: "bet.notLive"
      }
    };
  }

  if (betDetails.stake < apiBetData.minBet) {
    throw {
      statusCode: 400,
      message: {
        msg: "bet.minAmountViolate"
      }
    };
  }
  if (betDetails.stake > apiBetData.maxBet) {
    throw {
      statusCode: 400,
      message: {
        msg: "bet.maxAmountViolate"
      }
    };
  }
  if (apiBetData?.selectionId && apiBetData?.selectionId != "") {

    if (!apiBetData.apiSessionActive) {
      throw {
        statusCode: 400,
        message: {
          msg: "bet.notLive",
        },
      };
    } else {
      const rateChange = await checkApiSessionRates(apiBetData, betDetails);
      if (rateChange) {
        throw {
          statusCode: 400,
          message: {
            msg: "bet.marketRateChanged",
            keys: {
              marketType: "Session rate or %",
            },
          },
        };
      }
    }
  }
  else {
    if (!apiBetData.manualSessionActive) {
      throw {
        statusCode: 400,
        message: {
          msg: "bet.notLive"
        }
      };
    }
    if (
      (betDetails.betType == betType.NO && (betDetails.odds != apiBetData.noRate || betDetails.ratePercent != apiBetData.noPercent)) ||
      (betDetails.betType == betType.YES && (betDetails.odds != apiBetData.yesRate || betDetails.ratePercent != apiBetData.yesPercent)) ||
      (apiBetData.status != null && apiBetData.status != teamStatus.active)
    ) {
      throw {
        statusCode: 400,
        message: {
          msg: "bet.marketRateChanged",
          keys: {
            marketType: "Session rate or %",
          },
        },
      };
    }
  }
}

const checkApiSessionRates = async (apiBetData, betDetail) => {
  const microServiceUrl = process.env.MICROSERVICEURL;
  try {
    let data = await apiCall(
      apiMethod.get,
      microServiceUrl + allApiRoutes.MICROSERVICE.getAllRateCricket + apiBetData.eventId
    ).catch(error => {
      logger.error({
        error: `Error at session bet check validate with third party url api hit.`,
        stack: error.stack,
        message: error.message,
      });
      throw error
    });
    const sessionDetail = data?.data?.find(
      (d) => d.mid?.toString() == betDetail.mid?.toString()
    );
    let filterData;
    if (sessionDetail?.gtype == "cricketcasino") {
      filterData = sessionDetail?.section?.find((item) => item?.sid?.toString() == (parseInt(betDetail?.teamName?.split(" ")?.[0]) + 1)?.toString());
    }
    else {
      filterData = sessionDetail?.section?.find((item) => item?.sid?.toString() == apiBetData?.selectionId?.toString());
    }
    if (filterData?.gstatus != "" && filterData?.gstatus != "OPEN") {
      return true;
    }

    if (sessionDetail?.mname == "oddeven") {
      if (
        (betDetail.teamName == "even") && (betDetail.odds != filterData?.odds?.find((item) => item?.tno == betDetail?.betPlaceIndex && item?.otype == "lay")?.odds)
      ) {
        return true;
      } else if (
        betDetail.teamName == "odd" && (betDetail.odds != filterData?.odds?.find((item) => item?.tno == betDetail?.betPlaceIndex && item?.otype == "back")?.odds)
      ) {
        return true;
      }
      return false;

    }
    else if (sessionDetail?.gtype == "cricketcasino") {
      if (
        (betDetail.betType == betType.BACK) && (betDetail.odds != filterData?.odds?.find((item) => item?.tno == betDetail?.betPlaceIndex && item?.otype == "back")?.odds)
      ) {
        return true;
      }
      return false;
    }
    else if (sessionDetail?.mname == "fancy1") {
      if (
        (betDetail.betType == betType.LAY) && (betDetail.odds != filterData?.odds?.find((item) => item?.tno == betDetail?.betPlaceIndex && item?.otype == "lay")?.odds)
      ) {
        return true;
      } else if (
        betDetail.betType == betType.BACK && (betDetail.odds != filterData?.odds?.find((item) => item?.tno == betDetail?.betPlaceIndex && item?.otype == "back")?.odds)
      ) {
        return true;
      }
      return false;

    }
    else {

      if (
        (betDetail.betType == betType.NO) && (betDetail.odds != filterData?.odds?.find((item) => item?.tno == betDetail?.betPlaceIndex && item?.otype == "lay")?.odds || betDetail.ratePercent != filterData?.odds?.find((item) => item?.tno == betDetail?.betPlaceIndex && item?.otype == "lay")?.size)
      ) {
        return true;
      } else if (
        betDetail.betType == betType.YES && (betDetail.odds != filterData?.odds?.find((item) => item?.tno == betDetail?.betPlaceIndex && item?.otype == "back")?.odds || betDetail.ratePercent != filterData?.odds?.find((item) => item?.tno == betDetail?.betPlaceIndex && item?.otype == "back")?.size)
      ) {
        return true;
      }
      return false;
    }
  } catch (error) {
    return true;
  }
  // check the rates of third party api
};

const validateMatchBettingDetails = async (matchBettingDetail, betObj, teams) => {
  if (matchBettingDetail?.activeStatus != betStatusType.live) {
    throw {
      statusCode: 400,
      message: {
        msg: "bet.notLive"
      }
    };
  }
  else if (betObj.amount < matchBettingDetail?.minBet) {
    throw {
      statusCode: 400,
      message: {
        msg: "bet.minAmountViolate"
      }
    };
  }
  else if (betObj.amount > matchBettingDetail?.maxBet) {
    throw {
      statusCode: 400,
      message: {
        msg: "bet.maxAmountViolate"
      }
    };
  }
  else {
    let isRateChange = false;
    let manualBets = Object.values(manualMatchBettingType);
    if (manualBets.includes(matchBettingDetail?.type)) {
      isRateChange = await checkRate(matchBettingDetail, betObj, teams);
    } else {
      isRateChange = await CheckThirdPartyRate(matchBettingDetail, betObj, teams);
    }
    if (isRateChange) {
      throw {
        statusCode: 400,
        message: {
          msg: "bet.marketRateChanged",
          keys: {
            marketType: "Match betting",
          },
        },
      };
    }
  }

}

const checkRate = async (bettingDetail, betObj, teams) => {
  const matchBettingDetail = JSON.parse(JSON.stringify(bettingDetail));
  if (teams.placeIndex != 0) {
    matchBettingDetail.backTeamA = parseInt(matchBettingDetail.backTeamA);
    matchBettingDetail.backTeamB = parseInt(matchBettingDetail.backTeamB);
    matchBettingDetail.backTeamC = parseInt(matchBettingDetail.backTeamC);
    matchBettingDetail.layTeamA = parseInt(matchBettingDetail.layTeamA);
    matchBettingDetail.layTeamB = parseInt(matchBettingDetail.layTeamB);
    matchBettingDetail.layTeamC = parseInt(matchBettingDetail.layTeamC);
  }
  if (betObj.betType == betType.BACK && teams.teamA == betObj.teamName && !(matchBettingDetail.statusTeamA == teamStatus.active && matchBettingDetail.backTeamA - teams.placeIndex == betObj.odds)) {
    return true;
  }
  else if (betObj.betType == betType.BACK && teams.teamB == betObj.teamName && !(matchBettingDetail.statusTeamB == teamStatus.active && matchBettingDetail.backTeamB - teams.placeIndex == betObj.odds)) {
    return true;
  }
  else if (betObj.betType == betType.BACK && teams.teamC == betObj.teamName && !(matchBettingDetail.statusTeamC == teamStatus.active && matchBettingDetail.backTeamC - teams.placeIndex == betObj.odds)) {
    return true;
  }
  else if (betObj.betType == betType.LAY && teams.teamA == betObj.teamName && !(matchBettingDetail.statusTeamA == teamStatus.active && +matchBettingDetail.layTeamA + teams.placeIndex == betObj.odds)) {
    return true;
  }
  else if (betObj.betType == betType.LAY && teams.teamB == betObj.teamName && !(matchBettingDetail.statusTeamB == teamStatus.active && +matchBettingDetail.layTeamB + teams.placeIndex == betObj.odds)) {
    return true;
  }
  else if (betObj.betType == betType.LAY && teams.teamC == betObj.teamName && !(matchBettingDetail.statusTeamC == teamStatus.active && +matchBettingDetail.layTeamC + teams.placeIndex == betObj.odds)) {
    return true;
  }
  else {
    return false;
  }
}

const validateRacingBettingDetails = async (matchBettingDetail, betObj, placeIndex, selectionId) => {
  if (matchBettingDetail?.activeStatus != betStatusType.live) {
    throw {
      statusCode: 400,
      message: {
        msg: "bet.notLive"
      }
    };
  }
  else if (betObj.amount < matchBettingDetail?.minBet) {
    throw {
      statusCode: 400,
      message: {
        msg: "bet.minAmountViolate"
      }
    };
  }
  else if (betObj.amount > matchBettingDetail?.maxBet) {
    throw {
      statusCode: 400,
      message: {
        msg: "bet.maxAmountViolate"
      }
    };
  }
  
    let isRateChange = false;
    
  isRateChange = await checkThirdPartyRacingRate(matchBettingDetail, betObj, placeIndex, selectionId);
    
    if (isRateChange) {
      throw {
        statusCode: 400,
        message: {
          msg: "bet.marketRateChanged",
          keys: {
            marketType: "Match betting",
          },
        },
      };
    }
}

let checkThirdPartyRacingRate = async (matchBettingDetail, betObj, placeIndex, selectionId) => {
  let url = "";
  const microServiceUrl = microServiceDomain;
  try {
 
      url = microServiceUrl + allApiRoutes.MICROSERVICE.matchOdd + matchBettingDetail.marketId

    let data = await apiCall(apiMethod.get, url);
    if (data) {
      let currRunner = data?.find((item) => item?.selectionId == selectionId);
      if(!currRunner["ex"]){
        return true;
      }
      if (betObj.betType == betType.BACK && currRunner?.['ex']?.availableToBack?.[placeIndex]?.price != betObj.odds) {
        return true;
      } else if (betObj.betType == betType.LAY && currRunner?.['ex']?.availableToLay?.[placeIndex]?.price != betObj.odds) {
        return true;
      } else {
        return false;
      }
    } else {
      return true;
    }
  }
  catch (error) {
    throw {
      message: {
        msg: "bet.notLive"
      }
    };
  }
}

let calculateUserExposure = (userOldExposure, oldTeamRate, newTeamRate, teamC) => {

  let minAmountNewRate = 0;
  let minAmountOldRate = 0;
  if (teamC && teamC != '') {
    minAmountNewRate = Math.min(newTeamRate.teamA, newTeamRate.teamB, newTeamRate.teamC);
    minAmountOldRate = Math.min(oldTeamRate.teamA, oldTeamRate.teamB, oldTeamRate.teamC);
  }
  else {
    minAmountNewRate = Math.min(newTeamRate.teamA, newTeamRate.teamB);
    minAmountOldRate = Math.min(oldTeamRate.teamA, oldTeamRate.teamB);
  }
  if (minAmountNewRate > 0)
    minAmountNewRate = 0;
  if (minAmountOldRate > 0)
    minAmountOldRate = 0;
  let newExposure = userOldExposure - Math.abs(minAmountOldRate) + Math.abs(minAmountNewRate);
  return Number(newExposure.toFixed(2));
}

let calculateRacingUserExposure = (userOldExposure, oldTeamRate, newTeamRate) => {

  let minAmountNewRate =  Math.min(...Object.values(newTeamRate),0);
  let minAmountOldRate =  Math.min(...Object.values(oldTeamRate),0);

  let newExposure = userOldExposure - Math.abs(minAmountOldRate) + Math.abs(minAmountNewRate);
  return Number(newExposure.toFixed(2));
}

let CheckThirdPartyRate = async (matchBettingDetail, betObj, teams) => {
  let url = "";
  const microServiceUrl = microServiceDomain;
  try {
    
      url = microServiceUrl + allApiRoutes.MICROSERVICE.getAllRateCricket + matchBettingDetail.eventId

    
    let data = await apiCall(apiMethod.get, url);

    const matchBettingData = data?.data?.find(
      (d) => d.mid?.toString() == betObj.mid?.toString()
    );
    let filterData = matchBettingData?.section?.find((item) => item?.sid?.toString() == betObj?.selectionId?.toString());

    if (filterData) {
      if (filterData?.odds?.find((item) => item?.tno == teams?.placeIndex && item?.otype == betObj?.betType?.toLowerCase())?.odds != betObj?.odds) {
        return true;
      }
      return false;
    }
    return true;

  }
  catch (error) {
    throw {
      message: {
        msg: "bet.notLive"
      }
    };
  }
}

exports.deleteMultipleBet = async (req, res) => {
  try {
    const {
      matchId, data, deleteReason
    } = req.body;
    // const { id } = req.user;
    if (data?.length == 0) {
      return ErrorResponse(
        {
          statusCode: 400,
          message: {
            msg: "NoData",
          },
        },
        req,
        res
      );
    }
    let placedBetIdArray = [];
    data.forEach(obj => {
      placedBetIdArray.push(obj.placeBetId);
    });
    let placedBet = await betPlacedService.findAllPlacedBet({ matchId: matchId, id: In(placedBetIdArray) });
    let updateObj = {};
    let isAnyMatchBet = false;
    placedBet.forEach(bet => {
      let isSessionBet = false;
      if (bet.marketBetType == 'SESSION') {
        isSessionBet = true;
      } else {
        isAnyMatchBet = true;
      }
      if (!updateObj[bet.createBy]) {
        updateObj[bet.createBy] = { [bet.betId]: { isSessionBet: isSessionBet, array: [bet] } };
      } else {
        if (!updateObj[bet.createBy][bet.betId]) {
          updateObj[bet.createBy][bet.betId] = { isSessionBet: isSessionBet, array: [bet] };
        } else {
          updateObj[bet.createBy][bet.betId].array.push(bet);
        }
      }
    });
    let matchDetails;
    if (isAnyMatchBet) {
      let apiResponse = {};
      try {
        let url = expertDomain + allApiRoutes.MATCHES.MatchBettingDetail + matchId + "/?type=" + matchBettingType.quickbookmaker1;
        apiResponse = await apiCall(apiMethod.get, url);
      } catch (error) {
        logger.info({
          info: `Error at get match details for delete match bet.`,
          data: req.body
        });
        throw error?.response?.data;
      }
      let { match, matchBetting } = apiResponse.data;
      matchDetails = match;
    }
    const domainUrl = `${req.protocol}://${req.get('host')}`;
    if (Object.keys(updateObj).length > 0) {
      for (let key in updateObj) {
        let userId = key;
        let userDataDelete = updateObj[key];
        for (let value in userDataDelete) {
          let betId = value;
          let bet = userDataDelete[value];
          if (bet.isSessionBet) {
            await updateUserAtSession(userId, betId, matchId, bet.array, deleteReason, domainUrl);
          } else {
            await updateUserAtMatchOdds(userId, betId, matchId, bet.array, deleteReason, domainUrl, matchDetails);
          }
        };
      }
    }
    return SuccessResponse({ statusCode: 200, message: { msg: "updated" }, }, req, res);
  } catch (error) {
    logger.error({
      error: `Error at delete bet for the user.`,
      stack: error.stack,
      message: error.message,
    });
    return ErrorResponse(error, req, res);
  }
}

exports.deleteMultipleBetForOther = async (req, res) => {
  try {
    const {
      matchId, data, deleteReason
    } = req.body;
    // const { id } = req.user;
    if (data.length == 0) {
      return ErrorResponse(
        {
          statusCode: 400,
          message: {
            msg: "NoData",
          },
        },
        req,
        res
      );
    }
    let placedBetIdArray = [];
    data.map(obj => {
      placedBetIdArray.push(obj.placeBetId);
    });
    let placedBet = await betPlacedService.findAllPlacedBet({ matchId: matchId, id: In(placedBetIdArray) });

    let updateObj = {};
    placedBet.forEach(bet => {
      if (!updateObj[bet.createBy]) {
        updateObj[bet.createBy] = { [bet.betId]: { array: [bet] } };
      } else {
        if (!updateObj[bet.createBy][bet.betId]) {
          updateObj[bet.createBy][bet.betId] = { array: [bet] };
        } else {
          updateObj[bet.createBy][bet.betId].array.push(bet);
        }
      }
    });
    let matchDetails;
    let apiResponse = {};
    try {
      let url = expertDomain + allApiRoutes.MATCHES.MatchBettingDetail + matchId + "/?type=" + placedBet[0].marketType;
      apiResponse = await apiCall(apiMethod.get, url);
    } catch (error) {
      logger.info({
        info: `Error at get match details for delete match bet.`,
        data: req.body
      });
      throw error?.response?.data;
    }
    let { match } = apiResponse.data;
    matchDetails = match;

    const domainUrl = `${req.protocol}://${req.get('host')}`;
    if (Object.keys(updateObj).length > 0) {
      for (let key in updateObj) {
        let userId = key;
        let userDataDelete = updateObj[key];
        for (let value in userDataDelete) {
          let betId = value;
          let bet = userDataDelete[value];
          await updateUserAtMatchOddsForOther(userId, betId, matchId, bet.array, deleteReason, domainUrl, matchDetails);

        };
      }
    }
    return SuccessResponse({ statusCode: 200, message: { msg: "updated" }, }, req, res);
  } catch (error) {
    logger.error({
      error: `Error at delete bet for the user.`,
      stack: error.stack,
      message: error.message,
    });
    return ErrorResponse(error, req, res);
  }
}

const updateUserAtSession = async (userId, betId, matchId, bets, deleteReason, domainUrl) => {
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


    let placedBet = await betPlacedService.findAllPlacedBet({ matchId: matchId, betId: betId, createBy: userId, deleteReason: IsNull() });
    let userAllBetProfitLoss = await calculatePLAllBet(placedBet, placedBet?.[0]?.marketType, 100);
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
  let userDeleteProfitLoss = await calculatePLAllBet(bets, bets?.[0]?.marketType, 100, oldLowerLimitOdds, oldUpperLimitOdds);

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
    await userService.updateUser(userId, {
      autoBlock: true,
      userBlock: true,
      userBlockedBy: userCreatedBy?.createBy == userId ? userCreatedBy?.superParentId : userCreatedBy?.createBy
    });

    if (userCreatedBy?.createBy == userId) {
      await apiCall(
        apiMethod.post,
        walletDomain + allApiRoutes.WALLET.autoLockUnlockUser,
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
    await userService.updateUser(userId, {
      autoBlock: false,
      userBlock: false,
      userBlockedBy: null
    });

    if (userCreatedBy?.createBy == userId) {
      await apiCall(
        apiMethod.post,
        walletDomain + allApiRoutes.WALLET.autoLockUnlockUser,
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
      betPlacedId: betPlacedId
    });
  }

  await betPlacedService.updatePlaceBet({ matchId: matchId, id: In(betPlacedId) }, { deleteReason: deleteReason, result: betResultStatus.UNDECLARE });

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
                let partnershipData = (ob * partnership) / 100;
                parentPLbetPlaced[item] = parentPLbetPlaced[item] + partnershipData;
                if (newMaxLossParent < Math.abs(parentPLbetPlaced[item]) && parentPLbetPlaced[item] < 0) {
                  newMaxLossParent = Math.abs(parentPLbetPlaced[item]);
                }
              });
            }
            else {

              userDeleteProfitLoss.betData.forEach((ob, index) => {
                let partnershipData = (ob.profitLoss * partnership) / 100;
                if (ob.odds == parentPLbetPlaced[index].odds) {
                  parentPLbetPlaced[index].profitLoss = parseFloat(parentPLbetPlaced[index].profitLoss) + partnershipData;
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
              betPlacedId: betPlacedId
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
    sessionType: bets?.[0]?.marketType
  }
  const walletJob = walletSessionBetDeleteQueue.createJob(queueObject);
  await walletJob.save();

  const expertJob = expertSessionBetDeleteQueue.createJob(queueObject);
  await expertJob.save();

}

const updateUserAtMatchOdds = async (userId, betId, matchId, bets, deleteReason, domainUrl, matchDetails) => {
  let userRedisData = await getUserRedisData(userId);
  let isUserLogin = !!userRedisData;
  let userOldExposure = 0;
  let betPlacedId = bets.map(bet => bet.id);
  let partnershipObj = {};
  let socketSessionEvent = socketData.matchDeleteBet;
  let teamRates = {
    teamA: 0,
    teamB: 0,
    teamC: 0
  };
  let matchBetType = bets?.[0].marketType;
  let currUserBalance;


  const { teamArateRedisKey, teamBrateRedisKey, teamCrateRedisKey } = getRedisKeys(matchBetType, matchId, redisKeys, betId);

  let isTiedOrCompMatch = [matchBettingType.tiedMatch1, matchBettingType.tiedMatch3, matchBettingType.tiedMatch2, matchBettingType.completeMatch, matchBettingType.completeManual].includes(matchBetType);

  let teamA = isTiedOrCompMatch ? tiedManualTeamName.yes : matchDetails.teamA;
  let teamB = isTiedOrCompMatch ? tiedManualTeamName.no : matchDetails.teamB;
  let teamC = isTiedOrCompMatch ? null : matchDetails.teamC;

  if (isUserLogin) {
    userOldExposure = parseFloat(userRedisData.exposure);
    partnershipObj = JSON.parse(userRedisData.partnerShips);
    teamRates = {
      teamA: Number(userRedisData[teamArateRedisKey]) || 0.0,
      teamB: Number(userRedisData[teamBrateRedisKey]) || 0.0,
      teamC: teamCrateRedisKey ? Number(userRedisData[teamCrateRedisKey]) || 0.0 : 0.0
    };
    currUserBalance = parseFloat(userRedisData.currentBalance);
  } else {
    let user = await getUserById(userId);
    let partnership = await findUserPartnerShipObj(user);
    partnershipObj = JSON.parse(partnership);
    let userBalance = await getUserBalanceDataByUserId(userId);
    userOldExposure = userBalance.exposure;
    currUserBalance = parseFloat(userBalance.currentBalance);
    let redisData = await calculateProfitLossForMatchToResult([betId], userId, { teamA, teamB, teamC });
    teamRates = {
      teamA: !isTiedOrCompMatch ? redisData.teamARate : (matchBetType == matchBettingType.tiedMatch1 || matchBetType == matchBettingType.tiedMatch2|| matchBetType == matchBettingType.tiedMatch3) ? redisData.teamYesRateTie : redisData.teamYesRateComplete,
      teamB: !isTiedOrCompMatch ? redisData.teamBRate : (matchBetType == matchBettingType.tiedMatch1 || matchBetType == matchBettingType.tiedMatch2 || matchBetType == matchBettingType.tiedMatch3) ? redisData.teamNoRateTie : redisData.teamNoRateComplete,
      teamC: !isTiedOrCompMatch ? redisData.teamCRate : 0
    };
  }

  let maximumLossOld = 0;
  if (teamC && teamC != '') {
    maximumLossOld = Math.min(teamRates.teamA, teamRates.teamB, teamRates.teamC);
  } else {
    maximumLossOld = Math.min(teamRates.teamA, teamRates.teamB);
  }
  if (maximumLossOld > 0) {
    maximumLossOld = 0;
  }

  let newTeamRate = {
    teamA: 0,
    teamB: 0,
    teamC: 0
  };
  for (let index = 0; index < bets.length; index++) {
    let data = {
      teamA, teamB, teamC,
      winAmount: bets[index].winAmount,
      lossAmount: bets[index].lossAmount,
      bettingType: bets[index].betType,
      betOnTeam: bets[index].teamName
    }
    newTeamRate = await calculateRate(newTeamRate, data, 100);
  }

  // do not chagne any value in newTeamRate object this is using for parent calculation
  teamRates.teamA = teamRates.teamA - newTeamRate.teamA;
  teamRates.teamB = teamRates.teamB - newTeamRate.teamB;
  teamRates.teamC = teamRates.teamC - newTeamRate.teamC;

  teamRates.teamA = parseFloat((teamRates.teamA).toFixed(2));
  teamRates.teamB = parseFloat((teamRates.teamB).toFixed(2));
  teamRates.teamC = parseFloat((teamRates.teamC).toFixed(2));

  let maximumLoss = 0;
  if (teamC && teamC != '') {
    maximumLoss = Math.min(teamRates.teamA, teamRates.teamB, teamRates.teamC);
  } else {
    maximumLoss = Math.min(teamRates.teamA, teamRates.teamB);
  }
  if (maximumLoss > 0) {
    maximumLoss = 0;
  }
  maximumLoss = Math.abs(maximumLoss);
  maximumLossOld = Math.abs(maximumLossOld);

  let exposureDiff = maximumLossOld - maximumLoss;

  await updateUserExposure(userId, (-exposureDiff));

  // blocking user if its exposure would increase by current balance
  const userCreatedBy = await getUserById(userId, ["createBy", "userBlock", "autoBlock", "superParentId"]);

  if (userOldExposure - exposureDiff > currUserBalance && !userCreatedBy.userBlock) {
    await userService.updateUser(userId, {
      autoBlock: true,
      userBlock: true,
      userBlockedBy: userCreatedBy?.createBy == userId ? userCreatedBy.superParentId : userCreatedBy.createBy
    });

    if (userCreatedBy?.createBy == userId) {
      await apiCall(
        apiMethod.post,
        walletDomain + allApiRoutes.WALLET.autoLockUnlockUser,
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
    await userService.updateUser(userId, {
      autoBlock: false,
      userBlock: false,
      userBlockedBy: null
    });

    if (userCreatedBy?.createBy == userId) {
      await apiCall(
        apiMethod.post,
        walletDomain + allApiRoutes.WALLET.autoLockUnlockUser,
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
      [teamArateRedisKey]: teamRates.teamA,
      [teamBrateRedisKey]: teamRates.teamB,
      ...(teamCrateRedisKey ? { [teamCrateRedisKey]: teamRates.teamC } : {})
    }
    await incrementValuesRedis(userId, {
      [redisKeys.userMatchExposure + matchId]: -exposureDiff,
      [redisKeys.userAllExposure]: -exposureDiff
    }, redisObject);

    sendMessageToUser(userId, socketSessionEvent, {
      currentBalance: userRedisData?.currentBalance,
      exposure: userOldExposure - exposureDiff,
      ...teamRates,
      bets: bets,
      betId: betId,
      deleteReason: deleteReason,
      matchId: matchId,
      betPlacedId: betPlacedId,
      matchBetType,
      teamArateRedisKey: teamArateRedisKey,
      teamBrateRedisKey: teamBrateRedisKey,
      teamCrateRedisKey: teamCrateRedisKey,
      redisObject
    });
  }
  await betPlacedService.updatePlaceBet({ matchId: matchId, id: In(betPlacedId) }, { deleteReason: deleteReason, result: betResultStatus.UNDECLARE });

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

            let masterTeamRates = {
              teamA: Number(masterRedisData[teamArateRedisKey]) || 0,
              teamB: Number(masterRedisData[teamBrateRedisKey]) || 0,
              teamC: teamCrateRedisKey ? Number(masterRedisData[teamCrateRedisKey]) || 0 : 0
            };
            masterTeamRates.teamA = masterTeamRates.teamA + ((newTeamRate.teamA * partnership) / 100);
            masterTeamRates.teamB = masterTeamRates.teamB + ((newTeamRate.teamB * partnership) / 100);
            masterTeamRates.teamC = masterTeamRates.teamC + ((newTeamRate.teamC * partnership) / 100);

            masterTeamRates.teamA = parseFloat((masterTeamRates.teamA).toFixed(2));
            masterTeamRates.teamB = parseFloat((masterTeamRates.teamB).toFixed(2));
            masterTeamRates.teamC = parseFloat((masterTeamRates.teamC).toFixed(2));

            let redisObj = {
              [teamArateRedisKey]: masterTeamRates.teamA,
              [teamBrateRedisKey]: masterTeamRates.teamB,
              ...(teamCrateRedisKey ? { [teamCrateRedisKey]: masterTeamRates.teamC } : {})
            }
            await incrementValuesRedis(partnershipId, {
              exposure: -exposureDiff,
              [redisKeys.userMatchExposure + matchId]: -exposureDiff,
            }, redisObj);
            // Send data to socket for session bet placement
            sendMessageToUser(partnershipId, socketSessionEvent, {
              currentBalance: userRedisData?.currentBalance,
              exposure: partnerExposure,
              ...teamRates,
              bets: bets,
              betId: betId,
              deleteReason: deleteReason,
              matchId: matchId,
              betPlacedId: betPlacedId,
              matchBetType,
              teamArateRedisKey: teamArateRedisKey,
              teamBrateRedisKey: teamBrateRedisKey,
              teamCrateRedisKey: teamCrateRedisKey,
              redisObject: redisObj
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
    matchBetType, newTeamRate,
    teamArateRedisKey: teamArateRedisKey,
    teamBrateRedisKey: teamBrateRedisKey,
    teamCrateRedisKey: teamCrateRedisKey
  }

  const walletJob = walletMatchBetDeleteQueue.createJob(queueObject);
  await walletJob.save();

  const expertJob = expertMatchBetDeleteQueue.createJob(queueObject);
  await expertJob.save();
}

exports.profitLoss = async (req, res) => {
  try {
    const startDate = req.body.startDate;
    const endDate = req.body.endDate;
    const reqUser = req.user;

    const { page, limit, keyword } = req.body;

    let where = {
      result: In([betResultStatus.LOSS, betResultStatus.WIN])
    }
    let result, total, user;
    let userId = req.body.userId;

    if (userId) {
      user = await getUserById(userId, ["roleName"]);
    }

    const queryColumns = profitLossPercentCol({ roleName: req.user.roleName });
    let rateProfitLoss = `(Sum(CASE WHEN betPlaced.result = '${betResultStatus.LOSS}' and (betPlaced.betType = '${betType.BACK}' or betPlaced.betType = '${betType.LAY}') then ROUND(betPlaced.lossAmount / 100 * ${queryColumns}, 2) ELSE 0 END) - Sum(CASE WHEN betPlaced.result = '${betResultStatus.WIN}' and (betPlaced.betType = '${betType.BACK}' or betPlaced.betType = '${betType.LAY}') then ROUND(betPlaced.winAmount / 100 * ${queryColumns}, 2) ELSE 0 END)) as "aggregateAmount"`;
    if (user?.roleName == userRoleConstant.user || reqUser?.roleName == userRoleConstant.user) {
      rateProfitLoss = '-' + rateProfitLoss;
    }

    if (user && user.roleName == userRoleConstant.user) {
      where.createBy = In([userId]);
      result = await betPlacedService.allChildsProfitLoss(where, startDate, endDate, page, limit, keyword, [rateProfitLoss]);
    } else {
      let childsId = await userService.getChildUser(reqUser.id);
      childsId = childsId.map(item => item.id)
      if (!childsId.length) {
        return SuccessResponse({
          statusCode: 200, data: { result: [], count: 0, total: {} }
        }, req, res);
      }
      where.createBy = In(childsId);
     
      result = await betPlacedService.allChildsProfitLoss(where, startDate, endDate, page, limit, keyword, [rateProfitLoss], true);
    }
    total = {};
    result?.profitLossData.forEach((arr, index) => {
      if (total[arr.eventType]) {
        total[arr.eventType] += parseFloat(arr.aggregateAmount);
      } else {
        total[arr.eventType] = parseFloat(arr.aggregateAmount);
      }
    });
    return SuccessResponse(
      {
        statusCode: 200, data: { result: result.profitLossData, count: result?.count?.count, total },
      },
      req,
      res
    );

  } catch (error) {
    return ErrorResponse(error, req, res)
  }
}

exports.getMyMarket = async (req, res) => {
  try {
    const { id: userId } = req.user;

    const marketData = await betPlacedService.getPlacedBetsWithCategory(userId);

    return SuccessResponse(
      {
        statusCode: 200,
        data: marketData,
      },
      req,
      res
    );
  } catch (err) {
    return ErrorResponse(err, req, res);
  }
};

exports.otherMatchBettingBetPlaced = async (req, res) => {
  try {
    logger.info({
      info: `match betting bet placed`,
      data: req.body
    });
    let reqUser = req.user;
    let { teamA, teamB, teamC, stake, odd, betId, bettingType, matchBetType, matchId, betOnTeam, ipAddress, browserDetail, placeIndex, bettingName, gameType = "cricket" } = req.body;

    let userBalanceData = await userService.getUserWithUserBalanceData({ userId: reqUser.id });
    if (!userBalanceData?.user) {
      logger.info({
        info: `user not found for login id ${reqUser.id}`,
        data: req.body
      })
      return ErrorResponse({ statusCode: 403, message: { msg: "notFound", keys: { name: "User" } } }, req, res);
    }

    let user = userBalanceData.user;
    if (user?.userBlock) {
      logger.info({
        info: `user is blocked for login id ${reqUser.id}`,
        data: req.body
      })
      return ErrorResponse({ statusCode: 403, message: { msg: "user.blocked" } }, req, res);
    }
    if (user?.betBlock) {
      logger.info({
        info: `user is blocked for betting id ${reqUser.id}`,
        data: req.body
      })
      return ErrorResponse({ statusCode: 403, message: { msg: "user.betBlockError" } }, req, res);
    }
    let getMatchLockData = await userService.getUserMatchLock({ matchId: matchId, userId: reqUser.id, matchLock: true });
    if (getMatchLockData?.matchLock) {
      logger.info({
        info: `user is blocked for the match ${reqUser.id}, matchId ${matchId}, betId ${betId}`,
        data: req.body
      })
      return ErrorResponse({ statusCode: 403, message: { msg: "user.matchLock" } }, req, res);
    }
    let newCalculateOdd = odd;
    let winAmount = 0, lossAmount = 0;
    if (Object.values(rateCuttingBetType)?.includes(matchBetType)) {
      newCalculateOdd = (newCalculateOdd - 1) * 100;
    }
    // if (Object.values(marketBettingTypeByBettingType)?.includes(matchBetType) && newCalculateOdd > 400) {
    //   return ErrorResponse({ statusCode: 403, message: { msg: "bet.oddNotAllow", keys: { gameType: gameType } } }, req, res);
    // }

    if (bettingType == betType.BACK) {
      winAmount = (stake * newCalculateOdd) / 100;
      lossAmount = stake;
    }
    else if (bettingType == betType.LAY) {
      winAmount = stake;
      lossAmount = (stake * newCalculateOdd) / 100;
    }
    else {
      logger.info({
        info: `Get invalid betting type`,
        data: req.body
      });
      return ErrorResponse({ statusCode: 400, message: { msg: "invalid", keys: { name: "Bet type" } } }, req, res);
    }

    winAmount = Number(winAmount.toFixed(2));
    lossAmount = Number(lossAmount.toFixed(2));


    //fetched match details from expert
    let apiResponse = {};

    try {
      let url = expertDomain + allApiRoutes.MATCHES.MatchBettingDetail + matchId + "/?type=" + matchBetType;
      apiResponse = await apiCall(apiMethod.get, url);
    } catch (error) {
      logger.info({
        info: `Error at get match details.`,
        data: req.body
      });
      throw error?.response?.data;
    }
    let { match, matchBetting } = apiResponse.data;

    if (match?.stopAt) {
      return ErrorResponse({ statusCode: 403, message: { msg: "bet.matchNotLive" } }, req, res);
    }

    let betPlacedObj = {
      matchId: matchId,
      betId: betId,
      winAmount,
      lossAmount,
      result: betResultStatus.PENDING,
      teamName: betOnTeam,
      amount: stake,
      odds: odd,
      betType: bettingType,
      rate: 0,
      createBy: reqUser.id,
      marketType: matchBetType,
      marketBetType: marketBetType.MATCHBETTING,
      ipAddress: ipAddress || req.ip || req.connection.remoteAddress,
      browserDetail: browserDetail || req.headers['user-agent'],
      eventName: match.title,
      eventType: match.matchType,
      bettingName: bettingName
    }
    await validateMatchBettingDetails(matchBetting, betPlacedObj, { teamA, teamB, teamC, placeIndex });
    const teamArateRedisKey =
      otherEventMatchBettingRedisKey[matchBetType]?.a + matchId;
    const teamBrateRedisKey =
      otherEventMatchBettingRedisKey[matchBetType]?.b + matchId;
    const teamCrateRedisKey = otherEventMatchBettingRedisKey[matchBetType]?.c + matchId;


    let userCurrentBalance = userBalanceData.currentBalance;
    let userRedisData = await getUserRedisData(reqUser.id);
    let matchExposure = userRedisData[redisKeys.userMatchExposure + matchId] ? parseFloat(userRedisData[redisKeys.userMatchExposure + matchId]) : 0.0;
    let oldMatchExposure = userRedisData[redisKeys.userMatchExposure + matchId] ? parseFloat(userRedisData[redisKeys.userMatchExposure + matchId]) : 0.0;
    let sessionExposure = userRedisData[redisKeys.userSessionExposure + matchId] ? parseFloat(userRedisData[redisKeys.userSessionExposure + matchId]) : 0.0;
    let userTotalExposure = matchExposure + sessionExposure;



    let teamRates = {
      teamA: parseFloat((Number(userRedisData[teamArateRedisKey]) || 0.0).toFixed(2)),
      teamB: parseFloat((Number(userRedisData[teamBrateRedisKey]) || 0.0).toFixed(2)),
      teamC: teamCrateRedisKey ? parseFloat((Number(userRedisData[teamCrateRedisKey]) || 0.0).toFixed(2)) : 0.0
    };

    let userPreviousExposure = parseFloat(userRedisData[redisKeys.userAllExposure]) || 0.0;
    let userOtherMatchExposure = userPreviousExposure - userTotalExposure;
    let userExposureLimit = parseFloat(user.exposureLimit);

    logger.info({
      info: `User's match and session exposure and teams rate in redis with userId ${reqUser.id} `,
      userCurrentBalance,
      matchExposure,
      sessionExposure,
      userTotalExposure,
      teamRates,
      userPreviousExposure,
      userOtherMatchExposure
    });

    let newTeamRateData = await calculateRate(teamRates, { teamA, teamB, teamC, winAmount, lossAmount, bettingType, betOnTeam }, 100);
    let maximumLoss = 0;
    if (teamC && teamC != '') {
      maximumLoss = Math.min(newTeamRateData.teamA, newTeamRateData.teamB, newTeamRateData.teamC);
    } else {
      maximumLoss = Math.min(newTeamRateData.teamA, newTeamRateData.teamB);
    }
    if (maximumLoss > 0) {
      maximumLoss = 0;
    }
    let newUserExposure = calculateUserExposure(userPreviousExposure, teamRates, newTeamRateData, teamC);
    if (newUserExposure > userExposureLimit) {
      logger.info({
        info: `User exceeded the limit of total exposure for a day`,
        user_id: reqUser.id,
        newUserExposure,
        userExposureLimit
      })
      return ErrorResponse({ statusCode: 400, message: { msg: "user.ExposureLimitExceed" } }, req, res);
    }
    matchExposure = Math.abs(maximumLoss);
    userCurrentBalance = userCurrentBalance - (newUserExposure);
    if (userCurrentBalance < 0) {
      logger.info({
        info: `user exposure balance insufficient to place this bet user id is ${reqUser.id}`,
        betId,
        matchId,
        userCurrentBalance,
        maximumLoss,
        newUserExposure
      })
      return ErrorResponse({ statusCode: 400, message: { msg: "userBalance.insufficientBalance" } }, req, res);
    }
    logger.info({
      info: `updating user exposure balance in redis for user id is ${reqUser.id}`,
      betId,
      matchId,
      userCurrentBalance,
      matchExposure, maximumLoss
    })
    // await updateMatchExposure(reqUser.id, matchId, matchExposure);
    let newBet = await betPlacedService.addNewBet(betPlacedObj);
    let jobData = {
      userId: reqUser.id,
      teamA, teamB, teamC, stake, odd, betId, bettingType, matchBetType, matchId, betOnTeam,
      winAmount,
      lossAmount, newUserExposure,
      userPreviousExposure,
      userCurrentBalance, teamArateRedisKey, teamBrateRedisKey, teamCrateRedisKey, newTeamRateData,
      newBet,
      userName: user.userName,
      matchExposure: matchExposure
    }

    const domainUrl = `${req.protocol}://${req.get('host')}`;

    let walletJobData = {
      domainUrl: domainUrl,
      partnerships: userRedisData.partnerShips,
      userId: reqUser.id,
      stake: jobData.stake,
      userUpdatedExposure: Math.abs(parseFloat(newUserExposure) - parseFloat(userPreviousExposure)),
      newUserExposure, userPreviousExposure,
      winAmount, lossAmount, teamRates,
      bettingType, betOnTeam, teamA, teamB, teamC, teamArateRedisKey, teamBrateRedisKey, teamCrateRedisKey, newBet,
      userName: user.userName
    }

    //add redis queue function
    const job = MatchBetQueue.createJob(jobData);
    await job.save().then(data => {
      logger.info({
        info: `add match betting job save in the redis for user ${reqUser.id}`,
        matchId, jobData
      });
    }).catch(error => {
      logger.error({
        error: `Error at match betting job save in the redis for user ${reqUser.id}.`,
        stack: error.stack,
        message: error.message,
        errorFile: error
      });
      betPlacedService.deleteBetByEntityOnError(newBet);
      throw error;
    });

    const walletJob = WalletMatchBetQueue.createJob(walletJobData);
    await walletJob.save().then(data => {
      logger.info({
        info: `add match betting job save in the redis for wallet ${reqUser.id}`,
        matchId, walletJobData
      });
    }).catch(error => {
      logger.error({
        error: `Error at match betting job save in the redis for wallet ${reqUser.id}.`,
        stack: error.stack,
        message: error.message,
        errorFile: error
      });
    });

    const expertJob = ExpertMatchBetQueue.createJob(walletJobData);
    await expertJob.save().then(data => {
      logger.info({
        info: `add match betting job save in the redis for expert ${reqUser.id}`,
        matchId, walletJobData
      });
    }).catch(error => {
      logger.error({
        error: `Error at match betting job save in the redis for expert ${reqUser.id}.`,
        stack: error.stack,
        message: error.message,
        errorFile: error
      });
      betPlacedService.deleteBetByEntityOnError(newBet);
      throw error;
    });
    return SuccessResponse({ statusCode: 200, message: { msg: "betPlaced" }, data: newBet }, req, res)


  } catch (error) {
    logger.error({
      error: `Error at match betting bet placed.`,
      stack: error.stack,
      message: error.message,
    });
    return ErrorResponse(error, req, res)
  }
}

const updateUserAtMatchOddsForOther = async (userId, betId, matchId, bets, deleteReason, domainUrl, matchDetails) => {
  let userRedisData = await getUserRedisData(userId);
  let isUserLogin = userRedisData ? true : false;
  let userOldExposure = 0;
  let betPlacedId = bets.map(bet => bet.id);
  let partnershipObj = {};
  let socketSessionEvent = socketData.matchDeleteBet;
  let teamRates = {
    teamA: 0,
    teamB: 0,
    teamC: 0
  };
  let matchBetType = bets?.[0].marketType;
  let currUserBalance;

  const teamArateRedisKey =
    otherEventMatchBettingRedisKey[matchBetType]?.a + matchId;
  const teamBrateRedisKey =
    otherEventMatchBettingRedisKey[matchBetType]?.b + matchId;
  const teamCrateRedisKey = otherEventMatchBettingRedisKey[matchBetType]?.c + matchId;

  let isOddOrBookMakerMatch = matchWithTeamName.includes(matchBetType)


  let teamA = !isOddOrBookMakerMatch ? matchBettingsTeamName.under : matchDetails.teamA;
  let teamB = !isOddOrBookMakerMatch ? matchBettingsTeamName.over : matchDetails.teamB;
  let teamC = !isOddOrBookMakerMatch ? null : matchDetails.teamC;
  if (isUserLogin) {
    userOldExposure = parseFloat(userRedisData.exposure);
    partnershipObj = JSON.parse(userRedisData.partnerShips);
    teamRates = {
      teamA: Number(userRedisData[teamArateRedisKey]) || 0.0,
      teamB: Number(userRedisData[teamBrateRedisKey]) || 0.0,
      teamC: teamCrateRedisKey ? Number(userRedisData[teamCrateRedisKey]) || 0.0 : 0.0
    };
    currUserBalance = parseFloat(userRedisData.currentBalance);
  } else {
    let user = await getUserById(userId);
    let partnership = await findUserPartnerShipObj(user);
    partnershipObj = JSON.parse(partnership);
    let userBalance = await getUserBalanceDataByUserId(userId);
    userOldExposure = userBalance.exposure;
    currUserBalance = parseFloat(userBalance.currentBalance);
    let redisData = await calculateProfitLossForOtherMatchToResult([betId], userId, { teamA, teamB, teamC });

    teamRates = {
      teamA: parseFloat((Number(redisData[teamArateRedisKey]) || 0.0).toFixed(2)),
      teamB: parseFloat((Number(redisData[teamBrateRedisKey]) || 0.0).toFixed(2)),
      teamC: teamCrateRedisKey ? parseFloat((Number(redisData[teamCrateRedisKey]) || 0.0).toFixed(2)) : 0.0
    };
  }
  let maximumLossOld = 0;
  if (teamC && teamC != '') {
    maximumLossOld = Math.min(teamRates.teamA, teamRates.teamB, teamRates.teamC);
  } else {
    maximumLossOld = Math.min(teamRates.teamA, teamRates.teamB);
  }
  if (maximumLossOld > 0) {
    maximumLossOld = 0;
  }
  let newTeamRate = {
    teamA: 0,
    teamB: 0,
    teamC: 0
  };
  for (const element of bets) {
    let data = {
      teamA, teamB, teamC,
      winAmount: element.winAmount,
      lossAmount: element.lossAmount,
      bettingType: element.betType,
      betOnTeam: element.teamName
    }
    newTeamRate = await calculateRate(newTeamRate, data, 100);
  }

  // do not chagne any value in newTeamRate object this is using for parent calculation
  teamRates.teamA = parseFloat((teamRates.teamA - newTeamRate.teamA).toFixed(2));
  teamRates.teamB = parseFloat((teamRates.teamB - newTeamRate.teamB).toFixed(2))
  teamRates.teamC = parseFloat((teamRates.teamC - newTeamRate.teamC).toFixed(2))

  let maximumLoss = 0;
  if (teamC && teamC != '') {
    maximumLoss = Math.min(teamRates.teamA, teamRates.teamB, teamRates.teamC);
  } else {
    maximumLoss = Math.min(teamRates.teamA, teamRates.teamB);
  }
  if (maximumLoss > 0) {
    maximumLoss = 0;
  }
  maximumLoss = Math.abs(maximumLoss);
  maximumLossOld = Math.abs(maximumLossOld);

  let exposureDiff = maximumLossOld - maximumLoss;
  await updateUserExposure(userId, (-exposureDiff));

  // blocking user if its exposure would increase by current balance
  const userCreatedBy = await getUserById(userId, ["createBy", "userBlock", "autoBlock", "superParentId"]);
  if (userOldExposure - exposureDiff > currUserBalance && !userCreatedBy.userBlock) {
    await userService.updateUser(userId, {
      autoBlock: true,
      userBlock: true,
      userBlockedBy: userCreatedBy?.createBy == userId ? userCreatedBy.superParentId : userCreatedBy.createBy
    });

    if (userCreatedBy?.createBy == userId) {
      await apiCall(
        apiMethod.post,
        walletDomain + allApiRoutes.WALLET.autoLockUnlockUser,
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
    await userService.updateUser(userId, {
      autoBlock: false,
      userBlock: false,
      userBlockedBy: null
    });

    if (userCreatedBy?.createBy == userId) {
      await apiCall(
        apiMethod.post,
        walletDomain + allApiRoutes.WALLET.autoLockUnlockUser,
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
    let matchExposure = parseFloat(userRedisData[redisKeys.userMatchExposure + matchId]);
    await updateMatchExposure(userId, matchId, matchExposure - exposureDiff);
    let redisObject = {

      [teamArateRedisKey]: teamRates.teamA,
      [teamBrateRedisKey]: teamRates.teamB,
      ...(teamCrateRedisKey ? { [teamCrateRedisKey]: teamRates.teamC } : {})
    }
    await incrementValuesRedis(userId, {
      [redisKeys.userMatchExposure + matchId]: -exposureDiff,
      [redisKeys.userAllExposure]: -exposureDiff
    }, redisObject);
    sendMessageToUser(userId, socketSessionEvent, {
      currentBalance: userRedisData?.currentBalance,
      exposure: userOldExposure - exposureDiff,
      ...teamRates,
      bets: bets,
      betId: betId,
      deleteReason: deleteReason,
      matchId: matchId,
      betPlacedId: betPlacedId,
      matchBetType,
      teamArateRedisKey: teamArateRedisKey,
      teamBrateRedisKey: teamBrateRedisKey,
      teamCrateRedisKey: teamCrateRedisKey,
      redisObject
    });
  }
  await betPlacedService.updatePlaceBet({ matchId: matchId, id: In(betPlacedId) }, { deleteReason: deleteReason, result: betResultStatus.UNDECLARE });

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
          // If masterRedisData exists, update partner exposure
          if (!lodash.isEmpty(masterRedisData)) {
            let masterExposure = parseFloat(masterRedisData.exposure) ?? 0;
            let partnerExposure = masterExposure - exposureDiff;


            let masterTeamRates = {
              teamA: Number(masterRedisData[teamArateRedisKey]) || 0,
              teamB: Number(masterRedisData[teamBrateRedisKey]) || 0,
              teamC: teamCrateRedisKey ? Number(masterRedisData[teamCrateRedisKey]) || 0 : 0
            };
            masterTeamRates.teamA = masterTeamRates.teamA + ((newTeamRate.teamA * partnership) / 100);
            masterTeamRates.teamB = masterTeamRates.teamB + ((newTeamRate.teamB * partnership) / 100);
            masterTeamRates.teamC = masterTeamRates.teamC + ((newTeamRate.teamC * partnership) / 100);

            masterTeamRates.teamA = parseFloat((masterTeamRates.teamA).toFixed(2));
            masterTeamRates.teamB = parseFloat((masterTeamRates.teamB).toFixed(2));
            masterTeamRates.teamC = parseFloat((masterTeamRates.teamC).toFixed(2));

            let redisObj = {
              [teamArateRedisKey]: masterTeamRates.teamA,
              [teamBrateRedisKey]: masterTeamRates.teamB,
              ...(teamCrateRedisKey ? { [teamCrateRedisKey]: masterTeamRates.teamC } : {})
            }
            await incrementValuesRedis(partnershipId, {
              exposure: -exposureDiff,
              [redisKeys.userMatchExposure + matchId]: -exposureDiff,
              [redisKeys.userAllExposure]: partnerExposure
            }, redisObj);

            // Send data to socket for session bet placement
            sendMessageToUser(partnershipId, socketSessionEvent, {
              currentBalance: userRedisData?.currentBalance,
              exposure: partnerExposure,
              ...teamRates,
              bets: bets,
              betId: betId,
              deleteReason: deleteReason,
              matchId: matchId,
              betPlacedId: betPlacedId,
              matchBetType,
              teamArateRedisKey: teamArateRedisKey,
              teamBrateRedisKey: teamBrateRedisKey,
              teamCrateRedisKey: teamCrateRedisKey,
              redisObject: redisObj
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
    matchBetType, newTeamRate,
    teamArateRedisKey: teamArateRedisKey,
    teamBrateRedisKey: teamBrateRedisKey,
    teamCrateRedisKey: teamCrateRedisKey
  }

  const walletJob = walletMatchBetDeleteQueue.createJob(queueObject);
  await walletJob.save();

  const expertJob = expertMatchBetDeleteQueue.createJob(queueObject);
  await expertJob.save();
}

exports.racingBettingBetPlaced = async (req, res) => {
  try {
    logger.info({
      info: `racing match betting bet placed`,
      data: req.body
    });
    let reqUser = req.user;
    let { stake, odd, betId, bettingType, matchBetType, matchId, betOnTeam, ipAddress, browserDetail, placeIndex, bettingName, selectionId, runnerId } = req.body;

    let userBalanceData = await userService.getUserWithUserBalanceData({ userId: reqUser.id });
    let user = userBalanceData?.user;
    if (!user) {
      logger.info({
        info: `user not found for login id ${reqUser.id}`,
        data: req.body
      });
      return ErrorResponse({ statusCode: 403, message: { msg: "notFound", keys: { name: "User" } } }, req, res);
    }
    if (user.userBlock) {
      logger.info({
        info: `user is blocked for login id ${reqUser.id}`,
        data: req.body
      });
      return ErrorResponse({ statusCode: 403, message: { msg: "user.blocked" } }, req, res);
    }
    if (user.betBlock) {
      logger.info({
        info: `user is blocked for betting id ${reqUser.id}`,
        data: req.body
      })
      return ErrorResponse({ statusCode: 403, message: { msg: "user.betBlockError" } }, req, res);
    }
    // let getMatchLockData = await userService.getUserMatchLock({ matchId: matchId, userId: reqUser.id, matchLock: true });
    // if (getMatchLockData?.matchLock) {
    //   logger.info({
    //     info: `user is blocked for the match ${reqUser.id}, matchId ${matchId}, betId ${betId}`,
    //     data: req.body
    //   })
    //   return ErrorResponse({ statusCode: 403, message: { msg: "user.matchLock" } }, req, res);
    // }
    let newCalculateOdd = odd;
    let winAmount = 0, lossAmount = 0;
    newCalculateOdd = (newCalculateOdd - 1) * 100;

    if (bettingType == betType.BACK) {
      winAmount = (stake * newCalculateOdd) / 100;
      lossAmount = stake;
    }
    else if (bettingType == betType.LAY) {
      winAmount = stake;
      lossAmount = (stake * newCalculateOdd) / 100;
    }
    else {
      logger.info({
        info: `Get invalid betting type`,
        data: req.body
      });
      return ErrorResponse({ statusCode: 400, message: { msg: "invalid", keys: { name: "Bet type" } } }, req, res);
    }

    winAmount = Number(winAmount.toFixed(2));
    lossAmount = Number(lossAmount.toFixed(2));

    //fetched match details from expert
    let apiResponse = {};

    try {
      let url = expertDomain + allApiRoutes.MATCHES.raceBettingDetail + matchId + "/?type=" + matchBetType;
      apiResponse = await apiCall(apiMethod.get, url);
    } catch (error) {
      logger.info({
        info: `Error at get match details.`,
        data: req.body
      });
      throw error?.response?.data;
    }
    let { match, matchBetting, runners } = apiResponse.data;

    if (newCalculateOdd >= 20000) {
      return ErrorResponse({ statusCode: 403, message: { msg: "bet.oddNotAllowRacing", keys: { gameType: match?.matchType == gameType.horseRacing ? "Horse" : "Grey hound" } } }, req, res);
    }

    if (match?.stopAt) {
      return ErrorResponse({ statusCode: 403, message: { msg: "bet.matchNotLive" } }, req, res);
    }

    if (new Date().getTime() < new Date(new Date(match?.startAt).setMinutes(new Date(match?.startAt).getMinutes() - parseInt(match?.betPlaceStartBefore))).getTime() && match?.betPlaceStartBefore) {
      return ErrorResponse({ statusCode: 403, message: { msg: "bet.placingBetBeforeTime", keys: { "min": match?.betPlaceStartBefore } } }, req, res);
    }

    let betPlacedObj = {
      matchId: matchId,
      betId: betId,
      winAmount,
      lossAmount,
      result: betResultStatus.PENDING,
      teamName: betOnTeam,
      amount: stake,
      odds: odd,
      betType: bettingType,
      rate: 0,
      createBy: reqUser.id,
      marketType: matchBetType,
      marketBetType: marketBetType.RACING,
      ipAddress: ipAddress || req.ip || req.connection.remoteAddress,
      browserDetail: browserDetail || req.headers['user-agent'],
      eventName: match.title,
      eventType: match.matchType,
      bettingName: bettingName,
      runnerId: runnerId
    }
    await validateRacingBettingDetails(matchBetting, betPlacedObj, placeIndex, selectionId);

    let userCurrentBalance = userBalanceData.currentBalance;
    let userRedisData = await getUserRedisData(reqUser.id);
    let matchExposure = userRedisData[redisKeys.userMatchExposure + matchId] ? parseFloat(userRedisData[redisKeys.userMatchExposure + matchId]) : 0.0;
   
    let userTotalExposure = matchExposure;

    let teamRates = userRedisData?.[`${matchId}${redisKeys.profitLoss}`];

    if (teamRates) {
      teamRates = JSON.parse(teamRates);
    }

    if(!teamRates){
      teamRates = runners.reduce((acc, key) => {
        acc[key?.id] = 0;
        return acc;
      }, {});
    }

    teamRates = Object.keys(teamRates).reduce((acc, key) => {
      acc[key] = parseRedisData(key, teamRates);
      return acc;
    }, {});

    let userPreviousExposure = parseFloat(userRedisData[redisKeys.userAllExposure]) || 0.0;
    let userOtherMatchExposure = userPreviousExposure - userTotalExposure;
    let userExposureLimit = parseFloat(user.exposureLimit);

    logger.info({
      info: `User's match and session exposure and teams rate in redis with userId ${reqUser.id} `,
      userCurrentBalance,
      matchExposure,
      userTotalExposure,
      teamRates,
      userPreviousExposure,
      userOtherMatchExposure
    });

    let newTeamRateData = await calculateRacingRate(teamRates, { runners, winAmount, lossAmount, bettingType, runnerId }, 100);
    let maximumLoss = 0;

    maximumLoss = Math.min(...Object.values(newTeamRateData),0);

    let newUserExposure = calculateRacingUserExposure(userPreviousExposure, teamRates, newTeamRateData);
    if (newUserExposure > userExposureLimit) {
      logger.info({
        info: `User exceeded the limit of total exposure for a day`,
        userId: reqUser.id,
        newUserExposure,
        userExposureLimit
      })
      return ErrorResponse({ statusCode: 400, message: { msg: "user.ExposureLimitExceed" } }, req, res);
    }
    matchExposure = Math.abs(maximumLoss);
    userCurrentBalance = userCurrentBalance - (newUserExposure);
    if (userCurrentBalance < 0) {
      logger.info({
        info: `user exposure balance insufficient to place this bet user id is ${reqUser.id}`,
        betId,
        matchId,
        userCurrentBalance,
        maximumLoss,
        newUserExposure,
        runnerId
      })
      return ErrorResponse({ statusCode: 400, message: { msg: "userBalance.insufficientBalance" } }, req, res);
    }
    logger.info({
      info: `updating user exposure balance in redis for user id is ${reqUser.id}`,
      betId,
      matchId,
      userCurrentBalance,
      matchExposure, maximumLoss
    });

    // await updateMatchExposure(reqUser.id, matchId, matchExposure);
    let newBet = await betPlacedService.addNewBet(betPlacedObj);
    let jobData = {
      userId: reqUser.id,
      runners, stake, odd, betId, bettingType, matchBetType, matchId, betOnTeam,
      runnerId,
      winAmount,
      lossAmount,
      newUserExposure,
      userPreviousExposure,
      userCurrentBalance,
      newTeamRateData,
      newBet,
      userName: user.userName,
      matchExposure: matchExposure,
      selectionId
    }

    const domainUrl = `${req.protocol}://${req.get('host')}`;

    let walletJobData = {
      domainUrl: domainUrl,
      partnerships: userRedisData.partnerShips,
      userId: reqUser.id,
      stake: jobData.stake,
      userUpdatedExposure: Math.abs(parseFloat(newUserExposure) - parseFloat(userPreviousExposure)),
      newUserExposure, userPreviousExposure,
      winAmount, lossAmount, teamRates,
      bettingType, betOnTeam, newBet, runnerId, runners, selectionId,
      userName: user.userName,
      matchId: matchId,
      betId: betId
    }
    //add redis queue function
    const job = MatchRacingBetQueue.createJob(jobData);
    await job.save().then(data => {
      logger.info({
        info: `add match betting job save in the redis for user ${reqUser.id}`,
        matchId, jobData
      });
    }).catch(error => {
      logger.error({
        error: `Error at match betting job save in the redis for user ${reqUser.id}.`,
        stack: error.stack,
        message: error.message,
        errorFile: error
      });
      betPlacedService.deleteBetByEntityOnError(newBet);
      throw error;
    });

    const walletJob = WalletMatchRacingBetQueue.createJob(walletJobData);
    await walletJob.save().then(data => {
      logger.info({
        info: `add match betting job save in the redis for wallet ${reqUser.id}`,
        matchId, walletJobData
      });
    }).catch(error => {
      logger.error({
        error: `Error at match betting job save in the redis for wallet ${reqUser.id}.`,
        stack: error.stack,
        message: error.message,
        errorFile: error
      });
    });

    const expertJob = ExpertMatchRacingBetQueue.createJob(walletJobData);
    await expertJob.save().then(data => {
      logger.info({
        info: `add match betting job save in the redis for expert ${reqUser.id}`,
        matchId, walletJobData
      });
    }).catch(error => {
      logger.error({
        error: `Error at match betting job save in the redis for expert ${reqUser.id}.`,
        stack: error.stack,
        message: error.message,
        errorFile: error
      });
      betPlacedService.deleteBetByEntityOnError(newBet);
      throw error;
    });
    return SuccessResponse({ statusCode: 200, message: { msg: "betPlaced" }, data: newBet }, req, res)


  } catch (error) {
    logger.error({
      error: `Error at match betting bet placed.`,
      stack: error.stack,
      message: error.message,
    });
    return ErrorResponse(error, req, res)
  }
}

exports.deleteRaceMultipleBet = async (req, res) => {
  try {
    const {
      matchId, data, deleteReason
    } = req.body;
  
    if (data?.length == 0) {
      return ErrorResponse(
        {
          statusCode: 400,
          message: {
            msg: "NoData",
          },
        },
        req,
        res
      );
    }
    let placedBetIdArray = [];
    data.forEach(obj => {
      placedBetIdArray.push(obj.placeBetId);
    });
    let placedBet = await betPlacedService.findAllPlacedBet({ matchId: matchId, id: In(placedBetIdArray) });
    let updateObj = {};
    placedBet.forEach(bet => {
     
      if (!updateObj[bet.createBy]) {
        updateObj[bet.createBy] = { [bet.betId]: { array: [bet] } };
      } else {
        if (!updateObj[bet.createBy][bet.betId]) {
          updateObj[bet.createBy][bet.betId] = { array: [bet] };
        } else {
          updateObj[bet.createBy][bet.betId].array.push(bet);
        }
      }
    });

    let apiResponse = {};
    try {
      let url = expertDomain + allApiRoutes.MATCHES.raceBettingDetail + matchId + "?type=" + racingBettingType.matchOdd;
      apiResponse = await apiCall(apiMethod.get, url);
    } catch (error) {
      logger.info({
        info: `Error at get match details for delete match bet.`,
        data: req.body
      });
      throw error?.response?.data;
    }
    let { runners } = apiResponse.data;

    const domainUrl = `${req.protocol}://${req.get('host')}`;
    if (Object.keys(updateObj).length > 0) {
      for (let key in updateObj) {
        let userId = key;
        let userDataDelete = updateObj[key];
        for (let value in userDataDelete) {
          let betId = value;
          let bet = userDataDelete[value];
          await updateUserAtMatchOddsRacing(userId, betId, matchId, bet.array, deleteReason, domainUrl, runners);
        };
      }
    }
    return SuccessResponse({ statusCode: 200, message: { msg: "updated" }, }, req, res);
  } catch (error) {
    logger.error({
      error: `Error at delete bet for the user.`,
      stack: error.stack,
      message: error.message,
    });
    return ErrorResponse(error, req, res);
  }
}

const updateUserAtMatchOddsRacing = async (userId, betId, matchId, bets, deleteReason, domainUrl, runners) => {
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
    teamRates = JSON.parse(userRedisData[`${matchId}${redisKeys.profitLoss}`]);
    currUserBalance = parseFloat(userRedisData.currentBalance);
  } else {
    let user = await getUserById(userId);
    let partnership = await findUserPartnerShipObj(user);
    partnershipObj = JSON.parse(partnership);
    let userBalance = await getUserBalanceDataByUserId(userId);
    userOldExposure = userBalance.exposure;
    currUserBalance = parseFloat(userBalance.currentBalance);
    let redisData = await calculateProfitLossForRacingMatchToResult([betId], userId, {runners});
    teamRates = redisData[`${matchId}${redisKeys.profitLoss}`];
  }

  let maximumLossOld = Math.min(...Object.values(teamRates), 0);

  let newTeamRate = runners.reduce((acc, key) => {
    acc[key?.id] = 0;
    return acc;
  }, {});

  for (const element of bets) {
    let data = {
      runners:runners,
      winAmount: element.winAmount,
      lossAmount: element.lossAmount,
      bettingType: element.betType,
      runnerId: element.runnerId
    };
    newTeamRate = await calculateRacingRate(newTeamRate, data, 100);
  }

  // do not chagne any value in newTeamRate object this is using for parent calculation
   Object.keys(teamRates)?.forEach((item)=>{
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
    await userService.updateUser(userId, {
      autoBlock: true,
      userBlock: true,
      userBlockedBy: userCreatedBy?.createBy == userId ? userCreatedBy.superParentId : userCreatedBy.createBy
    });

    if (userCreatedBy?.createBy == userId) {
      await apiCall(
        apiMethod.post,
        walletDomain + allApiRoutes.WALLET.autoLockUnlockUser,
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
    await userService.updateUser(userId, {
      autoBlock: false,
      userBlock: false,
      userBlockedBy: null
    });

    if (userCreatedBy?.createBy == userId) {
      await apiCall(
        apiMethod.post,
        walletDomain + allApiRoutes.WALLET.autoLockUnlockUser,
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
      [`${matchId}${redisKeys.profitLoss}`]: JSON.stringify(teamRates)
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
      teamRate: teamRates
    });
  }
  await betPlacedService.updatePlaceBet({ matchId: matchId, id: In(betPlacedId) }, { deleteReason: deleteReason, result: betResultStatus.UNDECLARE });

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

            let masterTeamRates = JSON.parse(masterRedisData[`${matchId}${redisKeys.profitLoss}`]);

            masterTeamRates = Object.keys(masterTeamRates).reduce((acc, key) => {
              acc[key] = parseFloat((parseRedisData(key, masterTeamRates) + ((newTeamRate[key] * partnership) / 100)).toFixed(2));
              return acc;
            }, {});

            let redisObj = {
              [`${matchId}${redisKeys.profitLoss}`]: JSON.stringify(masterTeamRates)
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
              teamRate: masterTeamRates
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
    matchBetType, newTeamRate
  }

  const walletJob = walletRaceMatchBetDeleteQueue.createJob(queueObject);
  await walletJob.save();

  const expertJob = expertRaceMatchBetDeleteQueue.createJob(queueObject);
  await expertJob.save();
}

exports.cardBettingBetPlaced = async (req, res) => {
  try {
    logger.info({
      info: `card match betting bet placed`,
      data: req.body
    });
    let reqUser = req.user;
    let { stake, odd, bettingType, matchBetType, matchId, betOnTeam, ipAddress, browserDetail, bettingName, selectionId } = req.body;

    let userBalanceData = await userService.getUserWithUserBalanceData({ userId: reqUser.id });
    let user = userBalanceData?.user;
    if (!user) {
      logger.info({
        info: `user not found for login id ${reqUser.id}`,
        data: req.body
      });
      return ErrorResponse({ statusCode: 403, message: { msg: "notFound", keys: { name: "User" } } }, req, res);
    }
    if (user.userBlock) {
      logger.info({
        info: `user is blocked for login id ${reqUser.id}`,
        data: req.body
      });
      return ErrorResponse({ statusCode: 403, message: { msg: "user.blocked" } }, req, res);
    }
    if (user.betBlock) {
      logger.info({
        info: `user is blocked for betting id ${reqUser.id}`,
        data: req.body
      })
      return ErrorResponse({ statusCode: 403, message: { msg: "user.betBlockError" } }, req, res);
    }

    // getting match
    const match = await getCardMatch({ id: matchId });
    // let getMatchLockData = await userService.getUserMatchLock({ matchId: matchId, userId: reqUser.id, matchLock: true });
    // if (getMatchLockData?.matchLock) {
    //   logger.info({
    //     info: `user is blocked for the match ${reqUser.id}, matchId ${matchId}, betId ${betId}`,
    //     data: req.body
    //   })
    //   return ErrorResponse({ statusCode: 403, message: { msg: "user.matchLock" } }, req, res);
    // }
    let newCalculateOdd = odd;
    let winAmount = 0, lossAmount = 0;

    if (match?.type == cardGameType.race20 && selectionId == 6) {
      newCalculateOdd = bettingType == betType.BACK ? 90 : 105;
    }
    else if (match?.type == cardGameType.worli2 && (betOnTeam?.includes("ODD") || betOnTeam?.includes("EVEN") || betOnTeam?.includes("Line"))) {
      newCalculateOdd = 400;
    }
    else if ([cardGameType.baccarat, cardGameType.baccarat2]?.includes(match?.type)) {
      newCalculateOdd = (newCalculateOdd) * 100;
    }
    else {
      newCalculateOdd = (newCalculateOdd - 1) * 100;
    }

    if (match?.type == cardGameType.worli2 && (betOnTeam?.includes("ODD") || betOnTeam?.includes("EVEN") || betOnTeam?.includes("Line"))) {
      winAmount = ((stake / 5) * (newCalculateOdd)) / 100;
      lossAmount = stake;
    }
    else {
      if (bettingType == betType.BACK) {
        winAmount = (stake * (newCalculateOdd)) / 100;
        lossAmount = stake;
      }
      else if (bettingType == betType.LAY) {
        winAmount = stake;
        lossAmount = (stake * (newCalculateOdd)) / 100;
      }
      else {
        logger.info({
          info: `Get invalid betting type`,
          data: req.body
        });
        return ErrorResponse({ statusCode: 400, message: { msg: "invalid", keys: { name: "Bet type" } } }, req, res);
      }
    }
    winAmount = Number(winAmount.toFixed(2));
    lossAmount = Number(lossAmount.toFixed(2));


    let betPlacedObj = {
      matchId: matchId,
      winAmount,
      lossAmount,
      result: betResultStatus.PENDING,
      teamName: betOnTeam,
      amount: stake,
      odds: odd,
      betType: bettingType,
      rate: calculateBetRate(match, selectionId, bettingType),
      createBy: reqUser.id,
      marketType: matchBetType,
      marketBetType: marketBetType.CARD,
      ipAddress: ipAddress || req.ip || req.connection.remoteAddress,
      browserDetail: `${browserDetail || req.headers['user-agent']}|${selectionId}`,
      eventName: match.name,
      eventType: match.type,
      bettingName: bettingName
    }
    await validateCardBettingDetails(match, betPlacedObj, selectionId);

    switch (match.type) {
      case cardGameType.card32:
      case cardGameType.teen:
      case cardGameType.cricketv3:
      case cardGameType.cmatch20:
      case cardGameType.superover:
        selectionId = 1;
        break;
      case cardGameType.poker:
      case cardGameType.dt6:
        if (parseInt(selectionId) <= 2) {
          selectionId = 1;
        }
        break;
      case cardGameType.card32eu:
      case cardGameType.race20:
      case cardGameType.queen:
        if (parseInt(selectionId) <= 4) {
          selectionId = 1;
        }
        break;
      case cardGameType.aaa:
        if (parseInt(selectionId) <= 3) {
          selectionId = 1;
        }
        break;
      case cardGameType.btable:
        if (parseInt(selectionId) <= 6) {
          selectionId = 1;
        }
        break;
      default:
        break;
    }

    let userCurrentBalance = userBalanceData.currentBalance;
    let userRedisData = await getUserRedisData(reqUser.id);
    let matchExposure = userRedisData[redisKeys.userMatchExposure + betPlacedObj?.runnerId] ? parseFloat(userRedisData[redisKeys.userMatchExposure + betPlacedObj?.runnerId]) : 0.0;
   
    let userTotalExposure = matchExposure;

    let teamRates = userRedisData?.[`${betPlacedObj.runnerId}_${selectionId}${redisKeys.card}`];

    let userPreviousExposure = parseFloat(userRedisData[redisKeys.userAllExposure]) || 0.0;
    let userOtherMatchExposure = userPreviousExposure - userTotalExposure;
    let userExposureLimit = parseFloat(user.exposureLimit);

    logger.info({
      info: `User's card exposure and teams rate in redis with userId ${reqUser.id} `,
      userCurrentBalance,
      matchExposure,
      userTotalExposure,
      teamRates,
      userPreviousExposure,
      userOtherMatchExposure,
      runnerId: betPlacedObj.runnerId
    });

    let cardProfitLossAndExposure = new CardProfitLoss(match.type, teamRates, { bettingType: bettingType, winAmount: winAmount, lossAmount: lossAmount, playerName: betOnTeam, partnership: 100, sid: selectionId }, userPreviousExposure).getCardGameProfitLoss()
    let newTeamRateData = cardProfitLossAndExposure.profitLoss;

    let newUserExposure = cardProfitLossAndExposure.exposure;
    if (newUserExposure > userExposureLimit) {
      logger.info({
        info: `User exceeded the limit of total exposure for a day`,
        userId: reqUser.id,
        newUserExposure,
        userExposureLimit,
        runnerId: betPlacedObj.runnerId
      })
      return ErrorResponse({ statusCode: 400, message: { msg: "user.ExposureLimitExceed" } }, req, res);
    }
    userCurrentBalance = userCurrentBalance - (newUserExposure);
    if (userCurrentBalance < 0) {
      logger.info({
        info: `user exposure balance insufficient to place this bet user id is ${reqUser.id}`,
        matchId,
        userCurrentBalance,
        newUserExposure,
        runnerId: betPlacedObj.runnerId

      })
      return ErrorResponse({ statusCode: 400, message: { msg: "userBalance.insufficientBalance" } }, req, res);
    }
    logger.info({
      info: `updating user exposure balance in redis for user id is ${reqUser.id}`,
      matchId,
      userCurrentBalance,
      matchExposure: newUserExposure,
      runnerId: betPlacedObj.runnerId
    });

    // await updateMatchExposure(reqUser.id, matchId, matchExposure);
    let newBet = await betPlacedService.addNewBet(betPlacedObj);
    let jobData = {
      userId: reqUser.id,
      stake, odd, bettingType, matchBetType, matchId, betOnTeam,
      mid: betPlacedObj.runnerId,
      winAmount,
      lossAmount,
      newUserExposure,
      userPreviousExposure,
      userCurrentBalance,
      newTeamRateData,
      newBet,
      userName: user.userName,
      selectionId,
      matchType: match?.type
    }

    const domainUrl = `${req.protocol}://${req.get('host')}`;

    let walletJobData = {
      domainUrl: domainUrl,
      partnerships: userRedisData.partnerShips,
      userId: reqUser.id,
      stake: jobData.stake,
      userUpdatedExposure: Math.abs(parseFloat(newUserExposure) - parseFloat(userPreviousExposure)),
      newUserExposure, userPreviousExposure,
      winAmount, lossAmount, teamRates,
      bettingType, betOnTeam, newBet, 
      mid: betPlacedObj?.runnerId, selectionId,
      userName: user.userName,
      matchId: matchId,
      matchType: match?.type
    }
    //add redis queue function
    const job = CardMatchBetQueue.createJob(jobData);
    await job.save().then(data => {
      logger.info({
        info: `add match betting job save in the redis for user ${reqUser.id}`,
        matchId, jobData
      });
    }).catch(error => {
      logger.error({
        error: `Error at match betting job save in the redis for user ${reqUser.id}.`,
        stack: error.stack,
        message: error.message,
        errorFile: error
      });
      betPlacedService.deleteBetByEntityOnError(newBet);
      throw error;
    });

    const walletJob = WalletCardMatchBetQueue.createJob(walletJobData);
    await walletJob.save().then(data => {
      logger.info({
        info: `add match betting job save in the redis for wallet ${reqUser.id}`,
        matchId, walletJobData
      });
    }).catch(error => {
      logger.error({
        error: `Error at match betting job save in the redis for wallet ${reqUser.id}.`,
        stack: error.stack,
        message: error.message,
        errorFile: error
      });
    });

    await setCardBetPlaceRedis(betPlacedObj?.runnerId, domainUrl, 1);

    // const expertJob = ExpertCardMatchBetQueue.createJob(walletJobData);
    // await expertJob.save().then(data => {
    //   logger.info({
    //     info: `add match betting job save in the redis for expert ${reqUser.id}`,
    //     matchId, walletJobData
    //   });
    // }).catch(error => {
    //   logger.error({
    //     error: `Error at match betting job save in the redis for expert ${reqUser.id}.`,
    //     stack: error.stack,
    //     message: error.message,
    //     errorFile: error
    //   });
    //   betPlacedService.deleteBetByEntityOnError(newBet);
    //   throw error;
    // });
    return SuccessResponse({ statusCode: 200, message: { msg: "betPlaced" }, data: newBet }, req, res)


  } catch (error) {
    logger.error({
      error: `Error at match betting bet placed.`,
      stack: error.stack,
      message: error.message,
    });
    return ErrorResponse(error, req, res)
  }
}

const validateCardBettingDetails = async (match, betObj, selectionId) => {
  let roundData = null;
  try {
    const url = casinoMicroServiceDomain + allApiRoutes.MICROSERVICE.casinoData + match?.type

    let data = await apiCall(apiMethod.get, url);
    roundData = data?.data;
  }
  catch (error) {
    throw {
      message: {
        msg: "bet.notLive"
      }
    };
  }
  let currData;
  if (match?.type == cardGameType.teen) {
    currData = roundData?.t1?.find((item) => item?.sectionId == selectionId);
  }
  else if (match?.type == cardGameType.ballbyball) {
    currData = roundData?.t1?.sub?.find((item) => item?.sid?.toString() == selectionId?.toString());
  }
  else if (match?.type == cardGameType.dt6 && betObj?.teamName == "Tiger") {
    currData = roundData?.t2?.find((item) => item?.sid == 2);
  }
  else if (match?.type == cardGameType.poker && parseInt(selectionId) > 2) {
      currData = roundData?.t3?.find((item) => item?.sid == selectionId);
  }
  else if(match?.type==cardGameType.teen9){
    currData = roundData?.t2?.find((item) => [item?.tsection, item?.lsection, item?.dsectionid]?.includes(selectionId));
  }
  else {
    currData = roundData?.t2?.find((item) => item?.sid == selectionId);
  }

  if (currData?.gstatus != "1" && currData?.gstatus?.toLowerCase() != "open" && currData?.gstatus?.toLowerCase() != "active" && currData?.status?.toLowerCase() != "active" && match?.type != cardGameType.teen9) {
    throw {
      statusCode: 400,
      message: {
        msg: "bet.notLive"
      }
    };
  }
  else if (match?.type == cardGameType.teen9 && ((betObj?.teamName?.[0]?.toLowerCase() == "t" && !currData?.tstatus) || (betObj?.teamName[0]?.toLowerCase() == "l" && !currData?.lstatus) || (betObj?.teamName[0]?.toLowerCase() == "d" && !currData?.dstatus))) {
    throw {
      statusCode: 400,
      message: {
        msg: "bet.notLive"
      }
    };
  }
  else if (betObj.amount < (currData?.min ?? roundData?.t1?.[0]?.min)) {
    throw {
      statusCode: 400,
      message: {
        msg: "bet.minAmountViolate"
      }
    };
  }
  else if (betObj.amount > (currData?.max ?? roundData?.t1?.[0]?.max)) {
    throw {
      statusCode: 400,
      message: {
        msg: "bet.maxAmountViolate"
      }
    };
  }

  if (processBetPlaceCondition(betObj, currData, match) && match?.type != cardGameType.worli2) {
    throw {
      statusCode: 400,
      message: {
        msg: "bet.marketRateChanged",
        keys: {
          marketType: "Match betting",
        },
      },
    };
  }

  betObj.runnerId = roundData?.t1?.[0]?.mid;
}

const processBetPlaceCondition = (betObj, currData, match) => {
  switch (match.type) {
    case cardGameType.abj:
    case cardGameType.dtl20:
      return parseFloat(betObj.odds) != parseFloat(currData.b1);
    case cardGameType.card32:
    case cardGameType.dt6:
    case cardGameType.poker:
    case cardGameType.race20:
    case cardGameType.queen:
    case cardGameType.card32eu:
    case cardGameType.superover:
    case cardGameType.cricketv3:
    case cardGameType.war:
    case cardGameType.cmatch20:
    case cardGameType.aaa:
    case cardGameType.baccarat:
    case cardGameType.baccarat2:
    case cardGameType.btable:
    case cardGameType.cmeter:
      return ((betObj.betType == betType.BACK && parseFloat(currData.b1) != parseFloat(betObj.odds)) || (betObj.betType === betType.LAY && parseFloat(currData.l1) != parseFloat(betObj.odds)))
    case cardGameType.teen:
      return ((betObj.betType == betType.BACK && ((parseFloat(currData.b1) * 0.01) + 1) != parseFloat(betObj.odds)) || (betObj.betType === betType.LAY && ((parseFloat(currData.l1) * 0.01) + 1) != parseFloat(betObj.odds)))
    case cardGameType.teen9:
      return ((betObj?.teamName[0]?.toLowerCase() == "t" && currData?.trate != betObj?.odds) || (betObj?.teamName[0]?.toLowerCase() == "l" && currData?.lrate != betObj?.odds) || (betObj?.teamName[0]?.toLowerCase() == "d" && currData?.drate != betObj?.odds))
    case cardGameType.ballbyball:
      return ((betObj.betType == betType.BACK && parseFloat(currData.b) != parseFloat(betObj.odds)) || (betObj.betType === betType.LAY && parseFloat(currData.l) != parseFloat(betObj.odds)))
    default:
      return betObj?.odds != currData?.rate
  }
}

function calculateBetRate(match, selectionId, bettingType) {
  if (!match) {
    return 0;
  }

  if (match.type == cardGameType.race20) {
    if (selectionId == 5) {
      return 100;
    } else if (selectionId == 6) {
      if (bettingType == betType.BACK) {
        return 105;
      } else if (bettingType == betType.LAY) {
        return 90;
      }
    }
  }

  return 0;
}