const { betTypeForMatch } = require("../config/constants");
const { betStatusType, teamStatus } = require("../config/contants");
const { logger } = require("../config/logger");
const { getUserRedisData } = require("../services/redis/commonfunction");
const { getUserById } = require("../services/userService");
const { apiCall, apiMethod, allApiRoutes } = require("../utils/apiService");
const { ErrorResponse } = require("../utils/response");

// Default expert domain URL, fallback to localhost if not provided
let expertDomain = process.env.EXPERT_DOMAIN_URL || "http://localhost:6060";

/**
 * Handle the user's session bet placement.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @param {Function} next - Express next function.
 */
exports.sessionBetPlace = async (req, res, next) => {
  try {
    // Destructure relevant data from the request body and user object
    const { betId, betType, country, matchId, ipAddress, odds, ratePercent, stake } = req.body;
    const { id } = req.user;

    // Fetch user details by ID
    let user = await getUserById(id, ["userBlock", "betBlock","userName"]);

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
    if (betType == betTypeForMatch.yes) {
      winAmount = parseFloat((stake * ratePercent) / 100).toFixed(2);
      loseAmount = stake;
    } else if (betType == betTypeForMatch.no) {
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
    let sessionExp = parseFloat(userData[`${matchId}_sessionExposure`]) || 0.0;

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
        betType: betType,
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

    let sessionProfitLossData=userData[`${betId}_profitLoss`];

    if (sessionProfitLossData) {
        sessionProfitLossData = JSON.parse(sessionProfitLossData);
        oldMaxLoss = parseFloat(oldPartnerShipData['max_loss']);
    }



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



const validateSessionBet=async (apiBetData,betDetails)=>{
    if(apiBetData.activeStatus != betStatusType.live){
        throw {
            message:{
                msg:"bet.notLive"
            }
        };
    }

    if (betDetails.stake < apiBetData.minBet) {
        throw {
            statusCode:400,
            message:{
                msg:"bet.minAmountViolate"
            }
        };
    }
    if (betDetails.stake > apiBetData.maxBet) {
        throw {
            statusCode:400,
            message:{
                msg:"bet.maxAmountViolate"
            }
        };
    }
    if (apiBetData?.selectionId && apiBetData?.selectionId != "") {

        if(!apiBetData.apiSessionActive){
            throw {
                statusCode:400,
                message:{
                    msg:"bet.notLive"
                }
            };
        }
        else {
            // check the rates of third party api
        }
    }
    else {
        if(!apiBetData.manualSessionActive){
            throw {
                statusCode:400,
                message:{
                    msg:"bet.notLive"
                }
            };
        }
        if (
          (betDetails.betType == betTypeForMatch.no &&
            betDetails.odds != apiBetData.noRate) ||
          (betDetails.betType == betTypeForMatch.yes &&
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