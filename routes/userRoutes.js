const express = require('express');
const router = express.Router();

const validator = require('../middleware/joi.validator')
const {CreateUser, ChangePassword, generateTransactionPass, LockUnlockUser,updateUserValid,setExposureLimitValid} = require('../validators/userValidator');
const {createUser,lockUnlockUser,insertWallet,generateTransactionPassword, changePassword, updateUser,setExposureLimit, userList, userSearchList,userBalanceDetails, setCreditReferrence, getProfile} = require('../controllers/userController');

const { isAuthenticate } = require('../middleware/auth');


router.post('/add',isAuthenticate,validator(CreateUser),createUser);
router.get('/profile',isAuthenticate, getProfile);
router.post('/updateUser',validator(updateUserValid),updateUser);
router.post('/lockUnlockUser', validator(LockUnlockUser), lockUnlockUser);
router.post('/insert/wallet',insertWallet)
router.post('/changePassword',isAuthenticate,validator(ChangePassword),changePassword);
router.post("/update/exposurelimit",validator(setExposureLimitValid),setExposureLimit)
router.get("/list",isAuthenticate,userList)
router.get("/searchlist",isAuthenticate,userSearchList)
router.get("/balance",isAuthenticate,userBalanceDetails)
router.post("/update/creditreferrence",setCreditReferrence)
router.post("/generateTransactionPassword",isAuthenticate,validator(generateTransactionPass),generateTransactionPassword);

module.exports = router;
//https://3100dev.fairgame.club/fair-game-wallet/getUserBalanceDetails
