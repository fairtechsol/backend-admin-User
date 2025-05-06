const express = require('express');
const router = express.Router();
const { getBet, sessionBetPlace, getSessionProfitLoss, profitLoss, getMyMarket,  cardBettingBetPlaced, getAccountStatementBet, tournamentBettingBetPlaced } = require('../controllers/betPlacedController');

const validator = require('../middleware/joi.validator');
const { isAuthenticate } = require('../middleware/auth');
const {  SessionBetPlacedValidator,  CardBetPlacedValidator, TournamentBetPlacedValidator } = require('../validators/betPlacedValidtor');
const { apiLimiter } = require('../middleware/apiHitLimiter');
const delayMatchOddBet = require('../middleware/delayMatchOdd');

router.get('/', isAuthenticate, getBet);
router.get('/accountStatement', isAuthenticate, getAccountStatementBet);
router.get('/session/profitLoss/:betId', isAuthenticate, getSessionProfitLoss);
router.post('/session', isAuthenticate, validator(SessionBetPlacedValidator), sessionBetPlace);
router.post('/tournament', apiLimiter, isAuthenticate, delayMatchOddBet, validator(TournamentBetPlacedValidator), tournamentBettingBetPlaced);

router.post('/cardBetting', apiLimiter, isAuthenticate, validator(CardBetPlacedValidator), cardBettingBetPlaced);

router.post('/profitLoss',isAuthenticate, profitLoss);
router.get('/myMarket',isAuthenticate, getMyMarket);

module.exports = router;