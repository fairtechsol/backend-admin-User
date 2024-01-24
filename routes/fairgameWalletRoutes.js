const express = require("express");
const router = express.Router();
const { createSuperAdmin, updateSuperAdmin, updateSuperAdminBalance, setExposureLimitSuperAdmin, setCreditReferrenceSuperAdmin, lockUnlockSuperAdmin, changePasswordSuperAdmin, declareSessionResult, declareSessionNoResult, unDeclareSessionResult, getBetWallet, declareMatchResult, unDeclareMatchResult, totalProfitLossWallet, totalProfitLossByMatch } = require("../controllers/fairgameWalletController");
const validator = require("../middleware/joi.validator");
const { CreateSuperAdmin, UpdateSuperAdmin, SuperAdminBalance, SuperAdminExposureLimit, SuperAdminCreditReference, SuperAdminLockUnlock, SuperAdminChangePassword } = require("../validators/fairgameWalletValidator");

router.post("/add/user", validator(CreateSuperAdmin), createSuperAdmin);
router.post("/update/user", validator(UpdateSuperAdmin), updateSuperAdmin);
router.post("/update/balance", validator(SuperAdminBalance), updateSuperAdminBalance);
router.post("/update/exposure", validator(SuperAdminExposureLimit), setExposureLimitSuperAdmin);
router.post("/update/creditReference", validator(SuperAdminCreditReference), setCreditReferrenceSuperAdmin);
router.post("/lockUnlock", validator(SuperAdminLockUnlock), lockUnlockSuperAdmin);
router.post("/changePassword", validator(SuperAdminChangePassword), changePasswordSuperAdmin);
router.post("/declare/result/session",  declareSessionResult);
router.post("/declare/noResult/session",  declareSessionNoResult);
router.post("/unDeclare/result/session",  unDeclareSessionResult);
router.post("/declare/result/match",  declareMatchResult);
router.post("/unDeclare/result/match",  unDeclareMatchResult);
router.get("/getBet", getBetWallet);
router.post("/total/profitLoss", totalProfitLossWallet);
router.post("/total/matchWise/profitLoss", totalProfitLossByMatch);

module.exports = router;
