const express = require("express");
const { isAuthenticate } = require("../middleware/auth");
const { getCardResultByFGWallet } = require("../controllers/cardController");
const router = express.Router();

router.get("/result/:type", isAuthenticate, getCardResultByFGWallet);

module.exports = router;
