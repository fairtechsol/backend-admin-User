const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./authRoutes');

// Define routes
router.use('/auth', authRoutes);

module.exports = router;