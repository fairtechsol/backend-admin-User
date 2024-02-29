const betPlacedService = require('../services/betPlacedService');
const userService = require('../services/userService');
const { ErrorResponse, SuccessResponse } = require('../utils/response')
const { betStatusType, teamStatus, matchBettingType, betType, redisKeys, betResultStatus, marketBetType, userRoleConstant, manualMatchBettingType, expertDomain, partnershipPrefixByRole, microServiceDomain, tiedManualTeamName, socketData } = require("../config/contants");
const { logger } = require("../config/logger");
const { getUserRedisData, updateMatchExposure, updateUserDataRedis, getUserRedisKey } = require("../services/redis/commonfunction");
const { getUserById } = require("../services/userService");
const { apiCall, apiMethod, allApiRoutes } = require("../utils/apiService");
const { calculateRate, calculateProfitLossSession, calculatePLAllBet, mergeProfitLoss, findUserPartnerShipObj, calculateProfitLossForMatchToResult } = require('../services/commonService');
const { MatchBetQueue, WalletMatchBetQueue, SessionMatchBetQueue, WalletSessionBetQueue, ExpertSessionBetQueue, ExpertMatchBetQueue, walletSessionBetDeleteQueue, expertSessionBetDeleteQueue, walletMatchBetDeleteQueue, expertMatchBetDeleteQueue } = require('../queue/consumer');
const { In, Not, IsNull } = require('typeorm');
let lodash = require("lodash");
const { updateUserBalanceByUserId, getUserBalanceDataByUserId } = require('../services/userBalanceService');
const { sendMessageToUser } = require('../sockets/socketManager');

exports.getBet = async (req, res) => {
  try {
    const reqUser = req.user
    let query = req.query;
    let where = {};
    let result;
    let select = [
      "betPlaced.id", "betPlaced.eventName", "betPlaced.teamName", "betPlaced.betType", "betPlaced.amount", "betPlaced.rate", "betPlaced.winAmount", "betPlaced.lossAmount", "betPlaced.createdAt", "betPlaced.eventType", "betPlaced.marketType", "betPlaced.odds", "betPlaced.marketBetType", "betPlaced.result", "match.title", "match.startAt", "betPlaced.deleteReason", "betPlaceds.bettingName"
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

    if (reqUser.roleName == userRoleConstant.user) {
      where.createBy = reqUser.id;
      result = await betPlacedService.getBet(where, query, reqUser.roleName, select);
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
      result = await betPlacedService.getBet(where, query, reqUser.roleName, select);
    }
    if (!result[1]) return SuccessResponse({
      statusCode: 200, message: { msg: "fetched", keys: { type: "Bet" } }, data: {
        count: 0,
        rows: []
      }
    }, req, res)

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
    let { teamA, teamB, teamC, stake, odd, betId, bettingType, matchBetType, matchId, betOnTeam, ipAddress, browserDetail, placeIndex, bettingName } = req.body;

    let userBalanceData = await userService.getUserWithUserBalanceData({ userId: reqUser.id });
    if (!userBalanceData || !userBalanceData.user) {
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
    if (getMatchLockData && getMatchLockData.matchLock) {
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
      (matchBetType == matchBettingType.tiedMatch1 ||
        matchBetType == matchBettingType.tiedMatch2
        ? redisKeys.yesRateTie
        : matchBetType == matchBettingType.completeMatch || matchBetType == matchBettingType.completeManual
          ? redisKeys.yesRateComplete
          : redisKeys.userTeamARate) + matchId;
    const teamBrateRedisKey = (
      matchBetType == matchBettingType.tiedMatch1 ||
        matchBetType == matchBettingType.tiedMatch2
        ? redisKeys.noRateTie
        : matchBetType == matchBettingType.completeMatch || matchBetType == matchBettingType.completeManual
          ? redisKeys.noRateComplete
          : redisKeys.userTeamBRate) + matchId;
    const teamCrateRedisKey = matchBetType == matchBettingType.tiedMatch1 ||
      matchBetType == matchBettingType.tiedMatch2 || matchBetType == matchBettingType.completeMatch || matchBetType == matchBettingType.completeManual? null : redisKeys.userTeamCRate + matchId;


    let userCurrentBalance = userBalanceData.currentBalance;
    let userRedisData = await getUserRedisData(reqUser.id);
    let matchExposure = userRedisData[redisKeys.userMatchExposure + matchId] ? parseFloat(userRedisData[redisKeys.userMatchExposure + matchId]) : 0.0;
    let oldMatchExposure = userRedisData[redisKeys.userMatchExposure + matchId] ? parseFloat(userRedisData[redisKeys.userMatchExposure + matchId]) : 0.0;
    let sessionExposure = userRedisData[redisKeys.userSessionExposure + matchId] ? parseFloat(userRedisData[redisKeys.userSessionExposure + matchId]) : 0.0;
    let userTotalExposure = matchExposure + sessionExposure;



    let teamRates = {
      teamA: parseFloat((Number(userRedisData[teamArateRedisKey]) || 0.0).toFixed(2)),
      teamB:  parseFloat((Number(userRedisData[teamBrateRedisKey]) || 0.0).toFixed(2)),
      teamC: teamCrateRedisKey ?  parseFloat((Number(userRedisData[teamCrateRedisKey]) || 0.0).toFixed(2)) : 0.0
    };

    let userPreviousExposure = parseFloat(userRedisData[redisKeys.userAllExposure]) || 0.0;
    let userOtherMatchExposure = userPreviousExposure - userTotalExposure;
    let userExposureLimit = parseFloat(userRedisData[redisKeys.userExposureLimit]);

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
    userCurrentBalance = userCurrentBalance - (userOtherMatchExposure + matchExposure + sessionExposure);
    if (userCurrentBalance < 0) {
      logger.info({
        info: `user exposure balance insufficient to place this bet user id is ${reqUser.id}`,
        betId,
        matchId,
        userCurrentBalance,
        maximumLoss
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
    await updateMatchExposure(reqUser.id, matchId, matchExposure);
    let newBet = await betPlacedService.addNewBet(betPlacedObj);
    let jobData = {
      userId: reqUser.id,
      teamA, teamB, teamC, stake, odd, betId, bettingType, matchBetType, matchId, betOnTeam,
      winAmount,
      lossAmount, newUserExposure,
      userPreviousExposure,
      userCurrentBalance, teamArateRedisKey, teamBrateRedisKey, teamCrateRedisKey, newTeamRateData,
      newBet,
      userName: user.userName
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
    await job.save().then(data =>{
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
      updateMatchExposure(reqUser.id, matchId, oldMatchExposure);
      betPlacedService.deleteBetByEntityOnError(newBet);
      throw error;
    });

    const walletJob = WalletMatchBetQueue.createJob(walletJobData);
    await walletJob.save().then(data =>{
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
    await expertJob.save().then(data =>{
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
      updateMatchExposure(reqUser.id, matchId, oldMatchExposure);
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
    } = req.body;
    const { id } = req.user;

    // Fetch user details by ID
    let user = await getUserById(id, ["userBlock", "betBlock", "userName"]);

    // Check if the user is blocked
    if (user?.userBlock) {
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
    if (user?.betBlock) {
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
    if (getMatchLockData && getMatchLockData.sessionLock) {
      logger.info({
        info: `user is blocked for the session ${id}, matchId ${matchId}, betId ${betId}`,
        data: req.body
      })
      return ErrorResponse({ statusCode: 403, message: { msg: "user.matchLock" } }, req, res);
    }

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
    } catch (err) {
      // Handle API call error and return an error response
      return ErrorResponse(err?.response?.data, req, res);
    }

    await validateSessionBet(sessionDetails, req.body);

    let winAmount = 0,
      loseAmount = 0;

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

    const userData = await getUserRedisData(id);
    let sessionExp = parseFloat(userData[`${redisKeys.userSessionExposure}${matchId}`]) || 0.0;


    logger.info({
      message: "Session exposure coming from redis.",
      sessionExp
    });


    let betPlaceObject = {
      winAmount: parseFloat(winAmount),
      loseAmount: parseFloat(loseAmount),
      betPlacedData: {
        userName: user.userName,
        odds: parseFloat(odds),
        betType: sessionBetType,
        stake: parseFloat(stake),
        matchId: matchId,
        betId: betId,
        rate: parseFloat(ratePercent),
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

    let redisData = await calculateProfitLossSession(
      sessionProfitLossData,
      betPlaceObject
    );

    betPlaceObject.maxLoss = Math.abs(redisData.maxLoss - maxSessionLoss);
    let redisSessionExp = Number(
      (sessionExp + redisData?.maxLoss - maxSessionLoss).toFixed(2)
    );

    totalExposure = parseFloat(parseFloat(totalExposure + redisData.maxLoss - maxSessionLoss).toFixed(2)) ;

    let redisObject = {
      [`${redisKeys.userSessionExposure}${matchId}`]: redisSessionExp,
      [`${betId}_profitLoss`]: JSON.stringify(redisData),
      exposure: totalExposure,
    };

    let newBalance =
      parseFloat(userData?.currentBalance).toFixed(2) - totalExposure;

    betPlaceObject.diffSessionExp = redisData.maxLoss - maxSessionLoss;

    if (newBalance < 0) {
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
      teamName: sessionDetails?.name + " / " + ratePercent,
      marketType: sessionDetails?.type,
      marketBetType: marketBetType.SESSION,
      ipAddress: ipAddress || req.ip || req.connection.remoteAddress,
      browserDetail: browserDetail || req.headers['user-agent'],
      eventName: eventName,
      eventType: eventType,
      userId: id,
      createBy: id,
    });

    
    await updateUserBalanceByUserId(id, {
      exposure: totalExposure,
    });

    await updateUserDataRedis(id, redisObject);

    let jobData = {
      userId: id,
      placedBet: placedBet,
      newBalance: newBalance,
      betPlaceObject: betPlaceObject
    }
    //add redis queue function
    const job = SessionMatchBetQueue.createJob(jobData);
    await job.save().then(data =>{
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
    await walletJob.save().then(data =>{
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
    await expertJob.save().then(data =>{
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
              marketType: "Session",
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
      (betDetails.betType == betType.NO &&
        betDetails.odds != apiBetData.noRate) ||
      (betDetails.betType == betType.YES &&
        betDetails.odds != apiBetData.yesRate) ||
      (apiBetData.status != null && apiBetData.status != teamStatus.active)
    ) {
      throw {
        statusCode: 400,
        message: {
          msg: "bet.marketRateChanged",
          keys: {
            marketType: "Session",
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
      microServiceUrl + allApiRoutes.MICROSERVICE.session + apiBetData.marketId
    ).catch(error => {
      logger.error({
        error: `Error at session bet check validate with third party url api hit.`,
        stack: error.stack,
        message: error.message,
      });
      throw error
    });
    let filterData = data?.find(
      (d) => d.SelectionId == apiBetData.selectionId
    );
    if (
      betDetail.betType == betType.NO &&
      betDetail.odds != filterData["LayPrice1"]
    ) {
      return true;
    } else if (
      betDetail.betType == betType.YES &&
      betDetail.odds != filterData["BackPrice1"]
    ) {
      return true;
    } else {
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

const checkRate = async (matchBettingDetail, betObj, teams) => {
  if (betObj.betType == betType.BACK && teams.teamA == betObj.teamName && (matchBettingDetail.statusTeamA == teamStatus.suspended || matchBettingDetail.backTeamA - teams.placeIndex != betObj.odds)) {
    return true;
  }
  else if (betObj.betType == betType.BACK && teams.teamB == betObj.teamName && (matchBettingDetail.statusTeamB == teamStatus.suspended || matchBettingDetail.backTeamB - teams.placeIndex != betObj.odds)) {
    return true;
  }
  else if (betObj.betType == betType.BACK && teams.teamC == betObj.teamName && (matchBettingDetail.statusTeamC == teamStatus.suspended || matchBettingDetail.backTeamC - teams.placeIndex != betObj.odds)) {
    return true;
  }
  else if (betObj.betType == betType.LAY && teams.teamA == betObj.teamName && (matchBettingDetail.statusTeamA == teamStatus.suspended || +matchBettingDetail.layTeamA + teams.placeIndex != betObj.odds)) {
    return true;
  }
  else if (betObj.betType == betType.LAY && teams.teamB == betObj.teamName && (matchBettingDetail.statusTeamB == teamStatus.suspended || +matchBettingDetail.layTeamB + teams.placeIndex != betObj.odds)) {
    return true;
  }
  else if (betObj.betType == betType.LAY && teams.teamC == betObj.teamName && (matchBettingDetail.statusTeamC == teamStatus.suspended || +matchBettingDetail.layTeamC + teams.placeIndex != betObj.odds)) {
    return true;
  }
  else {
    return false;
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

let CheckThirdPartyRate = async (matchBettingDetail, betObj, teams) => {
  let url = "";
  const microServiceUrl = microServiceDomain;
  try {
    if (matchBettingDetail.type == matchBettingType.bookmaker) {
      url = microServiceUrl + allApiRoutes.MICROSERVICE.bookmaker + matchBettingDetail.marketId

    }
    else {
      url = microServiceUrl + allApiRoutes.MICROSERVICE.matchOdd + matchBettingDetail.marketId

    }
    let data = await apiCall(apiMethod.get, url);
    if (data) {
      if (data[0]['ex'] && betObj.betType == betType.BACK && teams.teamA == betObj.teamName && data[0]['ex'].availableToBack[teams.placeIndex].price != betObj.odds) {
        return true;
      } else if (data[0]['ex'] && betObj.betType == betType.LAY && teams.teamA == betObj.teamName && data[0]['ex'].availableToLay[teams.placeIndex].price != betObj.odds) {
        return true;
      } else if (data[1]['ex'] && betObj.betType == betType.BACK && teams.teamB == betObj.teamName && data[1]['ex'].availableToBack[teams.placeIndex].price != betObj.odds) {
        return true;
      } else if (data[1]['ex'] && betObj.betType == betType.LAY && teams.teamB == betObj.teamName && data[1]['ex'].availableToLay[teams.placeIndex].price != betObj.odds) {
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

exports.deleteMultipleBet = async (req, res) => {
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
    let isAnyMatchBet = false;
    placedBet.map(bet => {
      let isSessionBet = false;
      if (bet.betType == betType.YES || bet.betType == betType.NO) {
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

  if (isUserLogin) {
    userOldExposure = parseFloat(userRedisData.exposure);
    partnershipObj = JSON.parse(userRedisData.partnerShips);
    oldSessionExposure = userRedisData[redisSesionExposureName];
    oldProfitLoss = userRedisData[redisName];
  } else {
    let user = await getUserById(userId);
    let partnership = await findUserPartnerShipObj(user);
    partnershipObj = JSON.parse(partnership);
    let userBalance = await getUserBalanceDataByUserId(userId);
    userOldExposure = userBalance.exposure;

    let placedBet = await betPlacedService.findAllPlacedBet({ matchId: matchId, betId: betId, createBy: userId, deleteReason: IsNull() });
    let userAllBetProfitLoss = await calculatePLAllBet(placedBet, 100);
    oldProfitLoss = {
      lowerLimitOdds: userAllBetProfitLoss.lowerLimitOdds,
      upperLimitOdds: userAllBetProfitLoss.upperLimitOdds,
      maxLoss: userAllBetProfitLoss.maxLoss,
      betPlaced: userAllBetProfitLoss.betData,
      totalBet : userAllBetProfitLoss.total_bet
    }
    oldProfitLoss = JSON.stringify(oldProfitLoss);
  }

  if (oldProfitLoss) {
    oldProfitLoss = JSON.parse(oldProfitLoss);
    oldMaxLoss = parseFloat(oldProfitLoss.maxLoss);
  }
  let oldLowerLimitOdds = parseFloat(oldProfitLoss.lowerLimitOdds);
  let oldUpperLimitOdds = parseFloat(oldProfitLoss.upperLimitOdds);
  let userDeleteProfitLoss = await calculatePLAllBet(bets, 100, oldLowerLimitOdds, oldUpperLimitOdds);

  await mergeProfitLoss(userDeleteProfitLoss.betData, oldProfitLoss.betPlaced);

  let oldBetPlacedPL = oldProfitLoss.betPlaced;
  let newMaxLoss = 0;

  oldProfitLoss.totalBet = oldProfitLoss.totalBet - userDeleteProfitLoss.total_bet;

  for (let i = 0; i < oldBetPlacedPL.length; i++) {
    oldBetPlacedPL[i].profitLoss = oldBetPlacedPL[i].profitLoss - userDeleteProfitLoss.betData[i].profitLoss;
    if (newMaxLoss < Math.abs(oldBetPlacedPL[i].profitLoss) && oldBetPlacedPL[i].profitLoss < 0) {
      newMaxLoss = Math.abs(oldBetPlacedPL[i].profitLoss);
    }
  }
  oldProfitLoss.betPlaced = oldBetPlacedPL;
  oldProfitLoss.maxLoss = newMaxLoss;
  let exposureDiff = oldMaxLoss - newMaxLoss;
  await updateUserBalanceByUserId(userId, {
    exposure: userOldExposure - exposureDiff,
  });
  if (isUserLogin) {
    let redisObject = {
      [redisSesionExposureName]: oldSessionExposure - exposureDiff,
      exposure: userOldExposure - exposureDiff,
      [redisName]: JSON.stringify(oldProfitLoss)
    }
    await updateUserDataRedis(userId, redisObject);
    sendMessageToUser(userId, socketSessionEvent, {
      currentBalance: userRedisData?.currentBalance,
      exposure: redisObject?.exposure,
      sessionExposure: redisObject[redisSesionExposureName],
      profitLoss: oldProfitLoss,
      bets: bets,
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
        item != userRoleConstant.fairGameWallet
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
            let partnerUser = await getUserBalanceDataByUserId(partnershipId);
            let partnerExposure = (partnerUser.exposure || 0) - exposureDiff;
            await updateUserBalanceByUserId(partnershipId, {
              exposure: partnerExposure,
            });
          } else {
            // If masterRedisData exists, update partner exposure and session data
            let masterExposure = parseFloat(masterRedisData.exposure) ?? 0;
            let partnerExposure = (masterExposure || 0) - exposureDiff;
            await updateUserBalanceByUserId(partnershipId, {
              exposure: partnerExposure,
            });

            let oldProfitLossParent = JSON.parse(masterRedisData[redisName]);
            let parentPLbetPlaced = oldProfitLossParent?.betPlaced || [];
            let newMaxLossParent = 0;
            let oldMaxLossParent = oldProfitLossParent?.maxLoss;

            await mergeProfitLoss(userDeleteProfitLoss.betData, parentPLbetPlaced);

            userDeleteProfitLoss.betData.map((ob, index) => {
              let partnershipData = (ob.profitLoss * partnership) / 100;
              if (ob.odds == parentPLbetPlaced[index].odds) {
                parentPLbetPlaced[index].profitLoss = parseFloat(parentPLbetPlaced[index].profitLoss) + partnershipData;
                if (newMaxLossParent < Math.abs(parentPLbetPlaced[index].profitLoss) && parentPLbetPlaced[index].profitLoss < 0) {
                  newMaxLossParent = Math.abs(parentPLbetPlaced[index].profitLoss);
                }
              }
            });
            oldProfitLossParent.betPlaced = parentPLbetPlaced;
            oldProfitLossParent.maxLoss = newMaxLossParent;
            oldProfitLossParent.totalBet = oldProfitLossParent.totalBet - userDeleteProfitLoss.total_bet;
            
            let sessionExposure = parseFloat(masterRedisData[redisSesionExposureName]) - oldMaxLossParent + newMaxLossParent;
            let redisObj = {
              [redisName]: JSON.stringify(oldProfitLossParent),
              exposure: partnerExposure,
              [redisSesionExposureName]: sessionExposure
            };

            updateUserDataRedis(partnershipId, redisObj);
            // Send data to socket for session bet placement
            sendMessageToUser(partnershipId, socketSessionEvent, {
              exposure: redisObj?.exposure,
              sessionExposure: redisObj[redisSesionExposureName],
              profitLoss: oldProfitLossParent,
              bets: bets,
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
      betPlacedId: betPlacedId
    }
  const walletJob = walletSessionBetDeleteQueue.createJob(queueObject);
  await walletJob.save();

  const expertJob = expertSessionBetDeleteQueue.createJob(queueObject);
  await expertJob.save();

}

const updateUserAtMatchOdds = async (userId, betId, matchId, bets, deleteReason, domainUrl, matchDetails) => {
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

  const teamArateRedisKey =
    (matchBetType == matchBettingType.tiedMatch1 || matchBetType == matchBettingType.tiedMatch2
      ? redisKeys.yesRateTie :
      matchBetType == matchBettingType.completeMatch || matchBetType == matchBettingType.completeManual
        ? redisKeys.yesRateComplete : redisKeys.userTeamARate) + matchId;
  const teamBrateRedisKey = (matchBetType == matchBettingType.tiedMatch1 || matchBetType == matchBettingType.tiedMatch2
    ? redisKeys.noRateTie :
    matchBetType == matchBettingType.completeMatch || matchBetType == matchBettingType.completeManual
      ? redisKeys.noRateComplete : redisKeys.userTeamBRate) + matchId;
  const teamCrateRedisKey = matchBetType == matchBettingType.tiedMatch1 || matchBetType == matchBettingType.tiedMatch2 || matchBetType == matchBettingType.completeMatch || matchBetType == matchBettingType.completeManual
    ? null : redisKeys.userTeamCRate + matchId;

  let isTiedOrCompMatch = [matchBettingType.tiedMatch1, matchBettingType.tiedMatch2, matchBettingType.completeMatch || matchBettingType.completeManual].includes(matchBetType);

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
  } else {
    let user = await getUserById(userId);
    let partnership = await findUserPartnerShipObj(user);
    partnershipObj = JSON.parse(partnership);
    let userBalance = await getUserBalanceDataByUserId(userId);
    userOldExposure = userBalance.exposure;

    let redisData = await calculateProfitLossForMatchToResult([betId], userId, { teamA, teamB, teamC });
    teamRates = {
      teamA: !isTiedOrCompMatch ? redisData.teamARate : (matchBetType == matchBettingType.tiedMatch1 || matchBetType == matchBettingType.tiedMatch2) ? teamYesRateTie : teamYesRateComplete,
      teamB: !isTiedOrCompMatch ? redisData.teamBRate : (matchBetType == matchBettingType.tiedMatch1 || matchBetType == matchBettingType.tiedMatch2) ? teamNoRateTie : teamNoRateComplete,
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
  await updateUserBalanceByUserId(userId, {
    exposure: userOldExposure - exposureDiff,
  });

  if (isUserLogin) {
    let matchExposure = parseFloat(userRedisData[redisKeys.userMatchExposure + matchId]);
    await updateMatchExposure(userId, matchId, matchExposure - exposureDiff);
    let redisObject = {
      [redisKeys.userAllExposure]: userOldExposure - exposureDiff,
      [teamArateRedisKey]: teamRates.teamA,
      [teamBrateRedisKey]: teamRates.teamB,
      ...(teamCrateRedisKey ? { [teamCrateRedisKey]: teamRates.teamC } : {})
    }
    await updateUserDataRedis(userId, redisObject);
    sendMessageToUser(userId, socketSessionEvent, {
      currentBalance: userRedisData?.currentBalance,
      exposure: redisObject?.exposure,
      ...teamRates,
      bets: bets,
      betId: betId,
      deleteReason: deleteReason,
      matchId: matchId,
      betPlacedId: betPlacedId,
      matchBetType
    });
  }
  await betPlacedService.updatePlaceBet({ matchId: matchId, id: In(betPlacedId) }, { deleteReason: deleteReason, result: betResultStatus.UNDECLARE });

  Object.keys(partnershipPrefixByRole)
    ?.filter(
      (item) =>
        item != userRoleConstant.fairGameAdmin &&
        item != userRoleConstant.fairGameWallet
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
            let partnerUser = await getUserBalanceDataByUserId(partnershipId);
            let partnerExposure = partnerUser.exposure - exposureDiff;
            await updateUserBalanceByUserId(partnershipId, {
              exposure: partnerExposure,
            });
          } else {
            // If masterRedisData exists, update partner exposure and session data
            let masterExposure = parseFloat(masterRedisData.exposure) ?? 0;
            let partnerExposure = masterExposure - exposureDiff;
            await updateUserBalanceByUserId(partnershipId, {
              exposure: partnerExposure,
            });

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
              [redisKeys.userAllExposure]: partnerExposure,
              [teamArateRedisKey]: masterTeamRates.teamA,
              [teamBrateRedisKey]: masterTeamRates.teamB,
              ...(teamCrateRedisKey ? { [teamCrateRedisKey]: masterTeamRates.teamC } : {})
            }
            updateUserDataRedis(partnershipId, redisObj);
            // Send data to socket for session bet placement
            sendMessageToUser(partnershipId, socketSessionEvent, {
              currentBalance: userRedisData?.currentBalance,
              exposure: redisObj?.exposure,
              ...teamRates,
              bets: bets,
              betId: betId,
              deleteReason: deleteReason,
              matchId: matchId,
              betPlacedId: betPlacedId,
              matchBetType,
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
    const startDate = req.body.startDate
    const endDate = req.body.endDate
    const reqUser = req.user
    let where = {
      result: In([betResultStatus.LOSS, betResultStatus.WIN])
    }
    let result, total, user
    let userId = req.body.userId;

    if (userId != "") {
      user = await getUserById(userId, ["roleName"]);
    }
    if (user && user.roleName == userRoleConstant.user) {
      where.createBy = In([userId]);
      result = await betPlacedService.allChildsProfitLoss(where, startDate, endDate);
    } else {
      let childsId = await userService.getChildsWithOnlyUserRole(reqUser.id);
      childsId = childsId.map(item => item.id)
      if (!childsId.length) {
        return SuccessResponse({
          statusCode: 200, message: { msg: "fetched", keys: { type: "Profit loss" } }, data: {
            result: [],
            total: 0
          }
        }, req, res)
      }
      where.createBy = In(childsId);
      result = await betPlacedService.allChildsProfitLoss(where, startDate, endDate);
    }
    total = {};
    result.map((arr, index) => {
      if(total[arr.marketType]){
        total[arr.marketType] += parseFloat(arr.aggregateAmount);
      } else {
        total[arr.marketType] = parseFloat(arr.aggregateAmount);
      }
    });
    return SuccessResponse(
      {
        statusCode: 200, message: { msg: "fetched", keys: { type: "Profit loss" } }, data: { result, total },
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
