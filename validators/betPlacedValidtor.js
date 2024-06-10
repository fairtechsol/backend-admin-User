const Joi = require('joi')
const { betType, matchBettingType, racingBettingType, cardBettingType } = require('../config/contants')

//{ teamA, teamB, teamC, stake, odd, betId, bettingType, matchBetType, matchId, betOnTeam, ipAddress, browserDetail,placeIndex }

module.exports.MatchBetPlacedValidator = Joi.object({
    matchId: Joi.string().required(),
    teamA : Joi.string().required(),
    teamB : Joi.string().required(),
    teamC : Joi.string().allow("").allow(null),
    stake : Joi.number().required().positive().greater(0),
    odd : Joi.number().required(),
    betId : Joi.string().required(),
    bettingType : Joi.string().valid(...Object.values(betType)).required(),
    matchBetType: Joi.string().valid(...Object.values(matchBettingType)).required(),
    betOnTeam : Joi.string().required(),
    placeIndex : Joi.number().required(),
    ipAddress : Joi.string().allow(""),
    browserDetail :  Joi.string().allow(""),
    bettingName: Joi.string().allow(""),
    userId: Joi.string().allow(""),
    gameType: Joi.string().allow("")
  });
  
  module.exports.SessionBetPlacedValidator = Joi.object({
    matchId: Joi.string().required(),
    stake : Joi.number().required().positive().greater(0),
    odds : Joi.number().required(),
    betId : Joi.string().required(),
    betType : Joi.string().valid(...Object.values(betType)).required(),
    ipAddress : Joi.string().allow(""),
    browserDetail :  Joi.string().allow(""),
    eventName: Joi.string().required(),
    eventType: Joi.string().required(),
    ratePercent: Joi.number(),
    userId: Joi.string().allow("")
  });


  module.exports.RaceBetPlacedValidator = Joi.object({
    matchId: Joi.string().required(),
    stake: Joi.number().required().positive().greater(0),
    odd: Joi.number().required(),
    betId: Joi.string().required(),
    bettingType: Joi.string().valid(...Object.values(betType)).required(),
    matchBetType: Joi.string().valid(...Object.values(racingBettingType)).required(),
    betOnTeam: Joi.string().required(),
    placeIndex: Joi.number().required(),
    ipAddress: Joi.string().allow(""),
    browserDetail: Joi.string().allow(""),
    bettingName: Joi.string().allow(""),
    userId: Joi.string().allow(""),
    selectionId: Joi.string().required().messages({
      "any.required":"Selection id is required"
    }),
    runnerId: Joi.string().required().messages({
      "any.required": "Runner id is required"
    })
  });
  
  module.exports.CardBetPlacedValidator = Joi.object({
    matchId: Joi.string().required(),
    stake: Joi.number().required().positive().greater(0),
    odd: Joi.number().required(),
    bettingType: Joi.string().valid(...Object.values(betType)).required(),
    matchBetType: Joi.string().valid(...Object.values(cardBettingType)).required(),
    betOnTeam: Joi.string().required(),
    ipAddress: Joi.string().allow(""),
    browserDetail: Joi.string().allow(""),
    bettingName: Joi.string().allow(""),
    userId: Joi.string().allow(""),
    selectionId: Joi.string().required().messages({
      "any.required":"Selection id is required"
    })
  });