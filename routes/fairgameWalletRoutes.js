const express = require("express");
const router = express.Router();
const {  checkVerifiedBets } = require("../controllers/fairgameWalletController");
const { isUserExist } = require("../controllers/userController");


router.get("/user/exist", isUserExist);
router.post('/checkVerifyBet', checkVerifiedBets);

module.exports = router;
