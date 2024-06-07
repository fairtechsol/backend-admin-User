const express = require('express');
const router = express.Router();
const validator = require('../middleware/joi.validator')
const { isAuthenticate } = require('../middleware/auth');
const { matchDetails, listMatch, matchDetailsForFootball, listRacingCountryCode, listRacingMatch, raceDetails, listSearchMatch, cardMatchDetails } = require('../controllers/matchController');
const { addMatch, raceAdd } = require('../controllers/expertController');
const { addMatchValidate, addRaceValidate } = require('../validators/matchValidator');

router.get('/list', isAuthenticate, listMatch);
router.get('/search/:keyword', isAuthenticate, listSearchMatch);
//racing list
router.get('/countryWiseList', isAuthenticate, listRacingCountryCode);
router.get('/racing/list', isAuthenticate, listRacingMatch);
router.get('/racing/:id', isAuthenticate, raceDetails);

router.get('/card/:type', isAuthenticate, cardMatchDetails);

router.get('/:id', isAuthenticate, matchDetails);
router.get('/other/:id', isAuthenticate, matchDetailsForFootball);
router.post('/add', validator(addMatchValidate), addMatch);
router.post('/raceAdd', validator(addRaceValidate), raceAdd);


module.exports = router;