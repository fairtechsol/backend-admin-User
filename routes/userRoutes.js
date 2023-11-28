const express = require('express');
const router = express.Router();
const {createUser,insertWallet, changePassword} = require('../controllers/userController');

const validator = require('../middleware/joi.validator')

const {CreateUser} = require('../validators/userValidator');
const { isAuthenticate } = require('../middleware/auth');


router.post('/add',validator(CreateUser),createUser);
router.post('/insert/wallet',insertWallet);
router.post('/changePassword',isAuthenticate,changePassword);

module.exports = router;