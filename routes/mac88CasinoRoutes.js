const express = require('express');
const router = express.Router();
const { isAuthenticate } = require('../middleware/auth');
const validator = require('../middleware/joi.validator')
const { loginMac88Casino, getBalanceMac88, getBetsMac88, resultRequestMac88, rollBackRequestMac88 } = require('../controllers/mac88CasinoController');
const { casinoLoginValidate } = require('../validators/mac88CasinoValidator');


router.post('/mac88/casino/login', isAuthenticate, validator(casinoLoginValidate), loginMac88Casino);
router.post('/balance', getBalanceMac88);
router.post('/betrequest', getBetsMac88);
router.post('/resultrequest', resultRequestMac88);
router.post('/rollbackrequest', rollBackRequestMac88);

module.exports = router;