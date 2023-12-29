const express = require('express');
const router = express.Router();
const {getBet} = require('../controllers/betPlacedController');

const validator = require('../middleware/joi.validator');
const { isAuthenticate } = require('../middleware/auth');


router.get('/',isAuthenticate,getBet);

module.exports = router;