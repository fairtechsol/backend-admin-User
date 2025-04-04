const grpc = require("@grpc/grpc-js");
const { __mf } = require("i18n");
const { logger } = require("../../../config/logger");
const { addMatchData } = require("../../../services/matchService");
const { addRaceData } = require("../../../services/racingServices");


exports.addMatch= async (call)=>{
  try{
    const data = call.request;

    await addMatchData(data);

    return{}
  }
  catch(err){
    logger.error({
      error: `Error at get match for the user.`,
      stack: err.stack,
      message: err.message,
    });
    // Handle any errors and return an error response
    throw {
      code: grpc.status.INTERNAL,
      message: err?.message || __mf("internalServerError"),
    };
  }
}

exports.raceAdd= async (call)=>{
  try{
    const data = call.request;

    await addRaceData(data);

    return {}
  }
  catch(err){
    logger.error({
      error: `Error at get match for the user.`,
      stack: err.stack,
      message: err.message,
    });
    // Handle any errors and return an error response
    throw {
      code: grpc.status.INTERNAL,
      message: err?.message || __mf("internalServerError"),
    };
  }
}