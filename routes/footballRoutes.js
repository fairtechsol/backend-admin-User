const express = require('express');
const router = express.Router();

const { isAuthenticate } = require('../middleware/auth');
const { matchDetailsForFootball} = require('../controllers/matchController');



router.get('/:id', isAuthenticate, matchDetailsForFootball);


module.exports = router;