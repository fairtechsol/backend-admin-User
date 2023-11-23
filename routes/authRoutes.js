const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

const validator = require('../middleware/joi.validator')

const {signUp,Login} = require('../validators/authValidator')


router.post('/login',validator(Login),authController.login);
router.post('/signup',validator(signUp), authController.signup)

// const subscribeService = require("../services/redis/externalRedisSubscriber");

router.post('/dummyFunction', authController.dummyFunction);

// Start listening for messages
// subscribeService.receiveMessages();


module.exports = router;