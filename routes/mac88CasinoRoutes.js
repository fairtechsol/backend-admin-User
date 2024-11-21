const express = require('express');
const router = express.Router();
const { isAuthenticate } = require('../middleware/auth');
const validator = require('../middleware/joi.validator')
const { loginMac88Casino, getBalanceMac88, getBetsMac88, resultRequestMac88, rollBackRequestMac88, getMac88GameList, getBetVirtualGames } = require('../controllers/mac88CasinoController');
const { casinoLoginValidate } = require('../validators/mac88CasinoValidator');
const verifyRSA = require('../middleware/verifyMac88MFA');


router.post('/mac88/casino/login', isAuthenticate, validator(casinoLoginValidate), loginMac88Casino);
router.post('/mac88/casino/list', isAuthenticate, getMac88GameList);
router.post('/balance', verifyRSA, getBalanceMac88);
router.post('/betrequest', verifyRSA, getBetsMac88);
router.post('/resultrequest', verifyRSA, resultRequestMac88);
router.post('/rollbackrequest', verifyRSA, rollBackRequestMac88);
router.get('/mac88/bets/:userId', getBetVirtualGames);

module.exports = router;