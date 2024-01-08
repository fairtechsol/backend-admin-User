const Joi = require('joi')
const { betType, matchBettingType } = require('../config/contants')

//{ teamA, teamB, teamC, stake, odd, betId, bettingType, matchBetType, matchId, betOnTeam, ipAddress, browserDetail,placeIndex }

module.exports.MatchBetPlacedValidator = Joi.object({
    matchId: Joi.string().required(),
    teamA : Joi.string().required(),
    teamB : Joi.string().required(),
    teamC : Joi.string(),
    stake : Joi.number().required(),
    odd : Joi.number().required(),
    betId : Joi.string().required(),
    bettingType : Joi.string().valid(...Object.values(betType)).required(),
    matchBetType: Joi.string().valid(...Object.values(matchBettingType)).required(),
    betOnTeam : Joi.string().required(),
    placeIndex : Joi.number().required(),
    ipAddress : Joi.string().required().allow(""),
    browserDetail :  Joi.string().required().allow("")
    
  })
  
  module.exports.SessionBetPlacedValidator = Joi.object({
    matchId: Joi.string().required(),
    stake : Joi.number().required(),
    odds : Joi.number().required(),
    betId : Joi.string().required(),
    betType : Joi.string().valid(...Object.values(betType)).required(),
    ipAddress : Joi.string().required().allow(""),
    browserDetail :  Joi.string().required().allow(""),
    eventName:Joi.string().required(),
    eventType:Joi.string().required(),
    ratePercent:Joi.number()
  })
