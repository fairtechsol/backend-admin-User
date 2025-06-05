const express = require('express');
const router = express.Router();
const { isAuthenticate } = require('../middleware/auth');
const { getAccountStatement } = require('../controllers/transactionController');
const { permissions } = require('../config/contants');
const { checkAuthorize } = require('../middleware/checkAccess');


router.get('/get/:userId', isAuthenticate, checkAuthorize(permissions.accountStatement), getAccountStatement);

module.exports = router;