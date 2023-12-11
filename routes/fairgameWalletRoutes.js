const express = require("express");
const router = express.Router();
const { createSuperAdmin, updateSuperAdmin, updateSuperAdminBalance, setExposureLimitSuperAdmin, setCreditReferrenceSuperAdmin, lockUnlockSuperAdmin } = require("../controllers/fairgameWalletController");
const validator = require("../middleware/joi.validator");
const { CreateSuperAdmin, UpdateSuperAdmin, SuperAdminBalance, SuperAdminExposureLimit, SuperAdminCreditReference, SuperAdminLockUnlock } = require("../validators/fairgameWalletValidator");

router.post("/add/user", validator(CreateSuperAdmin), createSuperAdmin);
router.post("/update/user", validator(UpdateSuperAdmin), updateSuperAdmin);
router.post("/update/balance", validator(SuperAdminBalance), updateSuperAdminBalance);
router.post("/update/exposure", validator(SuperAdminExposureLimit), setExposureLimitSuperAdmin);
router.post("/update/creditReference", validator(SuperAdminCreditReference), setCreditReferrenceSuperAdmin);
router.post("/lockUnlock", validator(SuperAdminLockUnlock), lockUnlockSuperAdmin);

module.exports = router;
