const express = require('express');
const router = express.Router();
const validator = require('../middleware/joi.validator')
const { CreateUser, ChangePassword, generateTransactionPass, LockUnlockUser, updateUserValid, setExposureLimitValid, setCreditRefValidate, userMatchLockValidate } = require('../validators/userValidator');
const { createUser, lockUnlockUser, generateTransactionPassword, changePassword, updateUser, setExposureLimit, userList, userSearchList, userBalanceDetails, setCreditReferrence, getProfile, generalReport, totalProfitLoss, isUserExist, userMatchLock, getMatchLockAllChild, getUserDetailsForParent, checkChildDeactivate, getCommissionReportsMatch, getCommissionBetPlaced, getTotalUserListBalance } = require('../controllers/userController');
const { isAuthenticate, checkTransactionPassword } = require('../middleware/auth');
const { totalProfitLossWallet, totalProfitLossByMatch, getResultBetProfitLoss, getSessionBetProfitLoss } = require('../controllers/fairgameWalletController');

router.post('/add', isAuthenticate, checkTransactionPassword, validator(CreateUser), createUser);
router.get('/profile', isAuthenticate, getProfile);
router.get('/exist', isAuthenticate, isUserExist);
router.post('/updateUser', isAuthenticate, checkTransactionPassword, validator(updateUserValid), updateUser);
router.post('/lockUnlockUser', isAuthenticate, checkTransactionPassword, validator(LockUnlockUser), lockUnlockUser);
router.post('/changePassword', isAuthenticate, validator(ChangePassword), changePassword);
router.post("/update/exposurelimit", isAuthenticate, checkTransactionPassword, validator(setExposureLimitValid), setExposureLimit);

router.get("/list", isAuthenticate, userList);
router.get("/child/totalBalance", isAuthenticate, getTotalUserListBalance);

router.get("/searchlist", isAuthenticate, userSearchList);
router.get("/balance", isAuthenticate, userBalanceDetails);
router.post("/update/creditreferrence", isAuthenticate, checkTransactionPassword, validator(setCreditRefValidate), setCreditReferrence);
router.post("/generateTransactionPassword", isAuthenticate, validator(generateTransactionPass), generateTransactionPassword);

router.get("/generalReport", isAuthenticate, generalReport);
router.post("/totalProfitLoss", isAuthenticate, totalProfitLoss);
router.post("/userMatchLock", isAuthenticate, validator(userMatchLockValidate), userMatchLock);
router.get("/getMatchLockAllChild", isAuthenticate, getMatchLockAllChild);
router.get("/getUserDetailsForParent", isAuthenticate, getUserDetailsForParent);
router.get("/checkChildDeactivate", isAuthenticate, checkChildDeactivate);

router.post("/total/profitLoss", isAuthenticate, totalProfitLossWallet);
router.post("/total/matchWise/profitLoss", isAuthenticate, totalProfitLossByMatch);
router.post("/total/bet/profitLoss", isAuthenticate, getResultBetProfitLoss);
router.post("/total/session/profitLoss", isAuthenticate, getSessionBetProfitLoss);

router.get("/commissionMatch/:userId", isAuthenticate, getCommissionReportsMatch);
router.get("/commissionBetPlaced/:userId", isAuthenticate, getCommissionBetPlaced);

module.exports = router;
//https://3100dev.fairgame.club/fair-game-wallet/getUserBalanceDetails
