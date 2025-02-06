const express = require('express');
const router = express.Router();
const { getBet, matchBettingBetPlaced, sessionBetPlace, deleteMultipleBet, getSessionProfitLoss, profitLoss, getMyMarket, otherMatchBettingBetPlaced,deleteMultipleBetForOther, racingBettingBetPlaced, deleteRaceMultipleBet, cardBettingBetPlaced, getAccountStatementBet, tournamentBettingBetPlaced } = require('../controllers/betPlacedController');

const validator = require('../middleware/joi.validator');
const { isAuthenticate } = require('../middleware/auth');
const { MatchBetPlacedValidator, SessionBetPlacedValidator, RaceBetPlacedValidator, CardBetPlacedValidator, TournamentBetPlacedValidator } = require('../validators/betPlacedValidtor');
const { apiLimiter } = require('../middleware/apiHitLimiter');
const delayMatchOddBet = require('../middleware/delayMatchOdd');

router.get('/', isAuthenticate, getBet);
router.get('/accountStatement', isAuthenticate, getAccountStatementBet);
router.get('/session/profitLoss/:betId', isAuthenticate, getSessionProfitLoss);
router.post('/matchBetting',apiLimiter,  isAuthenticate, delayMatchOddBet, validator(MatchBetPlacedValidator), matchBettingBetPlaced);
router.post('/session', apiLimiter, isAuthenticate, validator(SessionBetPlacedValidator), sessionBetPlace);
router.post('/tournament', apiLimiter, isAuthenticate, delayMatchOddBet, validator(TournamentBetPlacedValidator), tournamentBettingBetPlaced);

router.post('/raceBetting', apiLimiter, isAuthenticate,delayMatchOddBet, validator(RaceBetPlacedValidator), racingBettingBetPlaced);
router.post('/cardBetting', apiLimiter, isAuthenticate, validator(CardBetPlacedValidator), cardBettingBetPlaced);

router.post('/deleteMultipleBet', deleteMultipleBet);
router.post('/deleteMultipleBetForOther', deleteMultipleBetForOther);
router.post('/deleteMultipleBetForRace', deleteRaceMultipleBet);

router.post('/profitLoss',isAuthenticate, profitLoss);
router.get('/myMarket',isAuthenticate, getMyMarket);
router.post('/other/matchBetting', apiLimiter, isAuthenticate, delayMatchOddBet, validator(MatchBetPlacedValidator), otherMatchBettingBetPlaced);

module.exports = router;