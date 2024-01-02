const express = require('express');
const router = express.Router();
const {getBet, matchBettingBetPlaced} = require('../controllers/betPlacedController');

const validator = require('../middleware/joi.validator');
const { isAuthenticate } = require('../middleware/auth');
const { MatchBetPlacedValidator } = require('../validators/betPlacedValidtor');


router.get('/',isAuthenticate,getBet);
router.post('/matchBetting',isAuthenticate,validator(MatchBetPlacedValidator),matchBettingBetPlaced)

module.exports = router;