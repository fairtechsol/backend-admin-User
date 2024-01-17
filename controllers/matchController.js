const { expertDomain, redisKeys } = require("../config/contants");
const { getUserRedisKeys } = require("../services/redis/commonfunction");
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

    const redisIds = apiResponse?.data?.sessionBettings?.map((item)=> JSON.parse(item)?.id+redisKeys.profitLoss );
    redisIds.push(...[`${redisKeys.userTeamARate}${matchId}`,`${redisKeys.userTeamBRate}${matchId}`,`${redisKeys.userTeamCRate}${matchId}`,`${redisKeys.yesRateComplete}${matchId}`,`${redisKeys.noRateComplete}${matchId}`,`${redisKeys.yesRateTie}${matchId}`,`${redisKeys.noRateTie}${matchId}`]);

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
          });
        }
      }
    });

    return SuccessResponse(
      {
        statusCode: 200,
        message: { msg: "match details", keys: { name: "Match" } },
        data: {
          ...apiResponse.data,
          profitLossDataSession: sessionResult,
          profitLossDataMatch: matchResult,
        },
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
