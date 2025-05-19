const express = require('express');
const router = express.Router();
const { getAllButtons, insertButtons, getButton } = require('../controllers/buttonController');

const validator = require('../middleware/joi.validator');
const { CreateButton } = require('../validators/buttonValidator');
const { isAuthenticate } = require('../middleware/auth');


router.get('/', isAuthenticate, getButton);
router.post('/insert', isAuthenticate, validator(CreateButton), insertButtons)

module.exports = router;