const express = require('express');
const router = express.Router();

const validator = require('../middleware/joi.validator')
const {CreateUser, ChangePassword, generateTransactionPass, LockUnlockUser,updateUserValid,setExposureLimitValid, setCreditRefValidate} = require('../validators/userValidator');
const {createUser,lockUnlockUser,insertWallet,generateTransactionPassword, changePassword, updateUser,setExposureLimit, userList, userSearchList,userBalanceDetails, setCreditReferrence, getProfile, generalReport, totalProfitLoss} = require('../controllers/userController');

const { isAuthenticate,checkTransactionPassword } = require('../middleware/auth');


router.post('/add',isAuthenticate,checkTransactionPassword,validator(CreateUser),createUser);
router.get('/profile',isAuthenticate, getProfile);
router.post('/updateUser',isAuthenticate,checkTransactionPassword,validator(updateUserValid),updateUser);
router.post('/lockUnlockUser',isAuthenticate,checkTransactionPassword, validator(LockUnlockUser), lockUnlockUser);
router.post('/insert/wallet',insertWallet);
router.post('/changePassword',isAuthenticate,validator(ChangePassword),changePassword);
router.post("/update/exposurelimit",isAuthenticate,checkTransactionPassword,validator(setExposureLimitValid),setExposureLimit);
router.get("/list",isAuthenticate,userList);
router.get("/searchlist",isAuthenticate,userSearchList);
router.get("/balance",isAuthenticate,userBalanceDetails);
router.post("/update/creditreferrence",isAuthenticate,checkTransactionPassword,validator(setCreditRefValidate),setCreditReferrence);
router.post("/generateTransactionPassword",isAuthenticate,validator(generateTransactionPass),generateTransactionPassword);

router.get("/generalReport", isAuthenticate,  generalReport)
router.post("/totalProfitLoss", isAuthenticate, totalProfitLoss)
module.exports = router;
//https://3100dev.fairgame.club/fair-game-wallet/getUserBalanceDetails
