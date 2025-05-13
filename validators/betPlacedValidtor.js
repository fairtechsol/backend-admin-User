const Joi = require('joi')
const { betType, matchBettingType, cardBettingType } = require('../config/contants')

//{ teamA, teamB, teamC, stake, odd, betId, bettingType, matchBetType, matchId, betOnTeam, ipAddress, browserDetail,placeIndex }

  
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
    userId: Joi.string().allow(""),
    mid: Joi.string(),
    teamName: Joi.string(),
    betPlaceIndex: Joi.number().allow(0)
  });

  module.exports.TournamentBetPlacedValidator = Joi.object({
    matchId: Joi.string().required(),
    stake: Joi.number().required().positive().greater(0),
    odd: Joi.number().required(),
    betId: Joi.string().required(),
    bettingType: Joi.string().valid(...Object.values(betType)).required(),
    matchBetType: Joi.string().valid(...Object.values(matchBettingType)).required(),
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
    }),
    gType: Joi.string().required().messages({
      "any.required": "Game type is required"
    }),
    mid: Joi.string().required().messages({
      "any.required": "Mid is required"
    })
  });

  
  module.exports.CardBetPlacedValidator = Joi.object({
    matchId: Joi.string().required(),
    stake: Joi.number().required().positive().greater(0),
    odd: Joi.number().greater(0).required(),
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