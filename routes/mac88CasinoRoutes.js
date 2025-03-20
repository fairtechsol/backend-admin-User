const express = require('express');
const router = express.Router();
const { isAuthenticate } = require('../middleware/auth');
const validator = require('../middleware/joi.validator')
const { loginMac88Casino, getBalanceMac88, getBetsMac88, resultRequestMac88, rollBackRequestMac88, getMac88GameList, getBetVirtualGames, getProviderList } = require('../controllers/mac88CasinoController');
const { casinoLoginValidate } = require('../validators/mac88CasinoValidator');
const verifyRSA = require('../middleware/verifyMac88MFA');
const { totalProfitLossLiveCasinoWallet, totalProfitLossByProviderNameLiveCasino, getLiveCasinoResultBetProfitLoss, getLiveCasinoUserWiseTotalProfitLoss } = require('../controllers/cardController');


router.post('/mac88/casino/login', isAuthenticate, validator(casinoLoginValidate), loginMac88Casino);
router.post('/mac88/casino/list', isAuthenticate, getMac88GameList);
router.post('/balance', verifyRSA, getBalanceMac88);
router.post('/betrequest', verifyRSA, getBetsMac88);
router.post('/resultrequest', verifyRSA, resultRequestMac88);
router.post('/rollbackrequest', verifyRSA, rollBackRequestMac88);
router.get('/mac88/bets/:userId',isAuthenticate, getBetVirtualGames);
router.get('/mac88/providers', isAuthenticate, getProviderList);


router.post("/total/profitLoss",isAuthenticate, totalProfitLossLiveCasinoWallet);
router.post("/total/gameWise/profitLoss",isAuthenticate, totalProfitLossByProviderNameLiveCasino);
router.post("/total/bet/profitLoss",isAuthenticate, getLiveCasinoResultBetProfitLoss);
router.post("/userwise/profitLoss",isAuthenticate, getLiveCasinoUserWiseTotalProfitLoss);

module.exports = router;