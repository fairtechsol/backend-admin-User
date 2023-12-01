const express = require('express');
const router = express.Router();
const {updateUserBalance, addFGWalletBalance} = require('../controllers/userBalanceController');

const validator = require('../middleware/joi.validator')
const {SetUserBalance} = require('../validators/userBalanceValidator');
const { isAuthenticate } = require('../middleware/auth');

router.post('/add/wallet',addFGWalletBalance)
router.post("/update",isAuthenticate,validator(SetUserBalance),updateUserBalance)
module.exports = router;