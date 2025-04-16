const express = require('express');
const router = express.Router();
const { isAuthenticate } = require('../middleware/auth');
const validator = require('../middleware/joi.validator')
const { loginMac88Casino, getBalanceMac88, getBetsMac88, resultRequestMac88, rollBackRequestMac88, getMac88GameList, getBetVirtualGames, getProviderList } = require('../controllers/mac88CasinoController');
const { casinoLoginValidate } = require('../validators/mac88CasinoValidator');
const verifyRSA = require('../middleware/verifyMac88MFA');
const { totalProfitLossLiveCasinoWallet, totalProfitLossByProviderNameLiveCasino, getLiveCasinoResultBetProfitLoss, getLiveCasinoUserWiseTotalProfitLoss } = require('../controllers/cardController');
const { permissions } = require('../config/contants');
const { checkAuthorize } = require('../middleware/checkAccess');


router.post('/mac88/casino/login', isAuthenticate, validator(casinoLoginValidate), loginMac88Casino);
router.post('/mac88/casino/list', isAuthenticate, getMac88GameList);
router.post('/balance', verifyRSA, getBalanceMac88);
router.post('/betrequest', verifyRSA, getBetsMac88);
router.post('/resultrequest', verifyRSA, resultRequestMac88);
router.post('/rollbackrequest', verifyRSA, rollBackRequestMac88);
router.get('/mac88/bets/:userId', isAuthenticate, checkAuthorize(permissions.liveCasinoResult), getBetVirtualGames);
router.get('/mac88/providers', isAuthenticate, checkAuthorize(permissions.liveCasinoResult), getProviderList);


router.post("/virtual/total/profitLoss", isAuthenticate, totalProfitLossLiveCasinoWallet);
router.post("/virtual/total/gameWise/profitLoss", isAuthenticate, totalProfitLossByProviderNameLiveCasino);
router.post("/virtual/total/bet/profitLoss", isAuthenticate, getLiveCasinoResultBetProfitLoss);
router.post("/virtual/userwise/profitLoss", isAuthenticate, getLiveCasinoUserWiseTotalProfitLoss);

module.exports = router;