const { Between } = require("typeorm");
const { mac88Domain, mac88CasinoOperatorId, socketData, transType, userRoleConstant, walletDomain, casinoProvider, transactionType } = require("../config/contants");
const { getUserRedisData, incrementValuesRedis, incrementRedisBalance, updateUserDataRedis, deleteKeyFromUserRedis, checkAndUpdateTransaction } = require("../services/redis/commonfunction");
const { getTransaction, updateTransactionData, addTransaction } = require("../services/transactionService");
const { updateUserBalanceData, getUserBalanceDataByUserId } = require("../services/userBalanceService");
const { getUserById, getUserDataWithUserBalance, getParentsWithBalance } = require("../services/userService");
const { addVirtualCasinoBetPlaced, getVirtualCasinoBetPlaced, updateVirtualCasinoBetPlaced, getVirtualCasinoBetPlaceds } = require("../services/virtualCasinoBetPlacedsService");
const { sendMessageToUser } = require("../sockets/socketManager");
const { apiCall, apiMethod, allApiRoutes } = require("../utils/apiService");
const { generateRSASignature } = require("../utils/generateCasinoSignature");
const { SuccessResponse, ErrorResponse } = require("../utils/response");
const { logger } = require("../config/logger");
const mac88Games = require("../config/mac88.json");
const moment = require("moment/moment");
exports.loginMac88Casino = async (req, res) => {
    try {
        const { gameId, platformId, providerName } = req.body;
        const userId = req.user.id;
        const userRedisData = await getUserRedisData(userId);

        const userCurrBalance = parseInt(userRedisData?.currentBalance || 0) - parseInt(userRedisData?.exposure || 0);
        const domainUrl = `${req.protocol}://${req.get("host")}`;

        let casinoData = {
            "operatorId": mac88CasinoOperatorId,
            "providerName": providerName,
            "gameId": gameId,
            "userId": userId,
            "username": userRedisData.isDemo ? "Demo" : userRedisData.userName,
            "platformId": platformId,
            "lobby": false,
            "clientIp": "52.56.207.91",
            "currency": "INR",
            "balance": userRedisData.isDemo ? 0 : userCurrBalance,
            "redirectUrl": domainUrl
        }
        let result = await apiCall(apiMethod.post, mac88Domain + allApiRoutes.MAC88.login, casinoData, { Signature: generateRSASignature(JSON.stringify(casinoData)) });

        const userTransaction = await getTransaction({ type: transactionType.virtualCasino, searchId: userId, createdAt: Between(new Date(new Date().setHours(0, 0, 0, 0)), new Date(new Date().setHours(23, 59, 59, 99))) });
        if (!userTransaction) {
            await addTransaction({ searchId: userId, type: transactionType.virtualCasino, userId: userId, actionBy: userId, amount: 0, closingBalance: userCurrBalance, transType: transType.win, description: `${moment().format("MMM DD YYYY hh:mm a")}` });
        }

        return SuccessResponse(
            {
                statusCode: 200,
                data: result,
            },
            req,
            res
        );
    }
    catch (error) {
        return ErrorResponse(
            {
                statusCode: 500,
                message: error.message,
            },
            req,
            res
        );
    }
}

exports.getBalanceMac88 = async (req, res) => {
    try {
        const { userId } = req.body;
        const userRedisData = await getUserRedisData(userId);
        if (!userRedisData) {
            return res.status(400).json({
                "status": "OP_USER_NOT_FOUND"
            });
        }
        let balance = parseFloat(userRedisData.currentBalance || 0) - parseFloat(userRedisData.exposure || 0)
        return res.status(200).json({
            "balance": userRedisData.isDemo ? 0 : balance,
            "status": "OP_SUCCESS"
        });
    }
    catch (error) {
        return res.status(500).json({
            "status": "OP_GENERAL_ERROR"
        });
    }
}

exports.getBetsMac88 = async (req, res) => {
    try {
        const { userId, betType, debitAmount, gameId, operatorId, reqId, roundId, runnerName, token, transactionId } = req.body;

        if (!gameId || gameId == "" || !transactionId || transactionId == "" || reqId == "" || !reqId) {
            return res.status(400).json({
                "status": "OP_INVALID_PARAMS"
            })
        }
        const isTransactionExist = await checkAndUpdateTransaction(userId, transactionId);
        if (!isTransactionExist) {
            return res.status(400).json({
                "status": "OP_DUPLICATE_TRANSACTION"
            });
        }

        if (parseFloat(debitAmount) < 0) {
            return res.status(400).json({
                "status": "OP_ERROR_NEGATIVE_DEBIT_AMOUNT"
            })
        }


        const userRedisData = await getUserRedisData(userId);
        if (!userRedisData) {
            return res.status(400).json({
                "status": "OP_USER_NOT_FOUND"
            })
        }

        if (userRedisData.isDemo) {
            return res.status(400).json({
                "status": "OP_INSUFFICIENT_FUNDS"
            });
        }

        const userData = await getUserById(userId, ["userBlock", "id", "betBlock"]);
        if (userData.betBlock || userData.userBlock) {
            return res.status(400).json({
                "status": "OP_USER_BLOCKED"
            })
        }
        let balance = parseFloat(userRedisData.currentBalance || 0) - parseFloat(userRedisData.exposure || 0)
        if (balance - parseFloat(debitAmount) < 0) {
            return res.status(400).json({
                "status": "OP_INSUFFICIENT_FUNDS"
            })
        }

        await updateUserBalanceData(userId, { balance: -parseFloat(debitAmount) });
        const updatedBalance = parseFloat(await incrementRedisBalance(userId, "currentBalance", -parseFloat(debitAmount)));

        // const currGame = mac88Games.find((item) => item.game_id == gameId);
        let currGame = {};
        let providerName = "";
        outerLoop: for (const provider in mac88Games) {
            const categories = mac88Games[provider];
            for (const category in categories) {
                const games = categories[category];
                for (const game of games) {
                    if (game.game_id === gameId) {
                        currGame = game;
                        providerName = provider;
                        break outerLoop; // Exit all loops when game is found
                    }
                }
            }
            await addVirtualCasinoBetPlaced({
                betType: betType,
                amount: -debitAmount,
                gameId: gameId,
                operatorId: operatorId,
                reqId: reqId,
                roundId: roundId,
                runnerName: runnerName,
                token: token,
                transactionId: transactionId,
                userId: userId,
                providerName: providerName,
                gameName: currGame.game_name
            });

            sendMessageToUser(
                userId,
                socketData.userBalanceUpdateEvent,
                { currentBalance: updatedBalance }
            );
            return res.status(200).json({
                "balance": updatedBalance,
                "status": "OP_SUCCESS"
            });
        }
    catch (error) {
            return res.status(500).json({
                "status": "OP_GENERAL_ERROR"
            });
        }
    }

exports.resultRequestMac88 = async (req, res) => {
        try {
            const { userId, creditAmount, gameId, reqId, transactionId } = req.body;

            if (!gameId || gameId == "" || !transactionId || transactionId == "" || reqId == "" || !reqId) {
                return res.status(400).json({
                    "status": "OP_INVALID_PARAMS"
                })
            }

            const userRedisData = await getUserRedisData(userId);
            if (!userRedisData[transactionId]) {
                const userPrevBetPlaced = await getVirtualCasinoBetPlaced({ transactionId: transactionId }, ["id", "settled", "isRollback"]);
                if (!userPrevBetPlaced) {
                    return res.status(400).json({ status: "OP_TRANSACTION_NOT_FOUND" })
                }
                if (userPrevBetPlaced.settled && userPrevBetPlaced.isRollback) {
                    return res.status(400).json({
                        "status": "OP_ERROR_TRANSACTION_INVALID"
                    })
                }
                if (userPrevBetPlaced.settled) {
                    return res.status(400).json({
                        "status": "OP_DUPLICATE_TRANSACTION"
                    })
                }
            }
            await deleteKeyFromUserRedis(userId, transactionId);
            let currUserData;
            let userBalance;
            if (!userRedisData) {
                currUserData = await getUserBalanceDataByUserId(userId, ["currentBalance", "exposure"])
            }
            else {
                userBalance = await incrementRedisBalance(userId, "currentBalance", parseFloat(creditAmount));
            }
            const balance = parseFloat(userBalance ?? currUserData?.currentBalance) - parseFloat(userRedisData.exposure ?? currUserData?.exposure);
            calculateMac88ResultDeclare(userId, creditAmount, transactionId, userRedisData);
            return res.status(200).json({
                "balance": balance,
                "status": "OP_SUCCESS"
            });
        }
        catch (error) {
            logger.error({
                message: `Error in result request of virtual casino for user ${req.body.transactionId}: `,
                error: error
            });
            return res.status(500).json({
                "status": "OP_GENERAL_ERROR"
            });
        }
    }

    const calculateMac88ResultDeclare = async (userId, creditAmount, transactionId, userRedisData) => {

        let superAdminData = {};
        const user = await getUserDataWithUserBalance({ id: userId });
        if (!user) {
            return res.status(400).json({
                "status": "OP_USER_NOT_FOUND"
            });
        }

        const userPrevBetPlaced = await getVirtualCasinoBetPlaced({ transactionId: transactionId });
        const userCurrProfitLoss = parseFloat(creditAmount) + parseFloat(userPrevBetPlaced.amount);
        const userCurrBalance = parseFloat(user.userBal?.currentBalance) + parseFloat(creditAmount)
        //getting wallet profitloss
        const fwProfitLoss = parseFloat(((-userCurrProfitLoss * user.fwPartnership) / 100).toString());
        logger.info({
            message: `User balance and profit loss during declare of virtual casino for user ${userId}: `,
            data: {
                profitloss: userCurrProfitLoss,
                userBalance: userCurrBalance,
                fwProfitLoss: fwProfitLoss
            }
        });

        await updateUserBalanceData(user.id, {
            profitLoss: userCurrProfitLoss,
            myProfitLoss: userCurrProfitLoss,
            balance: parseFloat(creditAmount)
        });

        if (userRedisData) {
            await incrementValuesRedis(user.id, {
                profitLoss: userCurrProfitLoss,
                myProfitLoss: userCurrProfitLoss,
            });
        }

        sendMessageToUser(
            userId,
            socketData.userBalanceUpdateEvent,
            { currentBalance: userCurrBalance }
        );

        updateVirtualCasinoBetPlaced({ transactionId: transactionId }, { amount: userCurrProfitLoss, settled: true });

        const userTransaction = await getTransaction({ type: transactionType.virtualCasino, searchId: user.id, createdAt: Between(new Date(new Date().setHours(0, 0, 0, 0)), new Date(new Date().setHours(23, 59, 59, 99))) });
        if (!userTransaction) {
            await addTransaction({ searchId: user.id, type: transactionType.virtualCasino, userId: user.id, actionBy: user.id, amount: 0, closingBalance: userCurrBalance, transType: transType.win, description: `${moment().format("MMM DD YYYY hh:mm a")}` });
        } else {
            await updateTransactionData(userTransaction?.id, { amount: userCurrProfitLoss });
        }

        if (user.createBy === user.id) {
            superAdminData[user.id] = {
                role: user.roleName,
                balance: userCurrBalance,
                profitLoss: userCurrProfitLoss,
                myProfitLoss: userCurrProfitLoss,
            };
        }

        let parentUsers = await getParentsWithBalance(user.id);
        for (const patentUser of parentUsers) {
            let upLinePartnership = 100;
            if (patentUser.roleName === userRoleConstant.superAdmin) {
                upLinePartnership = user.fwPartnership + user.faPartnership;
            } else if (patentUser.roleName === userRoleConstant.admin) {
                upLinePartnership = user.fwPartnership + user.faPartnership + user.saPartnership;
            } else if (patentUser.roleName === userRoleConstant.superMaster) {
                upLinePartnership = user.fwPartnership + user.faPartnership + user.saPartnership + user.aPartnership;
            } else if (patentUser.roleName === userRoleConstant.master) {
                upLinePartnership = user.fwPartnership + user.faPartnership + user.saPartnership + user.aPartnership + user.smPartnership;
            }
            else if (patentUser.roleName === userRoleConstant.agent) {
                upLinePartnership = user.fwPartnership + user.faPartnership + user.saPartnership + user.aPartnership + user.smPartnership + user.mPartnership;
            }

            let myProfitLoss = parseFloat(
                (((userCurrProfitLoss) * upLinePartnership) / 100).toString()
            );

            await updateUserBalanceData(patentUser.id, {
                profitLoss: userCurrProfitLoss,
                myProfitLoss: -myProfitLoss,
                balance: 0
            });

            let parentUserRedisData = await getUserRedisData(patentUser.id);
            if (parentUserRedisData) {

                await incrementValuesRedis(patentUser.id, {
                    profitLoss: userCurrProfitLoss,
                    myProfitLoss: -myProfitLoss,
                });
            }

            logger.info({
                message: `User balance and profit loss during declare of virtual casino for parent ${patentUser.id}: `,
                data: {
                    profitloss: userCurrProfitLoss,
                    myProfitLoss: -myProfitLoss,
                }
            });
            if (patentUser.createBy === patentUser.id) {
                superAdminData[patentUser.id] = {
                    balance: 0,
                    profitLoss: userCurrProfitLoss,
                    myProfitLoss: -myProfitLoss,
                    role: patentUser.roleName,
                };
            }
        }

        let walletData = {
            profitLoss: userCurrProfitLoss,
            fairgameAdminPL: user.superParentType == userRoleConstant.fairGameAdmin ? {
                id: user.superParentId,
                myProfitLoss: -parseFloat(
                    (((userCurrProfitLoss) * user.faPartnership) / 100).toString()
                )
            } : null,
            fairgameWalletPL: fwProfitLoss,
            superAdminData: superAdminData
        }
        logger.info({
            message: `wallet data for virtual casino result declare: `,
            data: walletData
        });
        apiCall(apiMethod.post, walletDomain + allApiRoutes.WALLET.virtualCasinoResult, walletData);
    }

    exports.rollBackRequestMac88 = async (req, res) => {
        try {
            const { userId, rollbackAmount: creditAmount, transactionId, gameId, reqId } = req.body;

            if (!gameId || gameId == "" || !transactionId || transactionId == "" || reqId == "" || !reqId) {
                return res.status(400).json({
                    "status": "OP_INVALID_PARAMS"
                })
            }

            const userRedisData = await getUserRedisData(userId);
            if (!userRedisData[transactionId]) {
                const userPrevBetPlaced = await getVirtualCasinoBetPlaced({ transactionId: transactionId }, ["id", "settled"]);
                if (!userPrevBetPlaced) {
                    return res.status(400).json({ status: "OP_TRANSACTION_NOT_FOUND" })
                }
                if (userPrevBetPlaced?.settled) {
                    return res.status(400).json({
                        "status": "OP_DUPLICATE_TRANSACTION"
                    })
                }
            }
            await deleteKeyFromUserRedis(userId, transactionId);
            let currUserData;
            let userBalance;
            if (!userRedisData) {
                currUserData = await getUserBalanceDataByUserId(userId, ["currentBalance", "exposure"])
            }
            else {
                userBalance = await incrementRedisBalance(userId, "currentBalance", parseFloat(creditAmount));
            }
            const balance = parseFloat(userBalance ?? currUserData?.currentBalance) - parseFloat(userRedisData.exposure ?? currUserData?.exposure) + parseFloat(creditAmount);
            calculateMac88ResultUnDeclare(userId, creditAmount, transactionId);

            return res.status(200).json({
                "balance": balance,
                "status": "OP_SUCCESS"
            });
        }
        catch (error) {
            logger.error({
                message: `Error in rollback request of virtual casino for user ${req.body.transactionId}: `,
                error: error
            });
            return res.status(500).json({
                "status": "OP_GENERAL_ERROR"
            });
        }
    }

    const calculateMac88ResultUnDeclare = async (userId, creditAmount, transactionId) => {
        const user = await getUserDataWithUserBalance({ id: userId });
        if (!user) {
            return res.status(400).json({
                "status": "OP_USER_NOT_FOUND"
            });
        }
        const userCurrProfitLoss = 0;
        const userCurrBalance = parseFloat(user?.userBal?.currentBalance) + parseFloat(creditAmount);
        await updateUserBalanceData(user.id, {
            balance: parseFloat(creditAmount)
        });
        sendMessageToUser(
            userId,
            socketData.userBalanceUpdateEvent,
            { currentBalance: userCurrBalance }
        );
        updateVirtualCasinoBetPlaced({ transactionId: transactionId }, { amount: userCurrProfitLoss, settled: true, isRollback: true });
    }

    exports.getMac88GameList = async (req, res) => {
        try {
            // let casinoData = {
            //     "operator_id": mac88CasinoOperatorId
            // }
            // let result = await apiCall(apiMethod.post, mac88Domain + allApiRoutes.MAC88.gameList, casinoData, { Signature: generateRSASignature(JSON.stringify(casinoData)) });

            // let result = {
            //     data: mac88Games
            // }
            // result = result?.data?.reduce((prev, curr) => {
            //     return { ...prev, [curr.provider_name]: { ...(prev[curr.provider_name] || {}), [curr?.category]: [...(prev?.[curr.provider_name]?.[curr.category] || []), curr] } }
            // }, {});
            return SuccessResponse(
                {
                    statusCode: 200,
                    data: mac88Games,
                },
                req,
                res
            );
        }
        catch (error) {
            return ErrorResponse(
                {
                    statusCode: 500,
                    message: error.message,
                },
                req,
                res
            );
        }
    }

    exports.getBetVirtualGames = async (req, res) => {
        try {
            const userId = req.params.userId || req.user.id;
            const query = req.query;

            if (!userId) {
                return ErrorResponse(
                    {
                        statusCode: 403,
                        message: {
                            msg: "userNotSelect",
                        },
                    },
                    req,
                    res
                );
            }

            const bets = await getVirtualCasinoBetPlaceds({ userId: userId }, query);
            SuccessResponse(
                {
                    statusCode: 200,
                    data: bets,
                },
                req,
                res
            );
        }
        catch (error) {
            return ErrorResponse(
                {
                    statusCode: 500,
                    message: error.message,
                },
                req,
                res
            );
        }
    }

    exports.getProviderList = async (req, res) => {
        try {
            SuccessResponse(
                {
                    statusCode: 200,
                    data: casinoProvider,
                },
                req,
                res
            );
        }
        catch (error) {
            return ErrorResponse(
                {
                    statusCode: 500,
                    message: error.message,
                },
                req,
                res
            );
        }
    }