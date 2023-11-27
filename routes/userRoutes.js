const express = require('express');
const router = express.Router();
const {createUser} = require('../controllers/userController');

const validator = require('../middleware/joi.validator')

const {CreateUser} = require('../validators/userValidator')


router.post('/add',validator(CreateUser),createUser);


module.exports = router;