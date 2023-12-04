const express = require('express');
const router = express.Router();
const {createUser,insertWallet, changePassword, userLock} = require('../controllers/userController');

const validator = require('../middleware/joi.validator')
const {CreateUser, ChangePassword} = require('../validators/userValidator');
const { isAuthenticate } = require('../middleware/auth');




router.post('/add',isAuthenticate,validator(CreateUser),createUser);
router.post('/insert/wallet',insertWallet)
router.post('/block',isAuthenticate,userLock);
router.post('/changePassword',isAuthenticate,validator(ChangePassword),changePassword);

module.exports = router;