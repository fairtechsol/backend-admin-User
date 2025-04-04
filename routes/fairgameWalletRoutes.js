const express = require("express");
const router = express.Router();
const {  lockUnlockSuperAdmin, totalProfitLossWallet, totalProfitLossByMatch, getSessionBetProfitLoss, getBetCount, getAllUserBalance, getUsersProfitLoss, setExposureLimitByFGAdmin, checkUserBalance, deleteWalletUsers, getAllChildSearchList,  getUserWiseTotalProfitLoss , declarCardMatchResult, totalProfitLossByRoundCards, totalProfitLossCardsWallet, getCardResultBetProfitLoss, changeBetsDeleteReason, getVirtualBetExposures, checkVerifiedBets } = require("../controllers/fairgameWalletController");
const validator = require("../middleware/joi.validator");
const {SuperAdminBalance, SuperAdminExposureLimit, SuperAdminCreditReference, SuperAdminLockUnlock, changeBetsDeleteReasonValidator } = require("../validators/fairgameWalletValidator");
const { isUserExist, getCommissionReportsMatch, getCommissionBetPlaced, userList, userMatchLock, getTotalUserListBalance } = require("../controllers/userController");
const { settleCommissions } = require("../controllers/userBalanceController");
const { settleCommission } = require("../validators/userBalanceValidator");
const { userEventWiseExposure, marketAnalysis } = require("../controllers/matchController");

router.post("/lockUnlock", validator(SuperAdminLockUnlock), lockUnlockSuperAdmin);


router.post("/declare/result/card/match", declarCardMatchResult);

router.get("/user/exist", isUserExist);
router.post("/total/profitLoss", totalProfitLossWallet);
router.post("/total/matchWise/profitLoss", totalProfitLossByMatch);
router.post("/total/session/profitLoss", getSessionBetProfitLoss);
router.post("/userwise/profitLoss", getUserWiseTotalProfitLoss);

router.post("/card/total/profitLoss", totalProfitLossCardsWallet);
router.post("/card/total/matchWise/profitLoss", totalProfitLossByRoundCards);
router.post("/card/total/bet/profitLoss", getCardResultBetProfitLoss);

router.get("/commissionMatch/:userId", getCommissionReportsMatch);
router.get("/commissionBetPlaced/:userId", getCommissionBetPlaced);
router.get("/betCounts", getBetCount);
router.get("/user/list", userList);
router.get("/child/totalBalance", getTotalUserListBalance);
router.get("/users/balanceSum/:id", getAllUserBalance);
router.post("/userMatchLock", userMatchLock);
router.post("/settle/commission", validator(settleCommission), settleCommissions);

router.get("/user/profitLossData/:matchId", getUsersProfitLoss);

router.post("/user/exposureLimitCheck", setExposureLimitByFGAdmin);
router.post("/check/userBalance", checkUserBalance);
router.delete("/user/delete/:id", deleteWalletUsers);
router.get("/user/searchList", getAllChildSearchList);

router.post("/bet/change/deleteReason", validator(changeBetsDeleteReasonValidator), changeBetsDeleteReason);
router.get('/eventWise/exposure/:userId', userEventWiseExposure);
router.get('/marketAnalysis', marketAnalysis);
router.get('/virtualBetExposure', getVirtualBetExposures);
router.post('/checkVerifyBet', checkVerifiedBets);

module.exports = router;
