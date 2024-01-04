const betPlacedService = require('../services/betPlacedService');
const userService = require('../services/userService');
const { ErrorResponse, SuccessResponse } = require('../utils/response')
const { betStatusType, teamStatus, matchBettingType, betType, redisKeys, betResultStatus, marketBetType, userRoleConstant } = require("../config/contants");
const { logger } = require("../config/logger");
const { getUserRedisData, updateMatchExposure } = require("../services/redis/commonfunction");
const { getUserById } = require("../services/userService");
const { apiCall, apiMethod, allApiRoutes } = require("../utils/apiService");
const { calculateRate } = require('../services/commonService');
const { MatchBetQueue, WalletMatchBetQueue } = require('../queue/consumer');
const { In, Not } = require('typeorm');
let lodash = require("lodash");

// Default expert domain URL, fallback to localhost if not provided
let expertDomain = process.env.EXPERT_DOMAIN_URL || "http://localhost:6060";

exports.getBet = async (req, res) => {
  try {
    const reqUser = req.user
    let query=req.query;
    let where = {};
    let result;
    let select = [
      "betPlaced.id","betPlaced.eventName","betPlaced.teamName","betPlaced.betType","betPlaced.amount","betPlaced.rate","betPlaced.winAmount","betPlaced.lossAmount","betPlaced.createdAt","betPlaced.eventType","betPlaced.marketType","betPlaced.odds","betPlaced.marketBetType","betPlaced.result"
    ]

    if(query.status && query.status == "MATCHED"){
       where.result =  In([betResultStatus.LOSS,betResultStatus.TIE,betResultStatus.WIN]); 
       query = lodash.omit(query,['status']);
    }
    else if(query.status && query.status == betResultStatus.PENDING){
      where.result = betResultStatus.PENDING;
      query = lodash.omit(query,['status']);
    }
    else if(query.status && query.status == "DELETED"){
      where.deleteReason = Not(null);
      where.result = betResultStatus.UNDECLARE;
      query = lodash.omit(query,['status']);
    }else{
      query = lodash.omit(query,['status']);
    }

    if (reqUser.roleName == userRoleConstant.user) {
      where.createBy=  reqUser.id ;
      result = await betPlacedService.getBet(where,query,reqUser.roleName,select);
    }else{
      let childsId = await userService.getChildsWithOnlyUserRole(reqUser.id);
      childsId = childsId.map(item => item.id);
      if(!childsId.length){
        return SuccessResponse({ statusCode: 200, message: { msg: "fetched", keys: { type: "Bet" } }, data: {
          count: 0,
          rows: []
        } }, req, res)
      }
      select.push("user.id","user.userName");
      where.createBy = In(childsId);
      result = await betPlacedService.getBet(where,query,reqUser.roleName,select);
    }
    if (!result[1]) return SuccessResponse({ statusCode: 200, message: { msg: "fetched", keys: { type: "Bet" } }, data: {
      count: 0,
      rows: []
    } }, req, res)
    
    return SuccessResponse({ statusCode: 200, message: { msg: "fetched", keys: { type: "Bet" } }, data: {
      count : result[1],
      rows  : result[0]
    } }, req, res)
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
    if (matchBetType == matchBettingType.matchOdd) {
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
      eventName : match.title,
      eventType : match.matchType
    }
    await validateMatchBettingDetails(match, matchBetting, betPlacedObj, { teamA, teamB, teamC, placeIndex });
    const teamArateRedisKey = redisKeys.userTeamARate + matchId;
    const teamBrateRedisKey = redisKeys.userTeamBRate + matchId;
    const teamCrateRedisKey = redisKeys.userTeamCRate + matchId;
    let userCurrentBalance = userBalanceData.currentBalance;
    let userRedisData = await getUserRedisData(reqUser.id);
    let matchExposure = userRedisData[redisKeys.userMatchExposure + matchId] ?? 0.0;
    let sessionExposure = userRedisData[redisKeys.userSessionExposure + matchId] ?? 0.0;
    let userTotalExposure = matchExposure + sessionExposure;
    let teamRates = {
      teamA: Number(userRedisData[teamArateRedisKey]) || 0.0,
      teamB: Number(userRedisData[teamBrateRedisKey]) || 0.0,
      teamC: Number(userRedisData[teamCrateRedisKey]) || 0.0
    }
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
    let walletJobData = {
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

    validateSessionBet(sessionDetails, req.body);

    let winAmount = 0,
      loseAmount = 0;

    // Calculate win and lose amounts based on the bet type
    if (sessionBetType == betType.YES) {
      winAmount = parseFloat((stake * ratePercent) / 100).toFixed(2);
      loseAmount = stake;
    } else if (sessionBetType == betType.NO) {
      winAmount = stake;
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
      winAmount,
      loseAmount,
      betPlacedData: {
        userName: user.userName,
        odds: odds,
        betType: sessionBetType,
        stake: stake,
        matchId: matchId,
        betId: betId,
        rate: ratePercent,
      },
      userBalance: userData?.currentBalance || 0,
    };

    const totalExposure = userData?.exposure || 0;

    logger.info({
      message: "Exposure and balance of user before calculation: ",
      userBalance: userData?.currentBalance || 0,
      totalExposure: userData?.exposure || 0,
    });

    let sessionProfitLossData = userData[`${betId}_profitLoss`];
    let maxSessionLoss = 0.0;
    if (sessionProfitLossData) {
      sessionProfitLossData = JSON.parse(sessionProfitLossData);
      maxSessionLoss = parseFloat(sessionProfitLossData['maxLoss']);
    }

    let redisData = await calculateProfitLossSession(
      sessionProfitLossData,
      betPlaceObject
    );

    betPlaceObject.maxLoss = Math.abs(redisData.maxLoss - maxSessionLoss);
    let redisSessionExp = Number(
      (sessionExp + redisData?.maxLoss - maxSessionLoss).toFixed(2)
    );
    let redisObject = {
      [`${redisKeys.userSessionExposure}${matchId}`]: redisSessionExp,
    };
    let newBalance =
      parseFloat(userData?.currentBalance).toFixed(2) -
      (totalExposure + redisData?.maxLoss - maxSessionLoss);

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

    await internalRedis.hset(user.id,redisObject);

    await betPlacedService.addNewBet({
      matchId:matchId,
      betId:betId,
      amount:stake,
      odds:odds,
      winAmount:winAmount,
      lossAmount:loseAmount,
      betType:sessionBetType,
      rate:ratePercent,
      marketType:sessionDetails?.name,
      marketBetType:marketBetType.SESSION,
      ipAddress:ipAddress,
      browserDetail:browserDetail,
      eventName:eventName,
      eventType:eventType
    });


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


/**
 * Calculates the profit or loss for a betting session.
 * @param {object} redisProfitLoss - Redis data for profit and loss.
 * @param {object} betData - Data for the current bet.
 * @returns {object} - Object containing upper and lower limit odds, and the updated bet placed data.
 */
const calculateProfitLossSession = async (redisProfitLoss, betData) => {
  /**
   * Calculates the profit or loss for a specific bet at given odds.
   * @param {object} betData - Data for the current bet.
   * @param {number} odds - Odds for the current bet.
   * @returns {number} - Profit or loss amount.
   */
  let maxLoss=0;
  const calculateProfitLoss = (betData, odds) => {
    if (
      (betData?.betPlacedData?.betType === betType.NO && odds < betData?.betPlacedData?.odds) ||
      (betData?.betPlacedData?.betType === betType.YES && odds >= betData?.betPlacedData?.odds)
    ) {
      return betData?.winAmount;
    } else if (
      (betData?.betPlacedData?.betType === betType.NO && odds >= betData?.betPlacedData?.odds) ||
      (betData?.betPlacedData?.betType === betType.YES && odds < betData?.betPlacedData?.odds)
    ) {
      return -betData.loseAmount;
    }
    return 0;
  };

  /**
   * Gets the lower limit for the current bet data.
   * @param {object} betData - Data for the current bet.
   * @returns {number} - Lower limit for the odds.
   */
  const getLowerLimitBetData = (betData) => Math.max(0, betData?.betPlacedData?.odds - 5);

  /**
   * Creates an array of objects representing a range of odds with default profit/loss value.
   * @param {number} start - Starting value of the range.
   * @param {number} end - Ending value of the range.
   * @param {number} defaultValue - Default profit/loss value.
   * @returns {Array} - Array of objects representing the odds and profit/loss for each entry in the range.
   */
  const createRangeObjects = (start, end, defaultValue) => {
    return Array(Math.abs(end - start))
      .fill(0)
      ?.map((_, index) => {
        if (maxLoss < Math.abs(defaultValue) && defaultValue < 0) {
          maxLoss = Math.abs(defaultValue);
        }
        return {
          odds: start + index,
          profitLoss: defaultValue,
        };
      });
  };

  // Calculate lower and upper limits
  const lowerLimit = getLowerLimitBetData(betData) < (redisProfitLoss?.lowerLimitOdds ?? 0)
    ? getLowerLimitBetData(betData)
    : redisProfitLoss?.lowerLimitOdds ?? getLowerLimitBetData(betData);

  const upperLimit = betData?.betPlacedData?.odds + 5 > (redisProfitLoss?.upperLimitOdds ?? betData?.betPlacedData?.odds + 5)
    ? betData?.betPlacedData?.odds + 5
    : redisProfitLoss?.upperLimitOdds ?? betData?.betPlacedData?.odds + 5;

  let betProfitloss = redisProfitLoss?.betPlaced ?? [];

  // Adjust betPlaced based on lower limit changes
  if (redisProfitLoss?.lowerLimitOdds > lowerLimit) {
    betProfitloss = [
      ...createRangeObjects(lowerLimit, redisProfitLoss?.lowerLimitOdds ?? 0, betProfitloss[0]?.profit_loss),
      ...betProfitloss,
    ];
  }

  // Adjust betPlaced based on upper limit changes
  if (upperLimit > redisProfitLoss?.upperLimitOdds) {
    betProfitloss = [
      ...betProfitloss,
      ...createRangeObjects(
        redisProfitLoss?.upperLimitOdds ?? 0,
        upperLimit,
        betProfitloss[betProfitloss?.length - 1]?.profit_loss
      ),
    ];
  }

  // Initialize or update betPlaced if it's empty or not
  if (!betProfitloss) {
    betProfitloss = createRangeObjects(lowerLimit, upperLimit, calculateProfitLoss(betData, lowerLimit));
  } else {
    betProfitloss = betProfitloss?.map((item) => ({
      odds: item?.odds,
      profitLoss: calculateProfitLoss(betData, item?.odds),
    }));
  }
  maxLoss = Number(maxLoss.toFixed(2));
  // Return the result
  return {
    upperLimitOdds: upperLimit,
    lowerLimitOdds: lowerLimit,
    betPlaced: redisProfitLoss,
    maxLoss: maxLoss
  };
};





const validateSessionBet = async (apiBetData, betDetails) => {
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
          msg: "bet.notLive"
        }
      };
    }
    else {
      // check the rates of third party api
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
      (betDetails.sessionBetType == betType.no &&
        betDetails.odds != apiBetData.noRate) ||
      (betDetails.sessionBetType == betType.yes &&
        betDetails.odds != apiBetData.yesRate) ||
      (apiBetData.status != null && apiBetData.status != teamStatus.active)
    ) {
      throw {
        statusCode: 400,
        message: {
          msg: "marketRateChanged",
          keys: {
            marketType: "Session",
          },
        },
      };
    }
  }
}


const validateMatchBettingDetails = async (matchDetail, matchBettingDetail, betObj, teams) => {

  if (matchBettingDetail.activeStatus != betStatusType.live) {
    throw {
      statusCode: 400,
      message: {
        msg: "bet.notLive"
      }
    };
  }
  else if (betObj.amount < matchBettingDetail.minBet) {
    throw {
      statusCode: 400,
      message: {
        msg: "bet.minAmountViolate"
      }
    };
  }
  else if (betObj.amount > matchBettingDetail.maxBet) {
    throw {
      statusCode: 400,
      message: {
        msg: "bet.maxAmountViolate"
      }
    };
  }
  else {
    let isRateChange = await checkRate(matchDetail, matchBettingDetail, betObj, teams);
    if (isRateChange) {
      throw {
        statusCode: 400,
        message: {
          msg: "marketRateChanged",
          keys: {
            marketType: "Match betting",
          },
        },
      };
    }
  }

}

const checkRate = async (matchDetails, matchBettingDetail, betObj, teams) => {
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