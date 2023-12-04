const express = require('express');
const router = express.Router();
const {createUser,insertWallet, changePassword, generateTransactionPassword} = require('../controllers/userController');

const validator = require('../middleware/joi.validator')
const {CreateUser, ChangePassword, generateTransactionPass} = require('../validators/userValidator');
const { isAuthenticate } = require('../middleware/auth');




router.post('/add',isAuthenticate,validator(CreateUser),createUser);
router.post('/insert/wallet',insertWallet)
router.post('/changePassword',isAuthenticate,validator(ChangePassword),changePassword);
router.post("/generateTransactionPassword",isAuthenticate,validator(generateTransactionPass),generateTransactionPassword);

module.exports = router;