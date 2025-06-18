const express = require('express');
const router = express.Router();

const validator = require('../middleware/joi.validator')

const { isAuthenticate, checkTransactionPassword } = require('../middleware/auth');
const { createAccessUser, getAccessUser, lockUnlockAccessUser, changeAccessUserPassword } = require('../controllers/accessUserController');
const { CreateAccessUser, LockAccessUser, ChangePassword } = require('../validators/accessUserValidator');
const { checkAuthorize } = require('../middleware/checkAccess');
const { permissions } = require('../config/contants');


router.route("/")
    .post(isAuthenticate, checkAuthorize(permissions.loginUserCreation), checkTransactionPassword, validator(CreateAccessUser), createAccessUser)
    .get(isAuthenticate, checkAuthorize(permissions.loginUserCreation), getAccessUser);

router.route("/lock")
    .post(isAuthenticate, checkAuthorize(permissions.loginUserCreation), checkTransactionPassword, validator(LockAccessUser), lockUnlockAccessUser)

router.route("/change/password")
    .post(isAuthenticate, checkAuthorize(permissions.loginUserCreation), checkTransactionPassword, validator(ChangePassword), changeAccessUserPassword)

module.exports = router;