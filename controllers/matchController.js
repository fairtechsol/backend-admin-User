const { In } = require("typeorm");
const { expertDomain, redisKeys, userRoleConstant, oldBetFairDomain, redisKeysMatchWise, microServiceDomain, casinoMicroServiceDomain, partnershipPrefixByRole, cardGameType } = require("../config/contants");
const { findAllPlacedBet, getChildUsersPlaceBets } = require("../services/betPlacedService");
const { getUserRedisKeys, getUserRedisSingleKey, updateUserDataRedis, getHashKeysByPattern } = require("../services/redis/commonfunction");
const { getChildsWithOnlyUserRole, getUsers, getChildUser } = require("../services/userService");
const { apiCall, apiMethod, allApiRoutes } = require("../utils/apiService");
const { SuccessResponse, ErrorResponse } = require("../utils/response");
const { logger } = require("../config/logger");
const { listMatch } = require("../services/matchService");
const { getCardMatch } = require("../services/cardMatchService");
const { calculateProfitLossForCardMatchToResult } = require("../services/commonService");

exports.matchDetails = async (req, res) => {
  try {
    const matchId = req.params.id;
    let domain = expertDomain;
    let apiResponse = {};
    const { id: userId } = req.user;
    try {
      apiResponse = await apiCall(
        apiMethod.get,
        domain + allApiRoutes.MATCHES.matchDetails + matchId
      );
    } catch (error) {
      throw error?.response?.data;
    }

    if (apiResponse?.data) {
      if (Array.isArray(apiResponse?.data)) {
        for (let i = 0; i < apiResponse?.data?.length; i++) {
          const matchId = apiResponse?.data?.[i]?.id;
          const redisIds = apiResponse?.data?.[i]?.sessionBettings?.map((item) => JSON.parse(item)?.id + redisKeys.profitLoss);
          // redisIds.push(...[`${redisKeys.userTeamARate}${matchId}`, `${redisKeys.userTeamBRate}${matchId}`, `${redisKeys.userTeamCRate}${matchId}`, `${redisKeys.yesRateComplete}${matchId}`, `${redisKeys.noRateComplete}${matchId}`, `${redisKeys.yesRateTie}${matchId}`, `${redisKeys.noRateTie}${matchId}`]);
          let redisData = [];
          if (redisIds?.length > 0) {
            redisData = await getUserRedisKeys(userId, redisIds);
          }
          let sessionResult = [];
          let matchResult = await getHashKeysByPattern(userId, `*_${matchId}`);
          redisData?.forEach((item, index) => {
            if (item) {
            
                sessionResult.push({
                  betId: redisIds?.[index]?.split("_")[0],
                  maxLoss: JSON.parse(item)?.maxLoss,
                  totalBet: JSON.parse(item)?.totalBet,
                  profitLoss: JSON.parse(item)?.betPlaced,
                });
              
            }
          });
          apiResponse.data[i].profitLossDataSession = sessionResult;
          apiResponse.data[i].profitLossDataMatch = matchResult;
        }
      }
      else {
        const redisIds = apiResponse?.data?.sessionBettings?.map((item) => JSON.parse(item)?.id + redisKeys.profitLoss);
        let redisData = [];
        if (redisIds?.length > 0) {
          redisData = await getUserRedisKeys(userId, redisIds);
        }
        let sessionResult = [];
        let matchResult = await getHashKeysByPattern(userId, `*_${matchId}`);;
        redisData?.forEach((item, index) => {
          if (item) {

            sessionResult.push({
              betId: redisIds?.[index]?.split("_")[0],
              maxLoss: JSON.parse(item)?.maxLoss,
              totalBet: JSON.parse(item)?.totalBet,
                profitLoss: JSON.parse(item)?.betPlaced,
              });
            }
          
        });
        apiResponse.data.profitLossDataSession = sessionResult;
        apiResponse.data.profitLossDataMatch = matchResult;
      }
    }


    return SuccessResponse(
      {
        statusCode: 200,
        message: { msg: "match details", keys: { name: "Match" } },
        data: apiResponse.data,
      },
      req,
      res
    );

  } catch (err) {
    return ErrorResponse(err, req, res);
  }
};

exports.raceDetails = async (req, res) => {
  try {
    let userId = req.user.id;
    const raceId = req.params.id;
    let domain = expertDomain;
    let apiResponse = {};
    try {
      apiResponse = await apiCall(
        apiMethod.get,
        domain + allApiRoutes.MATCHES.raceDetails + raceId
      );
    } catch (error) {
      throw error?.response?.data;
    }

    if (apiResponse?.data) {
      if (Array.isArray(apiResponse?.data)) {
        for (let [index, matchData] of apiResponse?.data?.entries() || []) {
          const matchId = matchData?.id;
        
          let redisData = await getUserRedisSingleKey(userId, `${matchId}${redisKeys.profitLoss}`);
          if (redisData) {
            redisData = JSON.parse(redisData);
          }
          apiResponse.data[index].profitLossDataMatch = redisData;
        }
      }
      else {
        const matchId = apiResponse?.data?.id;
        let redisData = await getUserRedisSingleKey(userId, `${matchId}${redisKeys.profitLoss}`);
        
        if (redisData) {
          redisData = JSON.parse(redisData);
        }
        apiResponse.data.profitLossDataMatch = redisData;
      }
    }

    return SuccessResponse(
      {
        statusCode: 200,
        data: apiResponse.data,
      },
      req,
      res
    );

  } catch (err) {
    return ErrorResponse(err, req, res);
  }
};

exports.cardMatchDetails = async (req, res) => {
  try {
    const { type } = req.params;

    let casinoDetails = await getCardMatch({ type: type });

    let roundData = null;
    try {
      const url = casinoMicroServiceDomain + allApiRoutes.MICROSERVICE.casinoData + type

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
    try {
      const url = casinoMicroServiceDomain + allApiRoutes.MICROSERVICE.cardTopTenResultDetail + type

      let data = await apiCall(apiMethod.get, url);
      casinoDetails.topTenResult = data?.data;
    }
    catch (error) {
      throw {
        message: {
          msg: "bet.notLive"
        }
      };
    }

    if (casinoDetails) {
      let cardRedisKeys ;
      if (type == cardGameType.teen) {
        cardRedisKeys = roundData?.t1?.map((item) => `${roundData?.t1?.[0]?.mid}_${item?.sid}${redisKeys.card}`);
      }
      else if (type == cardGameType.teen9) {
        cardRedisKeys = roundData?.t2?.map((item) => [`${roundData?.t1?.[0]?.mid}_${item?.tsection}${redisKeys.card}`, `${roundData?.t1?.[0]?.mid}_${item?.lsection}${redisKeys.card}`, `${roundData?.t1?.[0]?.mid}_${item?.dsectionid}${redisKeys.card}`])?.flat(1);
      }
      else if (type == cardGameType.poker) {
        cardRedisKeys = roundData?.t2?.map((item) => `${roundData?.t1?.[0]?.mid}_${item?.sid}${redisKeys.card}`);
        cardRedisKeys = [...(cardRedisKeys || []), ...(roundData?.t3?.map((item) => `${roundData?.t1?.[0]?.mid}_${item?.sid}${redisKeys.card}`) || [])];
      }
      else {
        cardRedisKeys = roundData?.t2?.map((item) => `${roundData?.t1?.[0]?.mid}_${item?.sid}${redisKeys.card}`);
      }
      

      let redisData = await getUserRedisKeys(req?.user?.id, cardRedisKeys);
      casinoDetails.profitLoss = {};
      redisData?.forEach((item, index) => {
        if (item) {
          casinoDetails.profitLoss[cardRedisKeys[index]] = item;
        }
      });
      if (redisData?.filter((item) => !!item)?.length <= 0) {
        if (req.user.roleName != userRoleConstant.user) {
          const adminUsers = await getChildUser(req.user.id);
          // if data is not available in the redis then get data from redis and find max loss amount for all placed bet by user
          redisData = await calculateProfitLossForCardMatchToResult(In(adminUsers?.map((item) => item?.id)), roundData?.t1?.[0]?.mid, type, `${partnershipPrefixByRole[req.user.roleName]}Partnership`, true);
          let maxLoss = redisData?.exposure;
          redisData = redisData?.profitLoss;
          casinoDetails.profitLoss = redisData?.profitLoss;
          await updateUserDataRedis(req.user.id, {
            ...redisData, [`${redisKeys.userMatchExposure}${roundData?.t1?.[0]?.mid}`]: maxLoss
          });
        }
        else {
          // if data is not available in the redis then get data from redis and find max loss amount for all placed bet by user
          redisData = await calculateProfitLossForCardMatchToResult(req.user?.id, roundData?.t1?.[0]?.mid, type, null, true);
          let maxLoss = redisData?.exposure;
          redisData = redisData?.profitLoss;
          casinoDetails.profitLoss = redisData;
          await updateUserDataRedis(req.user.id, {
            ...redisData, [`${redisKeys.userMatchExposure}${roundData?.t1?.[0]?.mid}`]: maxLoss
          });
        }
      }
    }
    return SuccessResponse(
      {
        statusCode: 200,
        data: casinoDetails,
      },
      req,
      res
    );

  } catch (err) {
    return ErrorResponse(err, req, res);
  }
};

exports.matchDetailsForFootball = async (req, res) => {
  const matchType = req.query.matchType;
  try {
    const matchId = req.params.id;

    if (!matchType) {
      return ErrorResponse({ statusCode: 404, message: { msg: "notFound", keys: { name: "Match" } } }, req, res);
    }
    let domain = expertDomain;
    let apiResponse = {};
    const { id: userId } = req.user;
    try {
      apiResponse = await apiCall(
        apiMethod.get,
        domain + allApiRoutes.MATCHES.matchDetailsForFootball + matchId
      );
    } catch (error) {
      throw error?.response?.data;
    }

    if (apiResponse?.data) {
      if (Array.isArray(apiResponse?.data)) {
        for (let i = 0; i < apiResponse?.data?.length; i++) {
          const matchId = apiResponse?.data?.[i]?.id;
          let matchResult = await getHashKeysByPattern(userId, `*_${matchId}`);
          apiResponse.data[i].profitLossDataMatch = matchResult;
        }
      }
      else {
        let matchResult = await getHashKeysByPattern(userId, `*_${matchId}`);
        apiResponse.data.profitLossDataMatch = matchResult;
      }
    }


    return SuccessResponse(
      {
        statusCode: 200,
        message: { msg: "match details", keys: { name: "Match" } },
        data: apiResponse.data,
      },
      req,
      res
    );

  } catch (error) {
    logger.error({
      error: `Error at get match details for ${matchType}`,
      stack: error?.stack,
      message: error.message,
    });
    return ErrorResponse(error, req, res);
  }
};

exports.listMatch = async (req, res) => {
  try {
    let user = req.user;
    let domain = expertDomain;
    let apiResponse = {};
    try {
      apiResponse = await apiCall(
        apiMethod.get,
        domain + allApiRoutes.MATCHES.matchList,
        null,
        null,
        req.query
      );
    } catch (error) {
      throw error?.response?.data;
    }

    const domainUrl = `${req.protocol}://${req.get('host')}`;


    if (user.roleName != userRoleConstant.user && oldBetFairDomain == domainUrl) {
      const users = await getChildsWithOnlyUserRole(user.id);

      const betPlaced = await findAllPlacedBet({ createBy: In(users?.map((item) => item.id)) });

      for (let i = 0; i < apiResponse.data?.matches?.length; i++) {
        let matchDetail = apiResponse.data?.matches[i];
        apiResponse.data.matches[i].totalBet = betPlaced?.filter((match) => match?.matchId === matchDetail?.id)?.length;
        const redisIds = [`${redisKeys.userTeamARate}${matchDetail?.id}`, `${redisKeys.userTeamBRate}${matchDetail?.id}`];

        let redisData = await getUserRedisKeys(user.id, redisIds);

        apiResponse.data.matches[i].teamARate = redisData?.[0];
        apiResponse.data.matches[i].teamBRate = redisData?.[1];
      }
    }
    return SuccessResponse(
      {
        statusCode: 200,
        message: { msg: "match details", keys: { name: "Match" } },
        data: apiResponse.data,
      },
      req,
      res
    );
  } catch (err) {
    return ErrorResponse(err, req, res);
  }
};

exports.listRacingMatch = async (req, res) => {
  try {
    // let user = req.user;
    let domain = expertDomain;
    let apiResponse = {};
    try {
      apiResponse = await apiCall(
        apiMethod.get,
        domain + allApiRoutes.MATCHES.racingMatchList,
        null,
        null,
        req.query
      );
    } catch (error) {
      throw error?.response?.data;
    }

    return SuccessResponse(
      {
        statusCode: 200,
        message: { msg: "match details", keys: { name: "Match" } },
        data: apiResponse.data,
      },
      req,
      res
    );
  } catch (err) {
    return ErrorResponse(err, req, res);
  }
};

exports.listRacingCountryCode = async (req, res) => {
  try {
    let domain = expertDomain;
    let apiResponse = {};
    try {
      apiResponse = await apiCall(
        apiMethod.get,
        domain + allApiRoutes.MATCHES.racingMatchCountryCodeList,
        null,
        null,
        req.query
      );
    } catch (error) {
      throw error?.response?.data;
    }

    return SuccessResponse(
      {
        statusCode: 200,
        message: { msg: "match details", keys: { name: "Match" } },
        data: apiResponse.data,
      },
      req,
      res
    );
  } catch (err) {
    return ErrorResponse(err, req, res);
  }
};

exports.listSearchMatch = async (req, res) => {
  try {
    const { keyword } = req.params;
    const matchList=await listMatch(keyword);
    return SuccessResponse(
      {
        statusCode: 200,
        data: matchList,
      },
      req,
      res
    );
  } catch (err) {
    return ErrorResponse(err, req, res);
  }
};

exports.marketAnalysis = async (req, res) => {
  try {
    const userId=req.user.id;
    const matchesBetsByUsers = await getChildUsersPlaceBets(userId);
    const sessionKeys = matchesBetsByUsers?.map((item) => item?.betId + redisKeys.profitLoss);
    const matchDetails = [];

    if (sessionKeys?.length) {
        let redisData = await getUserRedisKeys(userId, sessionKeys);
        
      for (let [index, item] of matchesBetsByUsers?.entries()) {
        const currMatchDetail = matchDetails.findIndex((items) => items?.matchId == item?.matchId);
        const currRedisData = JSON.parse(redisData?.[index])?.maxLoss;
        if (currMatchDetail == -1) {
          matchDetails.push({
            title: item?.title,
            matchId: item?.matchId,
            betType: {
              [item?.marketType]: [{
                betId: item?.betId,
                eventName: item?.eventName,
                maxLoss: currRedisData
              }]
            }
          })
        }
        else {
          if(!matchDetails[currMatchDetail].betType[item?.marketType]){
            matchDetails[currMatchDetail].betType[item?.marketType] = [];
          }
          matchDetails[currMatchDetail].betType[item?.marketType].push({
            betId: item?.betId,
            eventName: item?.eventName,
            maxLoss: currRedisData
          });
        }
      }
    }


    return SuccessResponse(
      {
        statusCode: 200,
        data: matchDetails
      },
      req,
      res
    );

  } catch (err) {
    return ErrorResponse(err, req, res);
  }
};