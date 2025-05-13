const { redisKeys } = require("../config/contants");
const { logger } = require("../config/logger");
const { getMatchCompetitionsHandler, getMatchDatesHandler, getMatchesByDateHandler, getBlinkingTabsHandler } = require("../grpc/grpcClient/handlers/expert/matchHandler");
const { getNotificationHandler } = require("../grpc/grpcClient/handlers/expert/userHandler");
const { getExternalRedisKey } = require("../services/redis/commonfunction");
const { ErrorResponse, SuccessResponse } = require("../utils/response");

exports.getNotification = async (req, res) => {
  try {

    const type = req.query.type || "notification";
    let notification = await getExternalRedisKey(type);
    if (!notification) {
      notification = await getNotificationHandler({ query: JSON.stringify(req.query) });
    }
    else {
      notification = { value: notification };
    }
    return SuccessResponse(
      {
        statusCode: 200,
        data: notification,
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
    let blinkingTabs = await getExternalRedisKey(redisKeys.blinkingTabs);
    if (!blinkingTabs) {
      blinkingTabs = await getBlinkingTabsHandler();
    }
    else {
      blinkingTabs = JSON.parse(blinkingTabs);
    }
    
    return SuccessResponse(
      {
        statusCode: 200,
        data: blinkingTabs,
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

