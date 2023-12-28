const {userRoleConstant } = require('../config/contants');
const betPlacedService = require('../services/betPlacedService');
const { ErrorResponse, SuccessResponse } = require('../utils/response')


exports.getBet = async (req, res) => {
    try {
        const { id } = req.user
        if(req.query.id){
            const bets = await betPlacedService.getBetById(req.query.id);
            if (!bets) ErrorResponse({ statusCode: 400, message: { msg: "notFound",keys : {name : "Bet"} } }, req, res)
            return SuccessResponse({ statusCode: 200, message: { msg: "fetched" ,keys : {name : "Bet"} }, data: bets }, req, res)
        }
        const bets = await betPlacedService.getBetByUserId(id);
        if (!bets) ErrorResponse({ statusCode: 400, message: { msg: "notFound",keys : {name : "Bet"} } }, req, res)
        return SuccessResponse({ statusCode: 200, message: { msg: "fetched" ,keys : {name : "Bet"} }, data: bets }, req, res)
    } catch (err) {
        return ErrorResponse(err, req, res)
    }

};


exports.matchBettingBetPlaced = async (req,res) => {
    try {
        logger.info({
            info: `match betting bet placed`,
            data: req.body
          }); 
          
    } catch (error) {
        logger.error({
            error: `Error at match betting bet placed.`,
            stack: error.stack,
            message: error.message,
          });        
        return ErrorResponse(err, req, res)
    }
}