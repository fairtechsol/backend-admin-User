const { expertDomain } = require("../config/contants");
const { logger } = require("../config/logger");
const { getMatchCompetitionsHandler, getMatchDatesHandler, getMatchesByDateHandler, getBlinkingTabsHandler } = require("../grpc/grpcClient/handlers/expert/matchHandler");
const { getNotificationHandler } = require("../grpc/grpcClient/handlers/expert/userHandler");
const { apiCall, apiMethod, allApiRoutes } = require("../utils/apiService");
const { ErrorResponse, SuccessResponse } = require("../utils/response");

exports.getNotification = async (req, res) => {
  try {
    let response = await getNotificationHandler({ query: JSON.stringify(req.query) });
    return SuccessResponse(
      {
        statusCode: 200,
        data: response,
      },
      req,
      res
    );
  } catch (err) {
    return ErrorResponse(err?.response?.data, req, res);
  }
};

exports.getBlinkingTabs = async (req, res) => {
  try {
    let response = await getBlinkingTabsHandler();
    return SuccessResponse(
      {
        statusCode: 200,
        data: response,
      },
      req,
      res
    );
  } catch (err) {
    return ErrorResponse(err?.response?.data, req, res);
  }
};

exports.getMatchCompetitionsByType = async (req, res) => {
  try {
    const { type } = req.params;

    let response = await getMatchCompetitionsHandler({ type: type });

    return SuccessResponse(
      {
        statusCode: 200,
        data: response,
      },
      req,
      res
    );
  } catch (err) {
    logger.error({
      error: `Error at list competition for the user.`,
      stack: err.stack,
      message: err.message,
    });
    // Handle any errors and return an error response
    return ErrorResponse(err?.response?.data, req, res);
  }
};

exports.getMatchDatesByCompetitionId = async (req, res) => {
  try {
    const { competitionId } = req.params;

    let response = await getMatchDatesHandler({ competitionId: competitionId });

    return SuccessResponse(
      {
        statusCode: 200,
        data: response,
      },
      req,
      res
    );
  } catch (err) {
    logger.error({
      error: `Error at list date for the user.`,
      stack: err.stack,
      message: err.message,
    });
    // Handle any errors and return an error response
    return ErrorResponse(err?.response?.data, req, res);
  }
};

exports.getMatchDatesByCompetitionIdAndDate = async (req, res) => {
  try {
    const { competitionId, date } = req.params;

    let response = await getMatchesByDateHandler({
      competitionId: competitionId,
      date: new Date(date)
    });

    return SuccessResponse(
      {
        statusCode: 200,
        data: response,
      },
      req,
      res
    );
  } catch (err) {
    logger.error({
      error: `Error at list match for the user.`,
      stack: err.stack,
      message: err.message,
    });
    // Handle any errors and return an error response
    return ErrorResponse(err?.response?.data, req, res);
  }
};

