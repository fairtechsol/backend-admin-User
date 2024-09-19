const { walletDomain, casinoMicroServiceDomain } = require("../config/contants");
const { apiCall, apiMethod, allApiRoutes } = require("../utils/apiService");
const { SuccessResponse, ErrorResponse } = require("../utils/response");
const { getBetsCondition } = require("./betPlacedController");

exports.getCardResultByFGWallet = async (req, res) => {
  try {
    const { type } = req.params;
    const query = req.query;
    let result = await apiCall(apiMethod.get, walletDomain + allApiRoutes.WALLET.cardResultList + type, null, null, query); 
    return SuccessResponse(
      {
        statusCode: 200,
        data: result?.data,
      },
      req,
      res
    );
  }
  catch (error) {
    return ErrorResponse(
      {
        statusCode: 500,
        message: error.message,
      },
      req,
      res
    );
  }
}

exports.getCardResultDetailByFGWallet = async (req, res) => {
  try {
    const { id } = req.params;

    let result = await apiCall(apiMethod.get, walletDomain + allApiRoutes.WALLET.cardResultDetail + id, null, null, null)
    if (!result?.data) {
      result = await apiCall(apiMethod.get, casinoMicroServiceDomain + allApiRoutes.MICROSERVICE.cardResultDetail + id, null, null, null);
      result = {
        data: {
          result: result?.data?.[0]
        }
      }
    }
    
    let betPlaced = await getBetsCondition(req.user, { "betPlaced.runnerId": id });
    if (betPlaced[1]) {
      result.data.bets = {
        count: betPlaced[1],
        rows: betPlaced[0]
      };
    }
    return SuccessResponse(
      {
        statusCode: 200,
        data: result?.data,
      },
      req,
      res
    );
  }
  catch (error) {
    return ErrorResponse(
      {
        statusCode: 500,
        message: error.message,
      },
      req,
      res
    );
  }
}