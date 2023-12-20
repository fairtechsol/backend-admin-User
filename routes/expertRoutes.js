const express = require("express");
const router = express.Router();
const { getNotification } = require("../controllers/expertController.js");

const { isAuthenticate } = require("../middleware/auth");

router.get("/notification", isAuthenticate, getNotification);

module.exports = router;