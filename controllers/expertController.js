const { expertDomain } = require("../config/contants");
const { logger } = require("../config/logger");
const { addMatchData } = require("../services/matchService");
const { addRaceData } = require("../services/racingServices");
const { apiCall, apiMethod, allApiRoutes } = require("../utils/apiService");
const { ErrorResponse, SuccessResponse } = require("../utils/response");

exports.getNotification = async (req, res) => {
  try {
    let response = await apiCall(
      apiMethod.get,
      expertDomain + allApiRoutes.notification,
      null,
      null,
      req.query
    );
    return SuccessResponse(
      {
        statusCode: 200,
        data: response.data,
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
    let response = await apiCall(
      apiMethod.get,
      expertDomain + allApiRoutes.blinkingTabs
    );
    return SuccessResponse(
      {
        statusCode: 200,
        data: response.data,
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

    let response = await apiCall(
      apiMethod.get,
      expertDomain + allApiRoutes.getCompetitionList + `/${type}`
    );

    return SuccessResponse(
      {
        statusCode: 200,
        data: response.data,
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

    let response = await apiCall(
      apiMethod.get,
      expertDomain + allApiRoutes.getDatesByCompetition + `/${competitionId}`
    );

    return SuccessResponse(
      {
        statusCode: 200,
        data: response?.data,
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

    let response = await apiCall(
      apiMethod.get,
      expertDomain +
        allApiRoutes.getMatchByCompetitionAndDate +
        `/${competitionId}/${new Date(date)}`
    );

    return SuccessResponse(
      {
        statusCode: 200,
        data: response?.data,
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


exports.addMatch= async (req,res)=>{
  try{
    const data = req.body;

    await addMatchData(data);

    return SuccessResponse(
      {
        statusCode: 200,
      },
      req,
      res
    );
  }
  catch(err){
    logger.error({
      error: `Error at get match for the user.`,
      stack: err.stack,
      message: err.message,
    });
    // Handle any errors and return an error response
    return ErrorResponse(err, req, res);
  }
}

exports.raceAdd= async (req,res)=>{
  try{
    const data = req.body;

    await addRaceData(data);

    return SuccessResponse(
      {
        statusCode: 200,
      },
      req,
      res
    );
  }
  catch(err){
    logger.error({
      error: `Error at get match for the user.`,
      stack: err.stack,
      message: err.message,
    });
    // Handle any errors and return an error response
    return ErrorResponse(err, req, res);
  }
}