const express = require('express');
const router = express.Router();

const validator = require('../middleware/joi.validator')

const { isAuthenticate, checkTransactionPassword } = require('../middleware/auth');
const { createAccessUser, getAccessUser } = require('../controllers/accessUserController');
const { CreateAccessUser } = require('../validators/accessUserValidator');


router.route("/")
    .get(isAuthenticate, checkTransactionPassword, validator(CreateAccessUser), createAccessUser)
    .post(isAuthenticate, getAccessUser); // example controller

module.exports = router;