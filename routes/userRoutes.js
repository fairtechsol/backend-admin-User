const express = require('express');
const router = express.Router();
const {createUser,insertWallet, changePassword, updateUser,setExposureLimit, userList, userSearchList,userBalanceDetails, setCreditReferrence} = require('../controllers/userController');

const validator = require('../middleware/joi.validator')
const {CreateUser, ChangePassword,updateUserValid,setExposureLimitValid} = require('../validators/userValidator');
const { isAuthenticate } = require('../middleware/auth');




router.post('/add',isAuthenticate,validator(CreateUser),createUser);
router.post('/updateUser',validator(updateUserValid),updateUser);
router.post('/insert/wallet',insertWallet)
router.post('/changePassword',isAuthenticate,validator(ChangePassword),changePassword);
router.post("/update/exposurelimit",validator(setExposureLimitValid),setExposureLimit)
router.get("/list",isAuthenticate,userList)
router.get("/searchlist",isAuthenticate,userSearchList)
router.get("/balance",userBalanceDetails)
router.post("/update/creditreferrence",setCreditReferrence)
module.exports = router;
//https://3100dev.fairgame.club/fair-game-wallet/getUserBalanceDetails