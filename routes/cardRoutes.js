const express = require("express");
const { isAuthenticate } = require("../middleware/auth");
const { getCardResultByFGWallet, getCardResultDetailByFGWallet } = require("../controllers/cardController");
const router = express.Router();

router.get("/result/:type", isAuthenticate, getCardResultByFGWallet);
router.get("/result/detail/:id", isAuthenticate, getCardResultDetailByFGWallet);


module.exports = router;
