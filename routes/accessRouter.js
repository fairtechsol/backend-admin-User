const express = require('express');
const router = express.Router();

const validator = require('../middleware/joi.validator')

const { isAuthenticate, checkTransactionPassword } = require('../middleware/auth');
const { createAccessUser, getAccessUser, lockUnlockAccessUser, changeAccessUserPassword } = require('../controllers/accessUserController');
const { CreateAccessUser, LockAccessUser, ChangePassword } = require('../validators/accessUserValidator');


router.route("/")
    .post(isAuthenticate, checkTransactionPassword, validator(CreateAccessUser), createAccessUser)
    .get(isAuthenticate, getAccessUser);

router.route("/lock")
    .post(isAuthenticate, checkTransactionPassword, validator(LockAccessUser), lockUnlockAccessUser)

router.route("/change/password")
    .post(isAuthenticate, checkTransactionPassword, validator(ChangePassword), changeAccessUserPassword)

module.exports = router;