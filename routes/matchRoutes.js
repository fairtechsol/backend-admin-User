const express = require('express');
const router = express.Router();

const { isAuthenticate } = require('../middleware/auth');
const { matchDetails, listMatch } = require('../controllers/matchController');




router.get('/list',listMatch);
router.get('/:id',isAuthenticate,matchDetails);

module.exports = router;