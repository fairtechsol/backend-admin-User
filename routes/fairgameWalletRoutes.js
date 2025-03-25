const express = require("express");
const router = express.Router();
const { createSuperAdmin, updateSuperAdmin, updateSuperAdminBalance, setExposureLimitSuperAdmin, setCreditReferrenceSuperAdmin, lockUnlockSuperAdmin, changePasswordSuperAdmin, declareSessionResult, declareSessionNoResult, unDeclareSessionResult, getBetWallet, totalProfitLossWallet, totalProfitLossByMatch, getResultBetProfitLoss, getSessionBetProfitLoss, getBetCount, getAllUserBalance, getUsersProfitLoss, setExposureLimitByFGAdmin, checkUserBalance, deleteWalletUsers, getAllChildSearchList,  getUserWiseTotalProfitLoss , declarCardMatchResult, totalProfitLossByRoundCards, totalProfitLossCardsWallet, getCardResultBetProfitLoss, changeBetsDeleteReason, declarTournamentMatchResult, unDeclareTournamentMatchResult, getVirtualBetExposures, unDeclareFinalMatchResult, declarFinalMatchResult, checkVerifiedBets, getSessionBetProfitLossExpert } = require("../controllers/fairgameWalletController");
const validator = require("../middleware/joi.validator");
const { CreateSuperAdmin, UpdateSuperAdmin, SuperAdminBalance, SuperAdminExposureLimit, SuperAdminCreditReference, SuperAdminLockUnlock, SuperAdminChangePassword, changeBetsDeleteReasonValidator } = require("../validators/fairgameWalletValidator");
const { isUserExist, getCommissionReportsMatch, getCommissionBetPlaced, userList, userMatchLock, getTotalUserListBalance } = require("../controllers/userController");
const { settleCommissions } = require("../controllers/userBalanceController");
const { settleCommission } = require("../validators/userBalanceValidator");
const { userEventWiseExposure, marketAnalysis } = require("../controllers/matchController");
const { verifyBet } = require("../controllers/betPlacedController");
const { declareApiLimiter } = require("../middleware/declareApiLimit");

router.post("/add/user", validator(CreateSuperAdmin), createSuperAdmin);
router.post("/update/user", validator(UpdateSuperAdmin), updateSuperAdmin);
router.post("/update/balance", validator(SuperAdminBalance), updateSuperAdminBalance);
router.post("/update/exposure", validator(SuperAdminExposureLimit), setExposureLimitSuperAdmin);
router.post("/update/creditReference", validator(SuperAdminCreditReference), setCreditReferrenceSuperAdmin);
router.post("/lockUnlock", validator(SuperAdminLockUnlock), lockUnlockSuperAdmin);
router.post("/changePassword", validator(SuperAdminChangePassword), changePasswordSuperAdmin);

router.post("/declare/result/session", declareApiLimiter, declareSessionResult);
router.post("/declare/noResult/session",declareApiLimiter,  declareSessionNoResult);
router.post("/unDeclare/result/session", declareApiLimiter, unDeclareSessionResult);

router.post("/declare/result/tournament/match", declareApiLimiter, declarTournamentMatchResult);
router.post("/unDeclare/result/tournament/match", declareApiLimiter, unDeclareTournamentMatchResult);

router.post("/declare/result/final/match", declarFinalMatchResult);
router.post("/unDeclare/result/final/match",  unDeclareFinalMatchResult);

router.post("/declare/result/card/match", declarCardMatchResult);

router.get("/getBet", getBetWallet);
router.get("/user/exist", isUserExist);
router.post("/total/profitLoss", totalProfitLossWallet);
router.post("/total/matchWise/profitLoss", totalProfitLossByMatch);
router.post("/total/bet/profitLoss", getResultBetProfitLoss);
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
router.post('/verifyBet', verifyBet);
router.post('/checkVerifyBet', checkVerifiedBets);
router.post("/user/session/profitLoss/expert", getSessionBetProfitLossExpert);

module.exports = router;
