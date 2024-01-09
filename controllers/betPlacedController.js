const betPlacedService = require('../services/betPlacedService');
const userService = require('../services/userService');
const { ErrorResponse, SuccessResponse } = require('../utils/response')
const { betStatusType, teamStatus, matchBettingType, betType, redisKeys, betResultStatus, marketBetType, userRoleConstant, manualMatchBettingType, expertDomain, partnershipPrefixByRole } = require("../config/contants");
const { logger } = require("../config/logger");
const { getUserRedisData, updateMatchExposure, updateUserDataRedis } = require("../services/redis/commonfunction");
const { getUserById } = require("../services/userService");
const { apiCall, apiMethod, allApiRoutes } = require("../utils/apiService");
const { calculateRate, calculateProfitLossSession } = require('../services/commonService');
const { MatchBetQueue, WalletMatchBetQueue, SessionMatchBetQueue, WalletSessionBetQueue, ExpertSessionBetQueue, ExpertMatchBetQueue } = require('../queue/consumer');
const { In, Not } = require('typeorm');
let lodash = require("lodash");
const { updateUserBalanceByUserId } = require('../services/userBalanceService');
const { sendMessageToUser } = require('../sockets/socketManager');

exports.getBet = async (req, res) => {
  try {
    const reqUser = req.user
    let query = req.query;
    let where = {};
    let result;
    let select = [
      "betPlaced.id", "betPlaced.eventName", "betPlaced.teamName", "betPlaced.betType", "betPlaced.amount", "betPlaced.rate", "betPlaced.winAmount", "betPlaced.lossAmount", "betPlaced.createdAt", "betPlaced.eventType", "betPlaced.marketType", "betPlaced.odds", "betPlaced.marketBetType", "betPlaced.result"
    ]

    if (query.status && query.status == "MATCHED") {
      where.result = In([betResultStatus.LOSS, betResultStatus.TIE, betResultStatus.WIN]);
      query = lodash.omit(query, ['status']);
    }
    else if (query.status && query.status == betResultStatus.PENDING) {
      where.result = betResultStatus.PENDING;
      query = lodash.omit(query, ['status']);
    }
    else if (query.status && query.status == "DELETED") {
      where.deleteReason = Not(null);
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
      select.push("user.id", "user.userName");
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

exports.matchBettingBetPlaced = async (req, res) => {
  try {
    logger.info({
      info: `match betting bet placed`,
      data: req.body
    });
    let reqUser = req.user;
    let { teamA, teamB, teamC, stake, odd, betId, bettingType, matchBetType, matchId, betOnTeam, ipAddress, browserDetail, placeIndex } = req.body;

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
    let newCalculateOdd = odd;
    let winAmount = 0, lossAmount = 0;
    if ([matchBettingType.matchOdd,matchBettingType.tiedMatch1,matchBettingType.completeMatch]?.includes(matchBetType)) {
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
      ipAddress,
      browserDetail,
      eventName: match.title,
      eventType: match.matchType
    }
    await validateMatchBettingDetails(matchBetting, betPlacedObj, { teamA, teamB, teamC, placeIndex });
    const teamArateRedisKey =
      matchBetType == (matchBettingType.tiedMatch1 ||
      matchBetType == matchBettingType.tiedMatch2
        ? redisKeys.yesRateTie
        : matchBetType == matchBettingType.completeMatch
        ? redisKeys.yesRateComplete
        : redisKeys.userTeamARate) + matchId;
    const teamBrateRedisKey =(
      matchBetType == matchBettingType.tiedMatch1 ||
      matchBetType == matchBettingType.tiedMatch2
        ? redisKeys.noRateTie
        : matchBetType == matchBettingType.completeMatch
        ? redisKeys.noRateComplete
        : redisKeys.userTeamBRate) + matchId;
    const teamCrateRedisKey =matchBetType == matchBettingType.tiedMatch1 ||
    matchBetType == matchBettingType.tiedMatch2||matchBetType == matchBettingType.completeMatch?null: redisKeys.userTeamCRate + matchId;
   

    let userCurrentBalance = userBalanceData.currentBalance;
    let userRedisData = await getUserRedisData(reqUser.id);
    let matchExposure = userRedisData[redisKeys.userMatchExposure + matchId] ?? 0.0;
    let sessionExposure = userRedisData[redisKeys.userSessionExposure + matchId] ?? 0.0;
    let userTotalExposure = matchExposure + sessionExposure;


   
      let teamRates = {
        teamA: Number(userRedisData[teamArateRedisKey]) || 0.0,
        teamB: Number(userRedisData[teamBrateRedisKey]) || 0.0,
        teamC: teamCrateRedisKey? Number(userRedisData[teamCrateRedisKey]) || 0.0 : 0.0 
      };
    
    let userPreviousExposure = userRedisData[redisKeys.userAllExposure] || 0.0;
    let userOtherMatchExposure = userPreviousExposure - userTotalExposure;
    let userExposureLimit = userRedisData[redisKeys.userExposureLimit];

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
      newBet
    }

    const domainUrl = `${req.protocol}://${ req.get('host')}`;

    let walletJobData = {
      domainUrl:domainUrl,
      partnerships: userRedisData.partnerShips,
      userId: reqUser.id,
      newUserExposure, userPreviousExposure,
      winAmount, lossAmount, teamRates,
      bettingType, betOnTeam, teamA, teamB, teamC, teamArateRedisKey, teamBrateRedisKey, teamCrateRedisKey, newBet
    }
    //add redis queue function
    const job = MatchBetQueue.createJob(jobData);
    await job.save();

    const walletJob = WalletMatchBetQueue.createJob(walletJobData);
    await walletJob.save();

    const expertJob = ExpertMatchBetQueue.createJob(walletJobData);
    await expertJob.save();
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

    totalExposure +=parseFloat( parseFloat(
      betPlaceObject.maxLoss
    ).toFixed(2));

    let redisObject = {
      [`${redisKeys.userSessionExposure}${matchId}`]: redisSessionExp,
      [`${betId}_profitLoss`]: JSON.stringify(redisData),
      exposure: totalExposure,
    };

    let newBalance =
      parseFloat(userData?.currentBalance).toFixed(2) - totalExposure;

    betPlaceObject.diffSessionExp = redisSessionExp - sessionExp;

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

    await updateUserBalanceByUserId(id, {
      exposure: totalExposure,
    });

    await updateUserDataRedis(id, redisObject);

    const placedBet = await betPlacedService.addNewBet({
      matchId: matchId,
      betId: betId,
      amount: stake,
      odds: odds,
      winAmount: winAmount,
      lossAmount: loseAmount,
      betType: sessionBetType,
      rate: ratePercent,
      marketType: sessionDetails?.name,
      marketBetType: marketBetType.SESSION,
      ipAddress: ipAddress,
      browserDetail: browserDetail,
      eventName: eventName,
      eventType: eventType,
      userId: id,
      createBy: id,
    });


    //add redis queue function
    const job = SessionMatchBetQueue.createJob({
      userId:id,
      placedBet:placedBet,
      newBalance:newBalance,
      betPlaceObject:betPlaceObject
    });
    await job.save();


    const domainUrl = `${req.protocol}://${req.get('host')}`;

    const walletJob = WalletSessionBetQueue.createJob({
      userId: id,
      partnership: userData?.partnerShips,
      placedBet: placedBet,
      newBalance: newBalance,
      betPlaceObject: betPlaceObject,
      domainUrl: domainUrl
    });
    await walletJob.save();


    const expertJob = ExpertSessionBetQueue.createJob({
      userId: id,
      partnership: userData?.partnerShips,
      placedBet: placedBet,
      newBalance: newBalance,
      betPlaceObject: betPlaceObject,
      domainUrl: domainUrl
    });
    await expertJob.save();

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


const validateSessionBet =async (apiBetData, betDetails) => {
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

const checkApiSessionRates = async(apiBetData, betDetail) => {
  const microServiceUrl = process.env.MICROSERVICEURL;
  try {
    let data =await apiCall(
      apiMethod.get,
      microServiceUrl + "session/" + apiBetData.marketId
    );
    let filterData = data?.data?.find(
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
  if (betObj.betType == betType.BACK && teams.teamA == betObj.teamName && matchBettingDetail.backTeamA - teams.placeIndex != betObj.odds) {
    return true;
  }
  else if (betObj.betType == betType.BACK && teams.teamB == betObj.teamName && matchBettingDetail.backTeamB - teams.placeIndex != betObj.odds) {
    return true;
  }
  else if (betObj.betType == betType.LAY && teams.teamA == betObj.teamName && matchBettingDetail.layTeamA + teams.placeIndex != betObj.odds) {
    return true;
  }
  else if (betObj.betType == betType.LAY && teams.teamB == betObj.teamName && matchBettingDetail.layTeamB + teams.placeIndex != betObj.odds) {
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
  const microServiceUrl = process.env.MICROSERVICEURL;
  try {
  if (matchBettingDetail.type == matchBettingType.bookmaker) {
    url = microServiceUrl + allApiRoutes.MICROSERVICE.bookmaker + matchBettingDetail.marketId

  }
  else{
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
    catch(error){
      throw{
        message: {
          msg: "bet.notLive"
        }
      };
   }
}

exports.deleteMultipleBet = async (req, res) => {
  try {
    console.log(req.body);
    const {
      matchId, data, deleteReason
    } = req.body;
    // const { id } = req.user;
    if(data.length == 0){
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
    let placedBet = await betPlacedService.findAllPlacedBet(matchId, placedBetIdArray);
    await betPlacedService.updatePlaceBet({ matchId: matchId, id: In(placeBetIdArray) }, { deleteReason: deleteReason});
    let updateObj = {};
    placedBet.map(bet => {
      let isSessionBet = false;
      if (bet.betType == betType.YES || bet.betType == betType.NO) {
        isSessionBet = true;
      }
      if (!updateObj[bet.user_id]) {
        updateObj[bet.user_id] = { [bet.bet_id]: { isSessionBet: isSessionBet, array: [bet] } };
      } else {
        if (!updateObj[bet.user_id][bet.bet_id]) {
          updateObj[bet.user_id][bet.bet_id] = { isSessionBet: isSessionBet, array: [bet] };
        } else {
          updateObj[bet.user_id][bet.bet_id].array.push(bet);
        }
      }
    });

    if (Object.keys(updateObj).length > 0) {
      for (let key in updateObj) {
          let userId = key;
          let userDataDelete = updateObj[key];
          for (let value in userDataDelete) {
              let betId = value;
              let bet = userDataDelete[value];
              if (bet.isSessionBet) {
                  await updateUserAtSession(userId, betId, matchId, bet.array, deleteReason);
              } else {
                  await this.updateUserAtMatchOdds(userId, betId, matchId, bet.array, deleteReason);
              }
          };
      }
  }

  } catch (error) {
     logger.error({
      error: `Error at delete bet for the user.`,
      stack: error.stack,
      message: error.message,
    });
    return ErrorResponse(error, req, res);
  }
}

const updateUserAtSession = async (userId, betId, matchId, bets, deleteReason) => {
  let userRedisData = await getUserRedisData(userId);
  let isUserLogin = userRedisData ? true : false;
  let userOldExposure = 0;

  if (isUserLogin) {
    // userRedisData['partnerShips'] = userRedisData.partnerShips;
    // userRedisData['roleName'] = userRedisData.roleName;
    userOldExposure = parseFloat(userRedisData.exposure);
    // await this.redis.hmset(userId, userRedisData);
  } else {
    let user = await this.userService.findUserBy({ id: userId });
    let userPartnerships = await this.userService.findUserPartnerShipObj(user, userRole );
    userOldExposure = user.exposure;
  }
  let redisName = `${betId}_profitLoss`;
  let socketSessionEvent = "sessionDeleteBet";
  // await this.calcualteAndSendBetData(user, userRedisData, userId, betId, redisName, match_id, socketSessionEvent, placedBetIdArray, deleted_reason);
  logger.info({
    message: "updateUserAtSession function called",
    userRedisData,
    userId
  });
  let partnershipObj = JSON.parse(userRedisData.partnerShips);
  
  let redisSesionExposureName = redisSesionExposure + matchId;
  let oldSessionExposure = userRedisData[redisSesionExposureName];
  let oldProfitLoss = userRedisData[redisName];
  let oldMaxLoss = 0;
  if(oldProfitLoss){
    oldProfitLoss = JSON.parse(oldProfitLoss);
    oldMaxLoss = parseFloat(oldProfitLoss.maxLoss);
  }
  let oldLowerLimitOdds = parseFloat(oldProfitLoss.lowerLimitOdds);
  let oldUpperLimitOdds = parseFloat(oldProfitLoss.upperLimitOdds);
  let userDeleteProfitLoss = await calculatePLAllBet(bets, 100, oldLowerLimitOdds, oldUpperLimitOdds);

  let oldBetPlacedPL = oldProfitLoss.betPlaced;
  let newMaxLoss = 0;
  for (let i = 0; i < oldBetPlacedPL.length; i++) {
    oldBetPlacedPL[i].profitLoss = oldBetPlacedPL[i].profitLoss - userDeleteProfitLoss.betData[i].profitLoss;
    if (newMaxLoss < Math.abs(oldBetPlacedPL[i].profitLoss) && oldBetPlacedPL[i].profitLoss < 0) {
      newMaxLoss = Math.abs(oldBetPlacedPL[i].profitLoss);
    }
  }
  oldProfitLoss.betPlaced = oldBetPlacedPL;
  oldProfitLoss.maxLoss = newMaxLoss;
  let redisObject = {
    [redisSesionExposureName] : oldSessionExposure - oldMaxLoss + newMaxLoss,
    exposure : userOldExposure - oldMaxLoss + newMaxLoss,
    [redisName] : oldProfitLoss
  }
  await updateUserDataRedis(userId, redisObject);
  sendMessageToUser(userId, socketSessionEvent, { 
    currentBalance: userRedisData?.currentBalance,
    exposure: redisObject?.exposure,
    sessionExposure: redisObject[redisSesionExposureName],
    totalComission: userRedisData?.totalComission,
    profitLoss: oldProfitLoss,
    bets :bets,
    deleteReason: deleteReason
   });

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
            let partnerExposure = partnerUser.exposure - maxLossExposure;
            await updateUserBalanceByUserId(partnershipId, {
              exposure: partnerExposure,
            });
          } else {
            // If masterRedisData exists, update partner exposure and session data
            let masterExposure = parseFloat(masterRedisData.exposure) ?? 0;
            let partnerExposure = masterExposure + maxLossExposure;
            await updateUserBalanceByUserId(partnershipId, {
              exposure: partnerExposure,
            });

            // Calculate profit loss session and update Redis data
            const redisBetData = masterRedisData[
              `${placedBetObject?.betPlacedData?.betId}_profitLoss`
            ]
              ? JSON.parse(
                  masterRedisData[
                    `${placedBetObject?.betPlacedData?.betId}_profitLoss`
                  ]
                )
              : null;

            let redisData = await calculateProfitLossSession(
              redisBetData,
              placedBetObject,
              partnership
            );

            await updateUserDataRedis(partnershipId, {
              [`${placedBetObject?.betPlacedData?.betId}_profitLoss`]:
                JSON.stringify(redisData),
              exposure: partnerExposure,
              [`${redisKeys.userSessionExposure}${placedBetObject?.betPlacedData?.matchId}`]:
                parseFloat(
                  masterRedisData?.[
                    `${redisKeys.userSessionExposure}${placedBetObject?.betPlacedData?.matchId}`
                  ] || 0
                ) + partnerSessionExposure,
            });

            // Log information about exposure and stake update
            logger.info({
              context: "Update User Exposure and Stake",
              process: `User ID : ${userId} ${item} id ${partnershipId}`,
              data: `My Stake : ${(
                (stake * parseFloat(partnership)) /
                100
              ).toFixed(2)}`,
            });

            // Update jobData with calculated stake
            jobData.betPlaceObject.myStack = (
              (stake * parseFloat(partnership)) /
              100
            ).toFixed(2);

            // Send data to socket for session bet placement
            sendMessageToUser(partnershipId, socketData.SessionBetPlaced, {
              userRedisData,
              jobData,
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


}