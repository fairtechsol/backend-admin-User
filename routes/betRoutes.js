const express = require('express');
const router = express.Router();
const {getBet, matchBettingBetPlaced, sessionBetPlace} = require('../controllers/betPlacedController');

const validator = require('../middleware/joi.validator');
const { isAuthenticate } = require('../middleware/auth');
const { MatchBetPlacedValidator, SessionBetPlacedValidator } = require('../validators/betPlacedValidtor');


router.get('/',isAuthenticate,getBet);
router.post('/matchBetting',isAuthenticate,validator(MatchBetPlacedValidator),matchBettingBetPlaced)
router.post('/session',isAuthenticate,validator(SessionBetPlacedValidator),sessionBetPlace)

module.exports = router;