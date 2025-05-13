const express = require('express');
const router = express.Router();
const { isAuthenticate } = require('../middleware/auth');
const { matchDetails, listMatch, listRacingCountryCode, listRacingMatch, raceDetails, listSearchMatch, cardMatchDetails, marketAnalysis, initialCardMatchDetails, marketWiseUserBook, userEventWiseExposure } = require('../controllers/matchController');

router.get('/list', isAuthenticate, listMatch);
router.get('/search/:keyword', isAuthenticate, listSearchMatch);
//racing list
router.get('/countryWiseList', isAuthenticate, listRacingCountryCode);
router.get('/racing/list', isAuthenticate, listRacingMatch);
router.get('/racing/:id', isAuthenticate, raceDetails);

//card details
router.get('/card/:type', isAuthenticate, cardMatchDetails);
router.get('/initial/card/:type', isAuthenticate, initialCardMatchDetails);

router.get('/marketAnalysis',isAuthenticate, marketAnalysis);
router.get('/:id', isAuthenticate, matchDetails);

router.get('/marketWise/userBook/:matchId', isAuthenticate, marketWiseUserBook);
router.get('/eventWise/exposure/:userId', isAuthenticate, userEventWiseExposure);


module.exports = router;