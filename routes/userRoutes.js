const express = require('express');
const router = express.Router();
const {createUser,insertWallet} = require('../controllers/userController');

const validator = require('../middleware/joi.validator')

const {CreateUser} = require('../validators/userValidator');
const { isAuthenticate } = require('../middleware/auth');


router.post('/add',isAuthenticate,validator(CreateUser),createUser);
router.post('/insert/wallet',insertWallet)

module.exports = router;