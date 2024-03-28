const express = require('express');
const router = express.Router();
const validator = require('../middleware/joi.validator')
const { isAuthenticate } = require('../middleware/auth');
const { matchDetails, listMatch,matchDetailsForFootball } = require('../controllers/matchController');
const { addMatch } = require('../controllers/expertController');
const { addMatchValidate } = require('../validators/matchValidator');

router.get('/list', isAuthenticate, listMatch);
router.get('/:id', isAuthenticate, matchDetails);
router.get('/other/:id', isAuthenticate, matchDetailsForFootball);
router.post('/add', validator(addMatchValidate), addMatch);

module.exports = router;