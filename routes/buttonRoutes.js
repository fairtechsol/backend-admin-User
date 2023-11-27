const express = require('express');
const router = express.Router();
const {getAllButtons, insertButtons} = require('../controllers/buttonController');

const validator = require('../middleware/joi.validator')


router.get('/',getAllButtons);
router.get('/insert',insertButtons)

module.exports = router;