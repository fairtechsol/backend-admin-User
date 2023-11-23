const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const validator = require('../middleware/joi.validator')

const {signUp,Login} = require('../validators/authValidator')


router.post('/login',validator(Login),authController.login);
router.post('/signup',validator(signUp), authController.signup)

module.exports = router;