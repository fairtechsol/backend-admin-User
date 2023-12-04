const express = require('express');
const router = express.Router();
const {createUser, lockUnlockUser,insertWallet, changePassword} = require('../controllers/userController');

const validator = require('../middleware/joi.validator')
const {CreateUser, ChangePassword} = require('../validators/userValidator');
const { isAuthenticate } = require('../middleware/auth');


const {CreateUser, LockUnlockUser} = require('../validators/userValidator')


router.post('/add',isAuthenticate,validator(CreateUser),createUser);
router.post('/lockUnlockUser', validator(LockUnlockUser), lockUnlockUser);
router.post('/insert/wallet',insertWallet)
router.post('/changePassword',isAuthenticate,validator(ChangePassword),changePassword);

module.exports = router;