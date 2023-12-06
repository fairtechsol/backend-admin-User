const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes')
const buttonRoutes = require('./buttonRoutes')
const transactionsRoutes = require('./transactionRoutes')
const userBalanceRoutes = require('./userBalanceRoutes')
// Define routes
router.use('/auth', authRoutes);
router.use('/user',userRoutes)
router.use('/button',buttonRoutes)
router.use('/transaction',transactionsRoutes)
router.use('/balance',userBalanceRoutes)
module.exports = router;