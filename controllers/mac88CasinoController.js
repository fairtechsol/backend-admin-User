const { ILike } = require("typeorm");
const { mac88Domain, mac88CasinoOperatorId, socketData, transType, userRoleConstant, walletDomain } = require("../config/contants");
const { getUserRedisData, incrementValuesRedis } = require("../services/redis/commonfunction");
const { getTransactions, getTransaction, updateTransactionData, addTransaction } = require("../services/transactionService");
const { updateUserBalanceData } = require("../services/userBalanceService");
const { getUserById, getUserWithUserBalance, getUserDataWithUserBalance, getParentsWithBalance } = require("../services/userService");
const { addVirtualCasinoBetPlaced, getVirtualCasinoBetPlaced, updateVirtualCasinoBetPlaced } = require("../services/virtualCasinoBetPlacedsService");
const { sendMessageToUser } = require("../sockets/socketManager");
const { apiCall, apiMethod, allApiRoutes } = require("../utils/apiService");
const { generateRSASignature } = require("../utils/generateCasinoSignature");
const { SuccessResponse, ErrorResponse } = require("../utils/response");
const { logger } = require("../config/logger");

exports.loginMac88Casino = async (req, res) => {
    try {
        const { gameId, platformId, providerName } = req.body;

        const user = await getUserById(req.user.id, ["id", "userName", "isDemo"]);
        if (user.isDemo) {
            return ErrorResponse({ statusCode: 403, message: { msg: "user.demoNoAccess" } }, req, res);
        }
        const userRedisData = await getUserRedisData(user.id);

        let casinoData = {
            "operatorId": mac88CasinoOperatorId,
            "providerName": providerName,
            "gameId": gameId,
            "userId": user.id,
            "username": user.userName,
            "platformId": platformId,
            "lobby": false,
            "clientIp": "52.56.207.91",
            "currency": "INR",
            "balance": parseInt(userRedisData?.currentBalance || 0) - parseInt(userRedisData?.exposure || 0),
            "redirectUrl": "https://devmaxbet9api.fairgame.club"
        }
        let result;
        if (userRedisData) {
            result = await apiCall(apiMethod.post, mac88Domain + allApiRoutes.MAC88.login, casinoData, { Signature: generateRSASignature(JSON.stringify(casinoData)) });
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
            })
        }
        let balance = parseFloat(userRedisData?.currentBalance || 0) - parseFloat(userRedisData?.exposure || 0)


        return res.status(200).json({
            "balance": balance,
            "status": "OP_SUCCESS"
        })
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

exports.getBetsMac88 = async (req, res) => {
    try {
        const { userId, betType, debitAmount, gameId, operatorId, reqId, roundId, runnerName, token, transactionId } = req.body;
        const userRedisData = await getUserRedisData(userId);
        if (!userRedisData) {
            return res.status(400).json({
                "status": "OP_USER_NOT_FOUND"
            })
        }

        const userData = await getUserById(userId, ["userBlock", "id", "betBlock"]);
        if (userData?.betBlock || userData?.userBlock) {
            return res.status(400).json({
                "status": "OP_USER_BLOCKED"
            })
        }
        let balance = parseFloat(userRedisData?.currentBalance || 0) - parseFloat(userRedisData?.exposure || 0)
        if (balance <= 0) {
            return res.status(400).json({
                "status": "OP_INSUFFICIENT_FUNDS"
            })
        }

        await updateUserBalanceData(userId, { balance: -parseFloat(debitAmount) });
        await incrementValuesRedis(userId, { balance: -parseFloat(debitAmount) });

        const updatedBalance = parseFloat(balance) - parseFloat(debitAmount);

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
            userId: userId
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

exports.resultRequestMac88 = async (req, res) => {
    try {
        const { userId, creditAmount, gameId, roundId, transactionId } = req.body;
        let superAdminData = {};
        const user = await getUserDataWithUserBalance({ id: userId });
        if (!user) {
            return res.status(400).json({
                "status": "OP_USER_NOT_FOUND"
            });
        }
        const userRedisData = await getUserRedisData(userId);

        const userPrevBetPlaced = await getVirtualCasinoBetPlaced({ transactionId: transactionId });
        const userCurrProfitLoss = parseFloat(creditAmount) - parseFloat(userPrevBetPlaced.amount);
        const userCurrBalance = parseFloat(user?.userBal?.currentBalance) + parseFloat(creditAmount)
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
                currentBalance: parseFloat(creditAmount)
            });
        }

        sendMessageToUser(
            userId,
            socketData.userBalanceUpdateEvent,
            { currentBalance: userCurrBalance }
        );

        updateVirtualCasinoBetPlaced({ transactionId: transactionId }, { amount: userCurrProfitLoss });
        const currGameTransaction = await getTransaction({ searchId: user.id, description: ILike(`%${gameId}-${roundId}`) });
        if (currGameTransaction) {
            await updateTransactionData(currGameTransaction?.id, userCurrProfitLoss);
        }
        else {
            await addTransaction({ searchId: user.id, type: 3, userId: user.id, actionBy: user.id, amount: userCurrProfitLoss, closingBalance: userCurrBalance, transType: userCurrProfitLoss < 0 ? transType.loss : transType.win, description: `${gameId}-${roundId}` });
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
                    myProfitLoss:-myProfitLoss,
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
        })
        apiCall(apiMethod.post, walletDomain + allApiRoutes.WALLET.virtualCasinoResult, walletData);

        return res.status(200).json({
            "balance": userCurrBalance,
            "status": "OP_SUCCESS"
        });
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

exports.rollBackRequestMac88 = async (req, res) => {
    try {
        console.log(req.body);

        return res.status(200).json({
            "balance": 1000,
            "status": "OP_SUCCESS"
        })
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

exports.getMac88GameList = async (req, res) => {
    try {

        let casinoData = {
            "operator_id": mac88CasinoOperatorId
        }
        let result = await apiCall(apiMethod.post, mac88Domain + allApiRoutes.MAC88.gameList, casinoData, { Signature: generateRSASignature(JSON.stringify(casinoData)) });

        result = result?.data?.reduce((prev, curr) => {
            return { ...prev, [curr.provider_name]: { ...(prev[curr.provider_name] || {}), [curr?.category]: [...(prev?.[curr.provider_name]?.[curr.category] || []), curr] } }
        }, {});
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