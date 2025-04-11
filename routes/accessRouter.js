const express = require('express');
const router = express.Router();

const validator = require('../middleware/joi.validator')

const { isAuthenticate, checkTransactionPassword } = require('../middleware/auth');
const { createAccessUser, getAccessUser, lockUnlockAccessUser } = require('../controllers/accessUserController');
const { CreateAccessUser, LockAccessUser } = require('../validators/accessUserValidator');


router.route("/")
    .post(isAuthenticate, checkTransactionPassword, validator(CreateAccessUser), createAccessUser)
    .get(isAuthenticate, getAccessUser);

    router.route("/lock")
    .post(isAuthenticate, checkTransactionPassword, validator(LockAccessUser), lockUnlockAccessUser)

module.exports = router;