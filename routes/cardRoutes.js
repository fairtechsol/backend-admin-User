const express = require("express");
const { isAuthenticate } = require("../middleware/auth");
const { getCardResultByFGWallet, getCardResultDetailByFGWallet } = require("../controllers/cardController");
const { checkAuthorize } = require("../middleware/checkAccess");
const { permissions } = require("../config/contants");
const router = express.Router();

router.get("/result/:type", isAuthenticate, checkAuthorize(permissions.casinoResult), getCardResultByFGWallet);
router.get("/result/detail/:id", isAuthenticate, getCardResultDetailByFGWallet);


module.exports = router;
