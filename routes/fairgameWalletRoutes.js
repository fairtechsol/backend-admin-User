const express = require("express");
const router = express.Router();
const {  checkVerifiedBets, getBetCount } = require("../controllers/fairgameWalletController");
const { isUserExist } = require("../controllers/userController");


router.get("/user/exist", isUserExist);
router.get("/betCounts", getBetCount);
router.post('/checkVerifyBet', checkVerifiedBets);

module.exports = router;
