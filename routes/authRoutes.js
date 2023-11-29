const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

const validator = require('../middleware/joi.validator')

const {Login} = require('../validators/authValidator');
const { isAuthenticate } = require('../middleware/auth');


router.post('/login',validator(Login), authController.login);
router.post('/logout',isAuthenticate, authController.logout);

// const subscribeService = require("../services/redis/externalRedisSubscriber");

router.post('/dummyFunction', authController.dummyFunction);

// Start listening for messages
// subscribeService.receiveMessages();


module.exports = router;