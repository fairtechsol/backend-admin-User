const { In } = require("typeorm");
const { expertDomain, redisKeys, userRoleConstant, oldBetFairDomain, redisKeysMatchWise } = require("../config/contants");
const { findAllPlacedBet } = require("../services/betPlacedService");
const { getUserRedisKeys } = require("../services/redis/commonfunction");
const { getChildsWithOnlyUserRole } = require("../services/userService");
const { apiCall, apiMethod, allApiRoutes } = require("../utils/apiService");
const { SuccessResponse, ErrorResponse } = require("../utils/response");

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
          redisIds.push(...[`${redisKeys.userTeamARate}${matchId}`, `${redisKeys.userTeamBRate}${matchId}`, `${redisKeys.userTeamCRate}${matchId}`, `${redisKeys.yesRateComplete}${matchId}`, `${redisKeys.noRateComplete}${matchId}`, `${redisKeys.yesRateTie}${matchId}`, `${redisKeys.noRateTie}${matchId}`]);

          let redisData = await getUserRedisKeys(userId, redisIds);
          let sessionResult = [];
          let matchResult = {};
          redisData?.forEach((item, index) => {
            if (item) {
              if (index >= redisData?.length - 7) {
                matchResult[redisIds?.[index]?.split("_")[0]] = item;
              } else {
                sessionResult.push({
                  betId: redisIds?.[index]?.split("_")[0],
                  maxLoss: JSON.parse(item)?.maxLoss,
                  totalBet: JSON.parse(item)?.totalBet

                });
              }
            }
          });
          apiResponse.data[i].profitLossDataSession = sessionResult;
          apiResponse.data[i].profitLossDataMatch = matchResult;
        }
      }
      else {
        const redisIds = apiResponse?.data?.sessionBettings?.map((item) => JSON.parse(item)?.id + redisKeys.profitLoss);
        redisIds.push(...[`${redisKeys.userTeamARate}${matchId}`, `${redisKeys.userTeamBRate}${matchId}`, `${redisKeys.userTeamCRate}${matchId}`, `${redisKeys.yesRateComplete}${matchId}`, `${redisKeys.noRateComplete}${matchId}`, `${redisKeys.yesRateTie}${matchId}`, `${redisKeys.noRateTie}${matchId}`]);

        let redisData = await getUserRedisKeys(userId, redisIds);
        let sessionResult = [];
        let matchResult = {};
        redisData?.forEach((item, index) => {
          if (item) {
            if (index >= redisData?.length - 7) {
              matchResult[redisIds?.[index]?.split("_")[0]] = item;
            } else {
              sessionResult.push({
                betId: redisIds?.[index]?.split("_")[0],
                maxLoss: JSON.parse(item)?.maxLoss,
                totalBet: JSON.parse(item)?.totalBet
              });
            }
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
exports.matchDetailsForFootball = async (req, res) => {
  try {
    const matchId = req.params.id;
    const matchType = req.query.matchType
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
          const redisIds = [];
          redisIds.push(
            ...redisKeysMatchWise[matchType].map(
              (key) => key + matchId
            )
          );


          let redisData = await getUserRedisKeys(userId, redisIds);
          let sessionResult = [];
          let matchResult = {};
          redisData?.forEach((item, index) => {
            if (item) {
              const dataLength = redisKeysMatchWise[matchType].length;
              const startIndex = redisData?.length - dataLength;
              if (index >= startIndex) {
                matchResult[redisIds?.[index]?.split("_")[0]] = item;
              } else {
                sessionResult.push({
                  betId: redisIds?.[index]?.split("_")[0],
                  maxLoss: JSON.parse(item)?.maxLoss,
                  totalBet: JSON.parse(item)?.totalBet

                });
              }
            }
          });
          apiResponse.data[i].profitLossDataMatch = matchResult;
        }
      }
      else {
        const redisIds = [];
        redisIds.push(
          ...redisKeysMatchWise[matchType].map(
            (key) => key + matchId
          )
        );
        let redisData = await getUserRedisKeys(userId, redisIds);

        let sessionResult = [];
        let matchResult = {};
        redisData?.forEach((item, index) => {
          if (item) {
            const dataLength = redisKeysMatchWise[matchType].length;
            const startIndex = redisData?.length - dataLength;
            if (index >= startIndex) {
              matchResult[redisIds?.[index]?.split("_")[0]] = item;
            } else {
              sessionResult.push({
                betId: redisIds?.[index]?.split("_")[0],
                maxLoss: JSON.parse(item)?.maxLoss,
                totalBet: JSON.parse(item)?.totalBet
              });
            }
          }
        });

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
