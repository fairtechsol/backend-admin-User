const express = require('express');
const router = express.Router();
const { getBet, matchBettingBetPlaced, sessionBetPlace, deleteMultipleBet, getSessionProfitLoss, profitLoss, getMyMarket, otherMatchBettingBetPlaced,deleteMultipleBetForOther, racingBettingBetPlaced, deleteRaceMultipleBet } = require('../controllers/betPlacedController');

const validator = require('../middleware/joi.validator');
const { isAuthenticate } = require('../middleware/auth');
const { MatchBetPlacedValidator, SessionBetPlacedValidator, RaceBetPlacedValidator } = require('../validators/betPlacedValidtor');


router.get('/', isAuthenticate, getBet);
router.get('/session/profitLoss/:betId', isAuthenticate, getSessionProfitLoss);
router.post('/matchBetting', isAuthenticate, validator(MatchBetPlacedValidator), matchBettingBetPlaced);
router.post('/session', isAuthenticate, validator(SessionBetPlacedValidator), sessionBetPlace);

router.post('/raceBetting', isAuthenticate, validator(RaceBetPlacedValidator), racingBettingBetPlaced);

router.post('/deleteMultipleBet', deleteMultipleBet);
router.post('/deleteMultipleBetForOther', deleteMultipleBetForOther);
router.post('/deleteMultipleBetForRace', deleteRaceMultipleBet);

router.post('/profitLoss',isAuthenticate, profitLoss);
router.get('/myMarket',isAuthenticate, getMyMarket);
router.post('/other/matchBetting', isAuthenticate, validator(MatchBetPlacedValidator), otherMatchBettingBetPlaced);

module.exports = router;