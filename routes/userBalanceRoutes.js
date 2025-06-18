const express = require('express');
const router = express.Router();
const { updateUserBalance, settleCommissions } = require('../controllers/userBalanceController');

const validator = require('../middleware/joi.validator')
const { SetUserBalance, settleCommission } = require('../validators/userBalanceValidator');
const { isAuthenticate, checkTransactionPassword } = require('../middleware/auth');
const { permissions } = require('../config/contants');
const { checkAuthorize } = require('../middleware/checkAccess');

router.post("/update", isAuthenticate, checkAuthorize(permissions.deposit, permissions.withdraw), checkTransactionPassword, validator(SetUserBalance), updateUserBalance);
router.post("/settle/commission", isAuthenticate, validator(settleCommission), settleCommissions);
module.exports = router;