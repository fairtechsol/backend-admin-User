const express = require("express");
const router = express.Router();
const { getNotification, getMatchCompetitionsByType, getMatchDatesByCompetitionId, getMatchDatesByCompetitionIdAndDate } = require("../controllers/expertController.js");

const { isAuthenticate } = require("../middleware/auth");

router.get("/notification", isAuthenticate, getNotification);

router.get('/match/competitionList/:type',isAuthenticate,getMatchCompetitionsByType);
router.get('/match/competition/dates/:competitionId',isAuthenticate,getMatchDatesByCompetitionId);
router.get('/match/competition/getMatch/:competitionId/:date',isAuthenticate,getMatchDatesByCompetitionIdAndDate);

module.exports = router;