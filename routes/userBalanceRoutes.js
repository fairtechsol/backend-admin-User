const express = require('express');
const router = express.Router();
const {updateUserBalance} = require('../controllers/userBalanceController');

const validator = require('../middleware/joi.validator')
const {SetUserBalance} = require('../validators/userBalanceValidator');
const { isAuthenticate,checkTransactionPassword } = require('../middleware/auth');

router.post("/update",isAuthenticate,checkTransactionPassword,validator(SetUserBalance),updateUserBalance)
module.exports = router;