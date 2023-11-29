const express = require('express');
const router = express.Router();
const validator = require('../middleware/joi.validator')
const { isAuthenticate } = require('../middleware/auth');
const { getAccountStatement } = require('../controllers/transactionController');


router.get('/get/:userId',isAuthenticate,getAccountStatement);

module.exports = router;