const express = require("express");
const router = express.Router();
const {  lockUnlockSuperAdmin, getSessionBetProfitLoss, getBetCount, getUsersProfitLoss, setExposureLimitByFGAdmin, checkUserBalance, deleteWalletUsers, getAllChildSearchList , changeBetsDeleteReason, getVirtualBetExposures, checkVerifiedBets } = require("../controllers/fairgameWalletController");
const validator = require("../middleware/joi.validator");
const { SuperAdminLockUnlock, changeBetsDeleteReasonValidator } = require("../validators/fairgameWalletValidator");
const { isUserExist, userMatchLock } = require("../controllers/userController");
const { settleCommissions } = require("../controllers/userBalanceController");
const { settleCommission } = require("../validators/userBalanceValidator");
const { userEventWiseExposure, marketAnalysis } = require("../controllers/matchController");

router.post("/lockUnlock", validator(SuperAdminLockUnlock), lockUnlockSuperAdmin);



router.get("/user/exist", isUserExist);
router.post("/total/session/profitLoss", getSessionBetProfitLoss);


router.get("/betCounts", getBetCount);
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
