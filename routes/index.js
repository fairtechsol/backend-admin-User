const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const buttonRoutes = require('./buttonRoutes');
const transactionsRoutes = require('./transactionRoutes');
const userBalanceRoutes = require('./userBalanceRoutes');
const fairgameWalletRoutes = require('./fairgameWalletRoutes');
const expertRoutes = require('./expertRoutes.js');
const matchRoutes = require("./matchRoutes");
const betRoutes = require("./betRoutes.js");
const cardRoutes = require("./cardRoutes.js");
const { pendingCardResult } = require('../controllers/matchController.js');


// Define routes
router.use('/auth', authRoutes
// #swagger.tags = ['auth']
);
router.use('/user', userRoutes
// #swagger.tags = ['user']
);
router.use('/button', buttonRoutes
// #swagger.tags = ['button']
);
router.use('/transaction', transactionsRoutes
// #swagger.tags = ['transaction']
);
router.use('/balance', userBalanceRoutes
// #swagger.tags = ['balance']
);
router.use('/fairgameWallet', fairgameWalletRoutes 
// #swagger.tags = ['fairgame wallet']
);
router.use('/expert', expertRoutes 
// #swagger.tags = ['expert']
);
router.use("/match", matchRoutes
// #swagger.tags = ['match']
);
router.use("/bet", betRoutes
// #swagger.tags = ['bet']
);
router.use("/card", cardRoutes
// #swagger.tags = ['card']
);

router.get("/pendingCardResult", pendingCardResult)

module.exports = router;