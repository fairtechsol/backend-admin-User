const express = require("express");
const router = express.Router();
const { getNotification, getMatchCompetitionsByType, getMatchDatesByCompetitionId, getMatchDatesByCompetitionIdAndDate, getBlinkingTabs } = require("../controllers/expertController.js");

const { isAuthenticate } = require("../middleware/auth");
const { checkAuthorize } = require("../middleware/checkAccess.js");
const { permissions } = require("../config/contants.js");

router.get("/notification", getNotification);
router.get("/blinkingTabs", isAuthenticate, getBlinkingTabs);

router.get('/match/competitionList/:type',isAuthenticate,checkAuthorize(permissions.events),getMatchCompetitionsByType);
router.get('/match/competition/dates/:competitionId',isAuthenticate,checkAuthorize(permissions.events),getMatchDatesByCompetitionId);
router.get('/match/competition/getMatch/:competitionId/:date', isAuthenticate, checkAuthorize(permissions.events), getMatchDatesByCompetitionIdAndDate);

module.exports = router;