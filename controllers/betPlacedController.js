const betPlacedService = require('../services/betPlacedService');
const userService = require('../services/userService');
const { ErrorResponse, SuccessResponse } = require('../utils/response')
const { betStatusType, teamStatus, betType, redisKeys, betResultStatus, marketBetType, userRoleConstant, partnershipPrefixByRole, microServiceDomain, casinoMicroServiceDomain, cardGameType, sessionBettingType, oldBetFairDomain } = require("../config/contants");
const { logger } = require("../config/logger");
const { getUserRedisData, getUserRedisKey, setCardBetPlaceRedis } = require("../services/redis/commonfunction");
const { getUserById } = require("../services/userService");
const { apiCall, apiMethod, allApiRoutes } = require("../utils/apiService");
const { calculateProfitLossSession, parseRedisData, calculateRacingRate, profitLossPercentCol, calculateProfitLossSessionOddEven, calculateProfitLossSessionCasinoCricket, calculateProfitLossSessionFancy1, checkBetLimit, calculateProfitLossKhado, calculateProfitLossMeter } = require('../services/commonService');
const { SessionMatchBetQueue, WalletSessionBetQueue, ExpertSessionBetQueue, CardMatchBetQueue, WalletCardMatchBetQueue, MatchTournamentBetQueue, WalletMatchTournamentBetQueue, ExpertMatchTournamentBetQueue } = require('../queue/consumer');
const { In, Not, IsNull } = require('typeorm');
let lodash = require("lodash");
const { getCardMatch } = require('../services/cardMatchService');
const { CardProfitLoss } = require('../services/cardService/cardProfitLossCalc');
const { getMatchData } = require('../services/matchService');
const { getSessionDetailsHandler, getTournamentBettingHandler } = require('../grpc/grpcClient/handlers/expert/matchHandler');

exports.getBet = async (req, res) => {
  try {
    let { isCurrentBets, userId, ...query } = req.query;
    let reqUser;
    if (userId) {
      reqUser = await getUserById(userId);
    }
    else { reqUser = req.user; }

    const result = await this.getBetsCondition(reqUser, query, isCurrentBets);

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

exports.getBetsCondition = async (reqUser, query, isCurrentBets) => {
  let where = {};
  let select = [
    "betPlaced.id", "betPlaced.teamName", "betPlaced.eventName", "betPlaced.betType", "betPlaced.amount", "betPlaced.rate", "betPlaced.winAmount", "betPlaced.lossAmount", "betPlaced.createdAt", "betPlaced.eventType", "betPlaced.marketType", "betPlaced.odds", "betPlaced.marketBetType", "betPlaced.result", "match.title", "match.startAt", "betPlaced.deleteReason", "betPlaced.ipAddress", "betPlaced.browserDetail", "betPlaced.bettingName", "match.id", "betPlaced.runnerId", "betPlaced.isCommissionActive"
  ];

  if (isCurrentBets) {
    select.push("racingMatch.title", "racingMatch.startAt", "racingMatch.id");
  }

  if (query.status == "MATCHED") {
    where.result = In([betResultStatus.LOSS, betResultStatus.TIE, betResultStatus.WIN]);
    query = lodash.omit(query, ['status']);
  } else if (query.status == betResultStatus.PENDING) {
    where.result = betResultStatus.PENDING;
    query = lodash.omit(query, ['status']);
  } else if (query.status == "DELETED") {
    where.deleteReason = Not(IsNull());
    where.result = betResultStatus.UNDECLARE;
    query = lodash.omit(query, ['status']);
  } else {
    query = lodash.omit(query, ['status']);
  }

  if (reqUser.roleName == userRoleConstant.user) {
    where.createBy = reqUser.id;
    select.push("user.id", "user.userName");
    return await betPlacedService.getBet(where, query, reqUser.roleName, select, null, true, isCurrentBets);
  } else {
    let childsId = await userService.getChildsWithOnlyUserRole(reqUser.id);
    childsId = childsId.map(item => item.id);
    if (!childsId.length) {
      return [];
    }
    let partnershipColumn = partnershipPrefixByRole[reqUser.roleName] + 'Partnership';
    select.push("user.id", "user.userName", `user.${partnershipColumn}`);
    where.createBy = In(childsId);
    return await betPlacedService.getBet(where, query, reqUser.roleName, select, null, true, isCurrentBets);
  }
};

exports.getAccountStatementBet = async (req, res) => {
  try {
    let { query, user: reqUser } = req;
    let where = {};
    let result;

    let select = [
      "betPlaced.id", "betPlaced.ipAddress", "betPlaced.browserDetail", "betPlaced.teamName", "betPlaced.eventName", "betPlaced.betType", "betPlaced.amount", "betPlaced.rate", "betPlaced.winAmount", "betPlaced.lossAmount", "betPlaced.createdAt", "betPlaced.eventType", "betPlaced.marketType", "betPlaced.odds", "betPlaced.marketBetType", "betPlaced.result", "match.title", "match.startAt", "betPlaced.deleteReason", "betPlaced.bettingName", "match.id", "racingMatch.title", "racingMatch.startAt", "racingMatch.id", "user.userName", "createBy.userName", "user.id"
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

exports.tournamentBettingBetPlaced = async (req, res) => {
  try {
    logger.info({
      info: `tournament match betting bet placed`,
      data: req.body
    });
    let reqUser = req.user;
    let { stake, odd, betId, bettingType, matchBetType, matchId, betOnTeam, ipAddress, browserDetail, placeIndex, bettingName, selectionId, runnerId, gType, mid } = req.body;

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
    let checkMarketLock = await userService.getUserMarketLock({ matchId, userId: reqUser.id, betId });
    if (checkMarketLock) {
      logger.info({
        info: `user is blocked for the market ${reqUser.id}, matchId ${matchId}, betId ${betId}`,
        data: req.body
      });
      return ErrorResponse({ statusCode: 403, message: { msg: "user.marketLock" } }, req, res);
    }
    let newCalculateOdd = odd;
    let winAmount = 0, lossAmount = 0;
    if (gType == "match") {
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
    let apiResponse = await getTournamentBettingHandler({
      matchId: matchId,
      id: betId
    }).catch(error => {
      logger.info({
        info: `Error at get match details.`,
        data: req.body
      });
      throw error?.response?.data;
    });

    let { match, matchBetting, runners } = apiResponse.data;

    await checkBetLimit(matchBetting?.betLimit, matchBetting?.parentBetId || betId, matchId);
    matchBetting.eventId = match.eventId;
    if (match?.stopAt) {
      return ErrorResponse({ statusCode: 403, message: { msg: "bet.matchNotLive" } }, req, res);
    }
    const domainUrl = `${process.env.GRPC_URL}`;

    const currRunner = runners.find((item) => item.id == runnerId);
    runnerId = currRunner?.parentRunnerId || runnerId;
    runners = runners.map((item) => ({ ...item, id: item?.parentRunnerId || item?.id }));

    let betPlacedObj = {
      matchId: matchId,
      betId: matchBetting?.parentBetId || betId,
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
      bettingName: bettingName,
      runnerId: runnerId,
      isCommissionActive: matchBetting.isCommissionActive && domainUrl == oldBetFairDomain,
      childBetId: betId
    }
    await validateMatchBettingDetails(matchBetting, { ...betPlacedObj, mid, selectionId }, { placeIndex }, runners);

    //assigning bet id for cloned market
    betId = matchBetting?.parentBetId || betId;

    let userCurrentBalance = userBalanceData.currentBalance;
    let userRedisData = await getUserRedisData(reqUser.id);
    let matchExposure = userRedisData[redisKeys.userMatchExposure + matchId] ? parseFloat(userRedisData[redisKeys.userMatchExposure + matchId]) : 0.0;

    let userTotalExposure = matchExposure;

    let teamRates = userRedisData?.[`${betId}${redisKeys.profitLoss}_${matchId}`];

    if (teamRates) {
      teamRates = JSON.parse(teamRates);
    }

    if (!teamRates) {
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

    maximumLoss = Math.min(...Object.values(newTeamRateData), 0);

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

    if (matchBetting?.exposureLimit && Math.abs(maximumLoss) > parseFloat(matchBetting?.exposureLimit)) {
      logger.info({
        info: `User exceeded the limit of total exposure for this market`,
        userId: reqUser.id,
        marketExposure: maximumLoss,
        marketExposureLimit: matchBetting?.exposureLimit
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
    const job = MatchTournamentBetQueue.createJob(jobData);
    await job.save().then(data => {
      logger.info({
        info: `add match tournament betting job save in the redis for user ${reqUser.id}`,
        matchId, jobData
      });
    }).catch(error => {
      logger.error({
        error: `Error at match tournament betting job save in the redis for user ${reqUser.id}.`,
        stack: error.stack,
        message: error.message,
        errorFile: error
      });
      betPlacedService.deleteBetByEntityOnError(newBet);
      throw error;
    });

    if (!reqUser?.isDemo) {
      const walletJob = WalletMatchTournamentBetQueue.createJob(walletJobData);
      await walletJob.save().then(data => {
        logger.info({
          info: `add match tournament betting job save in the redis for wallet ${reqUser.id}`,
          matchId, walletJobData
        });
      }).catch(error => {
        logger.error({
          error: `Error at match tournament betting job save in the redis for wallet ${reqUser.id}.`,
          stack: error.stack,
          message: error.message,
          errorFile: error
        });
      });

      const expertJob = ExpertMatchTournamentBetQueue.createJob(walletJobData);
      await expertJob.save().then(data => {
        logger.info({
          info: `add match tournament betting job save in the redis for expert ${reqUser.id}`,
          matchId, walletJobData
        });
      }).catch(error => {
        logger.error({
          error: `Error at match tournament betting job save in the redis for expert ${reqUser.id}.`,
          stack: error.stack,
          message: error.message,
          errorFile: error
        });
        throw error;
      });
    }
    return SuccessResponse({ statusCode: 200, message: { msg: "betPlaced" }, data: newBet }, req, res)


  } catch (error) {
    logger.error({
      error: `Error at match tournament betting bet placed.`,
      stack: error?.stack,
      message: error?.message,
    });
    return ErrorResponse(error, req, res)
  }
}

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

    const matchDetail = await getMatchData({ id: matchId }, ["id", "eventId", "teamC"]);

    let sessionDetails;

    try {
      // Make an API call to fetch session details for the specified match
      let response = await getSessionDetailsHandler({ id: betId, matchId: matchId });

      // Extract session details from the API response
      sessionDetails = response?.data;
      sessionDetails.eventId = matchDetail?.eventId;
    } catch (err) {
      // Handle API call error and return an error response
      return ErrorResponse(err, req, res);
    }

    await validateSessionBet(sessionDetails, req.body, id);

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
    else if (sessionDetails?.type == sessionBettingType.khado) {
      if (sessionBetType == betType.BACK) {
        winAmount = parseFloat((stake * ratePercent) / 100).toFixed(2);
        loseAmount = parseFloat(stake);
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
    else if (sessionDetails?.type == sessionBettingType.meter) {
      if (sessionBetType == betType.YES) {
        winAmount = parseFloat((stake * ratePercent)).toFixed(2);
        loseAmount = parseFloat(stake * odds).toFixed(2);
      }
      else if (sessionBetType == betType.NO) {
        winAmount = parseFloat((stake * odds)).toFixed(2);
        loseAmount = parseFloat((stake * ratePercent)).toFixed(2);
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
        teamName: teamName,
        eventName: eventName,
        isTeamC: !!matchDetail?.teamC
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
      case sessionBettingType.khado:
        redisData = await calculateProfitLossKhado(
          sessionProfitLossData,
          betPlaceObject
        );
        break;
      case sessionBettingType.meter:
        redisData = await calculateProfitLossMeter(
          sessionProfitLossData,
          betPlaceObject
        );
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

    if (sessionDetails?.exposureLimit && parseFloat(redisData.maxLoss) > parseFloat(sessionDetails?.exposureLimit)) {
      logger.info({
        info: `User exceeded the limit of total exposure for a particular session`,
        currUserExpSession: totalExposure,
        marketExposureLimit: sessionDetails?.exposureLimit
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
    const domainUrl = `${process.env.GRPC_URL}`;

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
      isCommissionActive: sessionDetails?.isCommissionActive && domainUrl == oldBetFairDomain
    });

    let jobData = {
      userId: id,
      placedBet: placedBet,
      newBalance: newBalance,
      betPlaceObject: betPlaceObject,
      redisObject: redisObject,
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



    let walletJobData = {
      userId: id,
      partnership: userData?.partnerShips,
      placedBet: placedBet,
      newBalance: newBalance,
      userUpdatedExposure: parseFloat(parseFloat(betPlaceObject.maxLoss).toFixed(2)),
      betPlaceObject: betPlaceObject,
      domainUrl: domainUrl
    };

    if (!req.user?.isDemo) {
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

    }
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

const validateSessionBet = async (apiBetData, betDetails, userId) => {
  if (apiBetData?.stopAt) {
    throw {
      message: {
        msg: "bet.matchNotLive"
      }
    };
  }
  if (apiBetData.activeStatus != betStatusType.live) {
    throw {
      message: {
        msg: "bet.notLive"
      }
    };
  }


  if (apiBetData?.minBet == apiBetData?.maxBet) {
    throw {
      statusCode: 400,
      message: {
        msg: "bet.equalMinMax"
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

  let checkMarketLock = await userService.getUserMarketLock({ matchId: apiBetData.matchId, userId, sessionType: apiBetData.type });
  if (checkMarketLock) {
    logger.info({
      info: `user is blocked for the session market ${userId}, matchId ${apiBetData.matchId}, betId ${apiBetData.id}`,
      data: betDetails
    });
    throw {
      message: {
        msg: "user.marketLock"
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
      filterData = sessionDetail?.section?.find((item) => item.sid?.toString() == (parseInt(betDetail?.teamName?.split(" ")?.[0]) + 1)?.toString());
    }
    else {
      filterData = sessionDetail?.section?.find((item) => item.sid?.toString() == apiBetData?.selectionId?.toString());
    }
    if (filterData?.gstatus != "" && filterData?.gstatus != "OPEN") {
      return true;
    }

    if (sessionDetail?.mname == "oddeven") {
      if (
        (betDetail.teamName == "even") && (betDetail.odds != filterData?.odds?.find((item) => item.tno == betDetail?.betPlaceIndex && item.otype == "lay")?.odds)
      ) {
        return true;
      } else if (
        betDetail.teamName == "odd" && (betDetail.odds != filterData?.odds?.find((item) => item.tno == betDetail?.betPlaceIndex && item.otype == "back")?.odds)
      ) {
        return true;
      }
      return false;

    }
    else if (sessionDetail?.gtype == "cricketcasino") {
      if (
        (betDetail.betType == betType.BACK) && (betDetail.odds != filterData?.odds?.find((item) => item.tno == betDetail?.betPlaceIndex && item.otype == "back")?.odds)
      ) {
        return true;
      }
      return false;
    }
    else if (sessionDetail?.mname == "fancy1") {
      if (
        (betDetail.betType == betType.LAY) && (betDetail.odds != filterData?.odds?.find((item) => item.tno == betDetail?.betPlaceIndex && item.otype == "lay")?.odds)
      ) {
        return true;
      } else if (
        betDetail.betType == betType.BACK && (betDetail.odds != filterData?.odds?.find((item) => item.tno == betDetail?.betPlaceIndex && item.otype == "back")?.odds)
      ) {
        return true;
      }
      return false;

    }
    else {

      if (
        (betDetail.betType == betType.NO) && (betDetail.odds != filterData?.odds?.find((item) => item.tno == betDetail?.betPlaceIndex && item.otype == "lay")?.odds || betDetail.ratePercent != filterData?.odds?.find((item) => item.tno == betDetail?.betPlaceIndex && item.otype == "lay")?.size)
      ) {
        return true;
      } else if (
        betDetail.betType == betType.YES && (betDetail.odds != filterData?.odds?.find((item) => item.tno == betDetail?.betPlaceIndex && item.otype == "back")?.odds || betDetail.ratePercent != filterData?.odds?.find((item) => item.tno == betDetail?.betPlaceIndex && item.otype == "back")?.size)
      ) {
        return true;
      }
      return false;
    }
  } catch (error) {
    logger.info({
      info: `error at get session from provider ${betDetail.mid}`,
      error: error,
      stack: error.stack,
      message: error.message,
    });
    return true;
  }
  // check the rates of third party api
};

const validateMatchBettingDetails = async (matchBettingDetail, betObj, teams, runners) => {
  if (matchBettingDetail?.activeStatus != betStatusType.live || !matchBettingDetail?.isActive) {
    logger.info({
      info: `match betting details are not live. ${matchBettingDetail?.activeStatus}`,
    });
    throw {
      statusCode: 400,
      message: {
        msg: "bet.notLive"
      }
    };
  }

  if (matchBettingDetail?.minBet == matchBettingDetail?.maxBet) {
    throw {
      statusCode: 400,
      message: {
        msg: "bet.equalMinMax"
      }
    };
  }

  if (betObj.amount < matchBettingDetail?.minBet) {
    throw {
      statusCode: 400,
      message: {
        msg: "bet.minAmountViolate"
      }
    };
  }

  if (betObj.amount > matchBettingDetail?.maxBet || (matchBettingDetail.isManual && matchBettingDetail?.maxBet / (3 - teams.placeIndex) < betObj.amount)) {
    logger.info({
      info: `bookmaker max value for index.`,
    });
    throw {
      statusCode: 400,
      message: {
        msg: "bet.maxAmountViolate"
      }
    };
  }

  if (matchBettingDetail?.isManual) {
    isRateChange = await checkRate(betObj, runners, teams.placeIndex);
  } else {
    isRateChange = await CheckThirdPartyRate(matchBettingDetail, betObj, teams, matchBettingDetail?.name?.toLowerCase()?.includes("bookmaker"));
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

const checkRate = async (betObj, teams, placeIndex) => {
  let currRunner = teams.find((item) => item.id == betObj.runnerId);
  if (!currRunner) {
    return true;
  }
  if (placeIndex != 0) {
    currRunner.backRate = parseInt(currRunner.backRate);
    currRunner.layRate = parseInt(currRunner.layRate);
  }


  if (betObj.betType == betType.BACK && (currRunner.status != teamStatus.active || currRunner.backRate - placeIndex != betObj.odds)) {
    return true;
  }
  if (betObj.betType == betType.LAY && (currRunner.status != teamStatus.active || currRunner.layRate + placeIndex != betObj.odds)) {
    return true;
  }
  return false;

}

let calculateRacingUserExposure = (userOldExposure, oldTeamRate, newTeamRate) => {

  let minAmountNewRate = Math.min(...Object.values(newTeamRate), 0);
  let minAmountOldRate = Math.min(...Object.values(oldTeamRate), 0);

  let newExposure = userOldExposure - Math.abs(minAmountOldRate) + Math.abs(minAmountNewRate);
  return Number(newExposure.toFixed(2));
}

let CheckThirdPartyRate = async (matchBettingDetail, betObj, teams, isBookmakerMarket) => {
  let url = "";
  const microServiceUrl = microServiceDomain;
  try {

    url = microServiceUrl + allApiRoutes.MICROSERVICE.getAllRates[betObj?.eventType] + matchBettingDetail.eventId

    let data = await apiCall(apiMethod.get, url);

    const matchBettingData = data?.data?.find(
      (d) => d.mid?.toString() == betObj.mid?.toString()
    );
    let filterData = matchBettingData?.section?.find((item) => item?.sid?.toString() == betObj?.selectionId?.toString());
    if (filterData) {
      if (!['ACTIVE', 'OPEN', ''].includes(filterData.gstatus) || (!['ACTIVE', 'OPEN', ''].includes(matchBettingData.status) && matchBettingData?.gtype == "match")) {
        throw {
          statusCode: 400,
          message: {
            msg: "bet.notLive"
          }
        };
      }
      if (filterData?.odds?.find((item) => item.tno == teams?.placeIndex && item.otype == betObj?.betType?.toLowerCase())?.odds != betObj?.odds) {
        return true;
      }

      if (isBookmakerMarket) {
        let isThreeBoxRule = matchBettingData?.section.some(section => section.odds.length > 2 && section.odds.filter(odd => odd.size != 0).length > 2);
        // let oddLength = filterData?.odds?.filter((item) => item.otype == betObj?.betType?.toLowerCase() && item.size != 0)?.length;
        const percentages = [0.5, 0.75, 1]; // 100%, 75%, 50%
        if (isThreeBoxRule && matchBettingDetail?.maxBet * (percentages[index] || 1) < betObj.amount) {
          throw {
            statusCode: 400,
            message: {
              msg: "bet.maxAmountViolate"
            }
          };
        }
      }


      return false;
    }
    return true;

  }
  catch (error) {
    logger.info({
      info: `error at get rate from provider ${betObj.eventType} ${matchBettingDetail.eventId}`,
      error: error,
      stack: error.stack,
      message: error.message,
    });
    throw error;
  }
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
      if (selectionId == 6) {
        newCalculateOdd = bettingType == betType.BACK ? 90 : 105;
      }
      else if (selectionId == 5) {
        newCalculateOdd = 100;
      }
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
    await validateCardBettingDetails(match, betPlacedObj, selectionId, reqUser.id);

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

    let cardProfitLossAndExposure = new CardProfitLoss(match.type, teamRates, { bettingType: bettingType, winAmount: winAmount, lossAmount: lossAmount, playerName: betOnTeam, partnership: 100, sid: selectionId, rate: betPlacedObj?.rate }, userPreviousExposure).getCardGameProfitLoss()
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

    const domainUrl = `${process.env.GRPC_URL}`;

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

    if (!reqUser?.isDemo) {
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
    }
    await setCardBetPlaceRedis(betPlacedObj?.runnerId, domainUrl, 1);
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

const validateCardBettingDetails = async (match, betObj, selectionId, userId) => {
  let roundData = null;
  try {
    const url = casinoMicroServiceDomain + allApiRoutes.MICROSERVICE.casinoData + match?.type

    let data = await apiCall(apiMethod.get, url);
    roundData = data?.data;
  }
  catch (error) {
    logger.info({
      info: `error at get card rate from provider ${match?.type}`,
      error: error,
      stack: error.stack,
      message: error.message,
    });
    throw {
      message: {
        msg: "bet.notLive"
      }
    };
  }
  if ([cardGameType.lucky7, cardGameType.lucky7eu, cardGameType.cmeter].includes(match?.type)) {
    const bets = await betPlacedService.findAllPlacedBet({ runnerId: roundData?.t1?.[0]?.mid, createBy: userId });
    if (betObj?.teamName?.toLowerCase()?.includes("low") && bets?.find((item) => item?.teamName?.toLowerCase()?.includes("high"))) {
      throw {
        statusCode: 400,
        message: {
          msg: "bet.alreadyPlacedOnDiff",
          keys: { name: "High" }
        }
      };
    }
    else if (betObj?.teamName?.toLowerCase()?.includes("high") && bets?.find((item) => item?.teamName?.toLowerCase()?.includes("low"))) {
      throw {
        statusCode: 400,
        message: {
          msg: "bet.alreadyPlacedOnDiff",
          keys: { name: "Low" }
        }
      };
    }
  }
  if ([cardGameType.dt20, cardGameType.dt202].includes(match?.type)) {
    const bets = await betPlacedService.findAllPlacedBet({ runnerId: roundData?.t1?.[0]?.mid, createBy: userId });
    if (betObj?.teamName?.toLowerCase() == "dragon" && bets?.find((item) => item?.teamName?.toLowerCase() == "tiger")) {
      throw {
        statusCode: 400,
        message: {
          msg: "bet.alreadyPlacedOnDiff",
          keys: { name: "Tiger" }
        }
      };
    }
    else if (betObj?.teamName?.toLowerCase() == "tiger" && bets?.find((item) => item?.teamName?.toLowerCase() == "dragon")) {
      throw {
        statusCode: 400,
        message: {
          msg: "bet.alreadyPlacedOnDiff",
          keys: { name: "Dragon" }
        }
      };
    }
  }
  if ([cardGameType.aaa].includes(match?.type)) {
    const bets = await betPlacedService.findAllPlacedBet({ runnerId: roundData?.t1?.[0]?.mid, createBy: userId });
    if (betObj?.teamName?.toLowerCase()?.includes("under 7") && bets?.find((item) => item?.teamName?.toLowerCase()?.includes("over 7"))) {
      throw {
        statusCode: 400,
        message: {
          msg: "bet.alreadyPlacedOnDiff",
          keys: { name: "Over 7" }
        }
      };
    }
    else if (betObj?.teamName?.toLowerCase()?.includes("over 7") && bets?.find((item) => item?.teamName?.toLowerCase()?.includes("under 7"))) {
      throw {
        statusCode: 400,
        message: {
          msg: "bet.alreadyPlacedOnDiff",
          keys: { name: "Under 7" }
        }
      };
    }
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
  else if (match?.type == cardGameType.teen9) {
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

  betObj.runnerId = roundData?.t1?.[0]?.mid || roundData?.t1?.mid;
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
      return ((betObj.betType == betType.BACK && (Math.round(((parseFloat(currData.b1) * 0.01) + 1) * 100) / 100) != parseFloat(betObj.odds)) || (betObj.betType === betType.LAY && (Math.round(((parseFloat(currData.l1) * 0.01) + 1) * 100) / 100) != parseFloat(betObj.odds)))
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
