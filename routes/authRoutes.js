const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
// const subscribeService = require("../services/redis/externalRedisSubscriber");

router.post('/login', authController.login);

// Start listening for messages
// subscribeService.receiveMessages();

module.exports = router;