const express = require('express');
const router = express.Router();
const {createUser, lockUnlockUser,insertWallet} = require('../controllers/userController');

const validator = require('../middleware/joi.validator')

const {CreateUser, LockUnlockUser} = require('../validators/userValidator')


router.post('/add',validator(CreateUser),createUser);
router.post('/lockUnlockUser', validator(LockUnlockUser), lockUnlockUser);
router.post('/insert/wallet',insertWallet)

module.exports = router;