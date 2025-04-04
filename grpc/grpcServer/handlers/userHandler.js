const grpc = require("@grpc/grpc-js");
const { __mf } = require("i18n");
const { logger } = require("../../../config/logger");
const { getUserByUserName, addUser, updateUser, getUserById, getUser, getChildUser, userBlockUnblock, betBlockUnblock } = require("../../../services/userService");
const { getDomainDataByDomain, addDomainData, getDomainDataByUserId, updateDomainData } = require("../../../services/domainDataService");
const { insertTransactions } = require("../../../services/transactionService");
const { addInitialUserBalance, getUserBalanceDataByUserId, updateUserBalanceData } = require("../../../services/userBalanceService");
const { buttonType, sessiontButtonValue, casinoButtonValue, defaultButtonValue, transactionType, walletDescription, transType, userRoleConstant, socketData } = require("../../../config/contants");
const { insertButton } = require("../../../services/buttonService");
const { forceLogoutUser } = require("../../../services/commonService");
const { updateUserDataRedis, hasUserInCache } = require("../../../services/redis/commonfunction");
const { sendMessageToUser } = require("../../../sockets/socketManager");


exports.createSuperAdmin = async (call) => {
    try {
        const {
            userName,
            fullName,
            password,
            phoneNumber,
            city,
            betBlock,
            userBlock,
            roleName,
            fwPartnership,
            faPartnership,
            saPartnership,
            aPartnership,
            smPartnership,
            mPartnership,
            agPartnership,
            id,
            creditRefrence,
            exposureLimit,
            maxBetLimit,
            minBetLimit,
            domain,
            isOldFairGame,
            matchComissionType,
            matchCommission,
            superParentType,
            superParentId,
            remark,
            delayTime,
            sessionCommission,
            betBlockedBy,
            userBlockedBy
        } = JSON.parse(call.request.data);

        const isUserPresent = await getUserByUserName(userName, ["id"]);
        let isDomainExist;
        if (!isOldFairGame) {
            isDomainExist = await getDomainDataByDomain(domain?.domain);
        }
        if (isUserPresent) {
            throw {
                code: grpc.status.ALREADY_EXISTS,
                message: __mf("user.userExist"),
            };

        }

        if (!isOldFairGame && isDomainExist) {
            throw {
                code: grpc.status.ALREADY_EXISTS,
                message: __mf("alreadyExist", { name: "Domain" }),
            };
        }

        if (roleName != userRoleConstant.superAdmin && !isOldFairGame) {

            throw {
                code: grpc.status.PERMISSION_DENIED,
                message: __mf("auth.unauthorizeRole"),
            };

        }

        if (!isOldFairGame) {
            await addDomainData({
                ...domain,
                userName,
                userId: id,
            });
        }
        let userData = {
            userName,
            fullName,
            password,
            phoneNumber,
            city,
            betBlock,
            userBlock,
            betBlockedBy,
            userBlockedBy,
            roleName,
            fwPartnership,
            faPartnership,
            saPartnership,
            aPartnership,
            smPartnership,
            mPartnership,
            agPartnership,
            id,
            creditRefrence,
            exposureLimit,
            maxBetLimit,
            minBetLimit,
            createBy: id,
            superParentType,
            superParentId,
            remark,
            delayTime: delayTime || 5,
            ...(isOldFairGame ? {
                matchComissionType,
                matchCommission,
                sessionCommission
            } : {})
        };
        let insertUser = await addUser(userData);

        let transactionArray = [
            {
                actionBy: id,
                searchId: id,
                userId: id,
                amount: 0,
                transType: transType.add,
                closingBalance: creditRefrence,
                description: walletDescription.userCreate,
                type: transactionType.withdraw
            },
        ];

        await insertTransactions(transactionArray);
        let insertUserBalanceData = {
            currentBalance: 0,
            userId: insertUser.id,
            profitLoss: -creditRefrence,
            myProfitLoss: 0,
            downLevelBalance: 0,
            exposure: 0,
            type: transactionType.withdraw
        };
        insertUserBalanceData = await addInitialUserBalance(insertUserBalanceData);
        if (insertUser.roleName == userRoleConstant.user) {
            let buttonValue = [
                {
                    type: buttonType.MATCH,
                    value: defaultButtonValue.buttons,
                    createBy: insertUser.id
                },
                {
                    type: buttonType.SESSION,
                    value: sessiontButtonValue.buttons,
                    createBy: insertUser.id
                },
                {
                    type: buttonType.CASINO,
                    value: casinoButtonValue.buttons,
                    createBy: insertUser.id
                }
            ]
            await insertButton(buttonValue)
        }

        return {}
    } catch (err) {
        throw {
            code: grpc.status.INTERNAL,
            message: err?.message || __mf("internalServerError"),
        };
    }
};

exports.updateSuperAdmin = async (call) => {
    try {
        let { user, domain, id, isOldFairGame } = JSON.parse(call.request.data);

        if (!isOldFairGame) {
            let isDomainData = await getDomainDataByUserId(id, ["id"]);
            if (!isDomainData) {
                return ErrorResponse(
                    { statusCode: 400, message: { msg: "invalidData" } },
                    req,
                    res
                );
            }

            await updateDomainData(id, domain);
        }
        await updateUser(id, user);

        return {};
    } catch (err) {
        throw {
            code: grpc.status.INTERNAL,
            message: err?.message || __mf("internalServerError"),
        };
    }
};

exports.changePasswordSuperAdmin = async (call) => {
    try {
        // Destructure request body
        const { userId, password } = call.request;

        const userDetail = await getUserById(userId, ["id"]);

        if (!userDetail) {
            throw {
                code: grpc.status.NOT_FOUND,
                message: __mf("notFound", { name: "User" }),
            };
        }

        // Update loginAt, password, and reset transactionPassword
        await updateUser(userId, {
            loginAt: null,
            password,
            transPassword: null,
        });

        // deleting token for logout
        await forceLogoutUser(userId);
        return {}
    } catch (error) {
        // Log any errors that occur
        throw {
            code: grpc.status.INTERNAL,
            message: error?.message || __mf("internalServerError"),
        };
    }
};

exports.setExposureLimitSuperAdmin = async (call) => {
    try {
        let { exposureLimit, id } = call.request;

        let user = await getUser({ id }, ["id", "exposureLimit"]);

        if (!user) {
            throw {
                code: grpc.status.INVALID_ARGUMENT,
                message: __mf("invalidData"),
            };
        }

        exposureLimit = parseInt(exposureLimit);
        user.exposureLimit = exposureLimit;
        let childUsers = await getChildUser(user.id);

        childUsers.map(async (childObj) => {
            let childUser = await getUserById(childObj.id);
            if (childUser.exposureLimit > exposureLimit || childUser.exposureLimit == 0) {
                childUser.exposureLimit = exposureLimit;
                await updateUser(childUser.id, { exposureLimit: exposureLimit });
            }
        });
        await updateUser(user.id, { exposureLimit: exposureLimit });
        return {}
    } catch (error) {
        throw {
            code: grpc.status.INTERNAL,
            message: error?.message || __mf("internalServerError"),
        };
    }
};

exports.setCreditReferenceSuperAdmin = async (call) => {
    try {
        let { userId, amount, remark } = call.request;
        amount = parseFloat(amount);
        let user = await getUser({ id: userId }, [
            "id",
            "creditRefrence",
            "roleName",
        ]);
        if (!user) {
            throw {
                code: grpc.status.INVALID_ARGUMENT,
                message: __mf("invalidData"),
            };
        }

        let userBalance = await getUserBalanceDataByUserId(user.id);
        if (!userBalance) {
            throw {
                code: grpc.status.INVALID_ARGUMENT,
                message: __mf("invalidData"),
            };
        }
        let previousCreditReference = user.creditRefrence;
        let updateData = {
            creditRefrence: amount,
        };

        let profitLoss = userBalance.profitLoss + previousCreditReference - amount;
        await updateUserBalanceData(user.id, { profitLoss: previousCreditReference - amount, balance: 0 });
        // await updateUserBalanceByUserId(user.id, { profitLoss });
        const userExistRedis = await hasUserInCache(user.id);

        if (userExistRedis) {
            await updateUserDataRedis(user.id, { profitLoss });
        }

        let transactionArray = [
            {
                actionBy: user.id,
                searchId: user.id,
                userId: user.id,
                amount: previousCreditReference,
                transType: transType.creditRefer,
                closingBalance: updateData.creditRefrence,
                description: "CREDIT REFRENCE " + remark,
                type: transactionType.withdraw
            },
        ];

        await insertTransactions(transactionArray);
        await updateUser(user.id, updateData);
        return {}
    } catch (error) {
        throw {
            code: grpc.status.INTERNAL,
            message: error?.message || __mf("internalServerError"),
        };
    }
};

exports.updateSuperAdminBalance = async (call) => {
    try {
        let { userId, transactionType, amount, remark } = call.request;
        amount = parseFloat(amount);

        let user = await getUser({ id: userId }, ["id"]);
        const userExistRedis = await hasUserInCache(user.id);
        if (!user) {
            throw {
                code: grpc.status.INVALID_ARGUMENT,
                message: __mf("invalidData"),
            };
        }

        let userBalanceData = await getUserBalanceDataByUserId(user.id);

        if (!userBalanceData) {
            throw {
                code: grpc.status.INVALID_ARGUMENT,
                message: __mf("invalidData"),
            };
        }
        let updateData = {}
        if (transactionType == transType.add) {
            updateData = {
                currentBalance: parseFloat(userBalanceData.currentBalance) + parseFloat(amount),
                profitLoss: parseFloat(userBalanceData.profitLoss) + parseFloat(amount),
            }

            let updateMyProfitLoss = parseFloat(amount);
            if (parseFloat(userBalanceData.myProfitLoss) + parseFloat(amount) > 0) {
                updateMyProfitLoss = userBalanceData.myProfitLoss
                updateData.myProfitLoss = 0;
            }
            else {
                updateData.myProfitLoss = parseFloat(userBalanceData.myProfitLoss) + parseFloat(amount);
            }

            // await updateUserBalanceByUserId(user.id, updateData);
            await updateUserBalanceData(user.id, {
                profitLoss: parseFloat(amount),
                myProfitLoss: updateMyProfitLoss,
                exposure: 0,
                totalCommission: 0,
                balance: parseFloat(amount)
            });
            if (userExistRedis) {
                await updateUserDataRedis(user.id, updateData);
            }
        } else if (transactionType == transType.withDraw) {
            if (amount > userBalanceData.currentBalance) {
                throw {
                    code: grpc.status.PERMISSION_DENIED,
                    message: __mf("userBalance.insufficientBalance"),
                };
            }
            updateData = {
                currentBalance: parseFloat(userBalanceData.currentBalance) - parseFloat(amount),
                profitLoss: parseFloat(userBalanceData.profitLoss) - parseFloat(amount),
            }

            let updateMyProfitLoss = -parseFloat(amount);
            if (parseFloat(userBalanceData.myProfitLoss) - parseFloat(amount) < 0) {
                updateMyProfitLoss = -userBalanceData.myProfitLoss
                updateData.myProfitLoss = 0;
            }
            else {
                updateData.myProfitLoss = parseFloat(userBalanceData.myProfitLoss) - parseFloat(amount);
            }

            // await updateUserBalanceByUserId(user.id, updateData);
            await updateUserBalanceData(user.id, {
                profitLoss: -parseFloat(amount),
                myProfitLoss: updateMyProfitLoss,
                exposure: 0,
                totalCommission: 0,
                balance: -parseFloat(amount)
            });
            if (userExistRedis) {

                await updateUserDataRedis(user.id, updateData);
            }
        } else {
            throw {
                code: grpc.status.INVALID_ARGUMENT,
                message: __mf("invalidData"),
            };
        }

        let transactionArray = [
            {
                actionBy: userId,
                searchId: userId,
                userId: userId,
                amount: transactionType == transType.add ? amount : -amount,
                transType: transactionType,
                closingBalance: updateData.currentBalance,
                description: remark,
                type: transactionType.withdraw
            },
        ];

        await insertTransactions(transactionArray);
        sendMessageToUser(userId, socketData.userBalanceUpdateEvent, updateData);
        return {};
    } catch (error) {
        throw {
            code: grpc.status.INTERNAL,
            message: error?.message || __mf("internalServerError"),
        };
    }
};

exports.lockUnlockSuperAdmin = async (call) => {
    try {
        // Extract relevant data from the request body and user object
        const { userId, betBlock, userBlock, loginId } = call.request;

        // Fetch details of the user who is performing the block/unblock operation,
        // including the hierarchy and block information
        const blockingUserDetail = await getUserById(userId, [
            "createBy",
            "userBlock",
            "betBlock",
            "userBlockedBy",
            "betBlockedBy"
        ]);

        if (!blockingUserDetail) {
            throw {
                code: grpc.status.NOT_FOUND,
                message: __mf("notFound", { name: "User" }),
            };

        }

        if (blockingUserDetail?.userBlock && loginId != blockingUserDetail?.userBlockedBy && !userBlock) {
            throw {
                code: grpc.status.PERMISSION_DENIED,
                message: __mf("user.blockedBySomeOneElse", { name: "user" }),
            };

        }
        if (blockingUserDetail?.betBlock && loginId != blockingUserDetail?.betBlockedBy && !betBlock) {
            throw {
                code: grpc.status.PERMISSION_DENIED,
                message: __mf("user.blockedBySomeOneElse", { name: "user's bet" }),
            };

        }

        // Check if the user is already blocked or unblocked (prevent redundant operations)
        if (blockingUserDetail?.userBlock != userBlock && userBlock != null) {
            // Perform the user block/unblock operation
            const blockedUsers = await userBlockUnblock(userId, loginId, userBlock);
            //   if blocktype is user and its block then user would be logout by socket
            if (userBlock) {
                blockedUsers?.[0]?.forEach(async (item) => {
                    await forceLogoutUser(item?.id);
                });
            }
        }

        // Check if the user is already bet-blocked or unblocked (prevent redundant operations)
        if (blockingUserDetail?.betBlock != betBlock && betBlock != null) {
            // Perform the bet block/unblock operation

            const blockedBets = await betBlockUnblock(userId, loginId, betBlock);

            blockedBets?.[0]?.filter((item) => item?.roleName == userRoleConstant.user)?.forEach((item) => {
                sendMessageToUser(item?.id, socketData.betBlockEvent, {
                    betBlock: betBlock,
                });
            });
        }

        // Return success response
        return {}
    } catch (error) {
        throw {
            code: grpc.status.INTERNAL,
            message: error?.message || __mf("internalServerError"),
        };
    }
};