const express = require('express');
const router = express.Router();
const {createUser,insertWallet, changePassword, updateUser,setExposureLimit, userList, userSearchList,userBalanceDetails} = require('../controllers/userController');

const validator = require('../middleware/joi.validator')
const {CreateUser, ChangePassword,updateUserValid,setExposureLimitValid} = require('../validators/userValidator');
const { isAuthenticate } = require('../middleware/auth');




router.post('/add',isAuthenticate,validator(CreateUser),createUser);
router.post('/updateUser',validator(updateUserValid),updateUser);
router.post('/insert/wallet',insertWallet)
router.post('/changePassword',isAuthenticate,validator(ChangePassword),changePassword);
router.post("/update/exposure",validator(setExposureLimitValid),setExposureLimit)
router.post("/list",userList)
router.post("/search",userSearchList)
router.get("/balance",userBalanceDetails)
module.exports = router;
//https://3100dev.fairgame.club/fair-game-wallet/getUserBalanceDetails