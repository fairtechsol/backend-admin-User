const express = require('express');
const router = express.Router();
const {updateUserBalance, settleCommissions} = require('../controllers/userBalanceController');

const validator = require('../middleware/joi.validator')
const {SetUserBalance, settleCommission} = require('../validators/userBalanceValidator');
const { isAuthenticate,checkTransactionPassword } = require('../middleware/auth');

router.post("/update",isAuthenticate,checkTransactionPassword,validator(SetUserBalance),updateUserBalance);
router.post("/settle/commission", isAuthenticate, validator(settleCommission), settleCommissions);
module.exports = router;