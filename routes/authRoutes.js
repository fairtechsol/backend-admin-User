const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

const validator = require('../middleware/joi.validator')

const { Login, connectUserAuthValidator, verifyAuthTokenValidator, generateAuthTokenValidator } = require('../validators/authValidator');
const { isAuthenticate } = require('../middleware/auth');


router.post('/login', validator(Login), authController.login);
router.post('/logout', isAuthenticate, authController.logout);
router.post('/generateAuthToken', isAuthenticate, validator(generateAuthTokenValidator), authController.generateUserAuthToken);
router.post('/connectAuthApp', validator(connectUserAuthValidator), authController.connectUserAuthToken);
router.get('/authRefreshToken/:deviceId', authController.getAuthenticatorRefreshToken);
router.post('/verifyAuthToken', isAuthenticate, validator(verifyAuthTokenValidator), authController.verifyAuthenticatorRefreshToken);
router.post('/removeAuthenticator', isAuthenticate, validator(verifyAuthTokenValidator), authController.removeAuthenticator);
router.get('/getAuthUsers/:deviceId', authController.getAuthenticatorUsersList);
router.post('/resend/token',isAuthenticate, authController.resendTelegramAuthToken);
router.get('/getAuthenticator',isAuthenticate, authController.getAuthenticatorUser);



module.exports = router;