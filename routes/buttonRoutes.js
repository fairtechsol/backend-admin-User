const express = require('express');
const router = express.Router();
const {getAllButtons, insertButtons} = require('../controllers/buttonController');

const validator = require('../middleware/joi.validator');
const { CreateButton } = require('../validators/buttonValidator');


router.get('/',getAllButtons);
router.post('/insert',validator(CreateButton),insertButtons)

module.exports = router;