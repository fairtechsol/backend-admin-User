const grpc = require("@grpc/grpc-js");
const { __mf } = require("i18n");
const { logger } = require("../../../config/logger");
const { getUserByUserName, addUser, updateUser, getUserById, getUser, getChildUser, userBlockUnblock, betBlockUnblock, getUsersWithUsersBalanceData, getChildUserBalanceSum, getUsersWithTotalUsersBalanceData, getAllUsers, getAllUsersBalanceSumByFgId, updateUserExposureLimit, deleteUserByDirectParent, softDeleteAllUsers, getMultipleUsersWithUserBalances, getUserDataWithUserBalance, getChildUserBalanceAndData, getUserListProcedure } = require("../../../services/userService");
const { getDomainDataByDomain, addDomainData, getDomainDataByUserId, updateDomainData } = require("../../../services/domainDataService");
const { insertTransactions } = require("../../../services/transactionService");
const { addInitialUserBalance, getUserBalanceDataByUserId, updateUserBalanceData, getAllUsersBalanceSum } = require("../../../services/userBalanceService");
const { buttonType, sessiontButtonValue, casinoButtonValue, defaultButtonValue, transactionType, walletDescription, transType, userRoleConstant, socketData, oldBetFairDomain, fileType, uplinePartnerShipForAllUsers, partnershipPrefixByRole } = require("../../../config/contants");
const { insertButton } = require("../../../services/buttonService");
const { forceLogoutUser, getUserProfitLossForUpperLevel, forceLogoutIfLogin } = require("../../../services/commonService");
const { updateUserDataRedis, hasUserInCache } = require("../../../services/redis/commonfunction");
const { sendMessageToUser } = require("../../../sockets/socketManager");
const { Not, In, ILike } = require("typeorm");
const FileGenerate = require("../../../utils/generateFile");


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
        let { exposureLimit, id, roleName } = call.request;

        exposureLimit = parseInt(exposureLimit);
        let childUsers;

        if (roleName) {
            childUsers = await getAllUsers(roleName == userRoleConstant.fairGameAdmin ? { superParentId: id } : {}, ["id"]);
        }
        else {
            childUsers = await getChildUser(id, ["id"]);
            childUsers.push({ id: id });
        }

        const childUsersId = childUsers.map((childObj) => childObj.id);
        await updateUserExposureLimit(exposureLimit, childUsersId);

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
                updateMyProfitLoss = -userBalanceData.myProfitLoss
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


exports.userList = async (call) => {
    try {
        const { type, userId, roleName, ...apiQuery } = JSON.parse(call?.request?.query || "{}");
        let userRole = roleName;
        let where = {
            createBy: userId,
            roleName: userRole
        };

        let partnershipCol = [...uplinePartnerShipForAllUsers[userRole], partnershipPrefixByRole[userRole]].map((item) => {
            return item + "Partnership";
        });
        let data = (await getUserListProcedure(where.createBy, partnershipCol, where.roleName, apiQuery?.limit, apiQuery?.page, apiQuery?.keyword))?.[0]?.fetchuserlist || [];

        const domainUrl = process.env.GRPC_URL;
        if (type) {
            const header = [
                { excelHeader: "User Name", dbKey: "userName" },
                { excelHeader: "Role", dbKey: "roleName" },
                { excelHeader: "Credit Ref", dbKey: "creditRefrence" },
                { excelHeader: "Balance", dbKey: "balance" },
                { excelHeader: "Client P/L", dbKey: "userBal.profitLoss" },
                { excelHeader: "% P/L", dbKey: "percentProfitLoss" },
                { excelHeader: "Comission", dbKey: "commission" },
                { excelHeader: "Exposure", dbKey: "userBal.exposure" },
                { excelHeader: "Available Balance", dbKey: "availableBalance" },
                { excelHeader: "UL", dbKey: "userBlock" },
                { excelHeader: "BL", dbKey: "betBlock" },
                ...(domainUrl == oldBetFairDomain ? [{ excelHeader: "S Com %", dbKey: "sessionCommission" }] : []),
                { excelHeader: "Match Com Type", dbKey: "matchComissionType" },
                { excelHeader: "M Com %", dbKey: "matchCommission" },
                { excelHeader: "Exposure Limit", dbKey: "exposureLimit" },
                ...(type == fileType.excel
                    ? [
                        {
                            excelHeader: "FairGameWallet Partnership",
                            dbKey: "fwPartnership",
                        },
                        {
                            excelHeader: "FairGameAdmin Partnership",
                            dbKey: "faPartnership",
                        },
                        { excelHeader: "SuperAdmin Partnership", dbKey: "saPartnership" },
                        { excelHeader: "Admin Partnership", dbKey: "aPartnership" },
                        {
                            excelHeader: "SuperMaster Partnership",
                            dbKey: "smPartnership",
                        },
                        { excelHeader: "Master Partnership", dbKey: "mPartnership" },
                        { excelHeader: "Agent Partnership", dbKey: "agPartnership" },
                        { excelHeader: "Full Name", dbKey: "fullName" },
                        { excelHeader: "City", dbKey: "city" },
                        { excelHeader: "Phone Number", dbKey: "phoneNumber" },
                    ]
                    : []),
            ];
            const total = data?.list?.reduce((prev, curr) => {
                prev["creditRefrence"] = (prev["creditRefrence"] || 0) + (curr["creditRefrence"] || 0);
                prev["balance"] = (prev["balance"] || 0) + (curr["balance"] || 0);
                prev["availableBalance"] = (prev["availableBalance"] || 0) + (curr["availableBalance"] || 0);

                if (prev["userBal"]) {
                    prev["userBal"] = {
                        profitLoss: (prev["userBal"]["profitLoss"] || 0) + (curr["userBal"]["profitLoss"] || 0),
                        exposure: (prev["userBal"]["exposure"] || 0) + (curr["userBal"]["exposure"] || 0)
                    }
                }
                else {
                    prev["userBal"] = {
                        profitLoss: (curr["userBal"]["profitLoss"] || 0),
                        exposure: (curr["userBal"]["exposure"] || 0),
                    }
                }
                return prev
            }, {});
            data?.list?.unshift(total);

            const fileGenerate = new FileGenerate(type);
            const file = await fileGenerate.generateReport(data?.list, header, "Client List Report");
            const fileName = `accountList_${new Date()}`

            return SuccessResponse(
                {
                    statusCode: 200,
                    message: { msg: "user.userList" },
                    data: { file: file, fileName: fileName },
                },
                req,
                res
            );
        }

        return { data: JSON.stringify(data) };

    } catch (error) {
        logger.error({
            message: "error at user list",
            context: error.message,
            stake: error.stack
        })
        throw {
            code: grpc.status.INTERNAL,
            message: error?.message || __mf("internalServerError"),
        };
    }
}

exports.getTotalUserListBalance = async (call) => {
    try {
        const { type, userId, roleName, ...apiQuery } = JSON.parse(call?.request?.query || "{}");
        let userRole = roleName;
        let where = {
            createBy: userId,
            roleName: Not(userRole)
        };

        let queryColumns = `SUM(user.creditRefrence) as "totalCreditReference", SUM(UB.profitLoss) as profitSum,SUM(UB.downLevelBalance) as "downLevelBalance", SUM(UB.currentBalance) as "availableBalance",SUM(UB.exposure) as "totalExposure",SUM(CASE WHEN user.roleName = 'user' THEN UB.exposure ELSE 0 END) AS "totalExposureOnlyUser",SUM(UB.totalCommission) as totalCommission`;

        switch (userRole) {
            case (userRoleConstant.fairGameWallet):
            case (userRoleConstant.expert): {
                queryColumns = queryColumns + `, ROUND(SUM(UB.profitLoss / 100 * (user.fwPartnership)), 2) as percentProfitLoss`;
                break;
            }
            case (userRoleConstant.fairGameAdmin): {
                queryColumns = queryColumns + `, ROUND(SUM(UB.profitLoss / 100 * (user.faPartnership + user.fwPartnership)), 2) as percentProfitLoss`;
                break;
            }
            case (userRoleConstant.superAdmin): {
                queryColumns = queryColumns + `, ROUND(SUM(UB.profitLoss / 100 * (user.saPartnership + user.faPartnership + user.fwPartnership )), 2) as percentProfitLoss`;
                break;
            }
            case (userRoleConstant.admin): {
                queryColumns = queryColumns + `, ROUND(SUM(UB.profitLoss / 100 * (user.aPartnership + user.saPartnership + user.faPartnership + user.fwPartnership )), 2) as percentProfitLoss`;
                break;
            }
            case (userRoleConstant.superMaster): {
                queryColumns = queryColumns + `, ROUND(SUM(UB.profitLoss / 100 * (user.smPartnership + user.aPartnership + user.saPartnership + user.faPartnership + user.fwPartnership )), 2) as percentProfitLoss`;
                break;
            }
            case (userRoleConstant.master): {
                queryColumns = queryColumns + `, ROUND(SUM(UB.profitLoss / 100 * (user.mPartnership + user.smPartnership + user.aPartnership + user.saPartnership + user.faPartnership + user.fwPartnership )), 2) as percentProfitLoss`;
                break;
            }
            case (userRoleConstant.agent): {
                queryColumns = queryColumns + `, ROUND(SUM(UB.profitLoss / 100 * (user.agPartnership + user.mPartnership + user.smPartnership + user.aPartnership + user.saPartnership + user.faPartnership + user.fwPartnership )), 2) as percentProfitLoss`;
                break;
            }
        }
        let childUserBalanceWhere = "";

        if (apiQuery.userBlock) {
            childUserBalanceWhere = ` "p"."userBlock" = ${apiQuery?.userBlock?.slice(2)}`
        }
        if (apiQuery.betBlock) {
            childUserBalanceWhere = `"p"."betBlock" = ${apiQuery?.betBlock?.slice(2)}`
        }
        if (apiQuery.orVal) {
            childUserBalanceWhere = `("p"."betBlock" = true or  "p"."userBlock" = true)`
        }

        const totalBalance = await getUsersWithTotalUsersBalanceData(where, apiQuery, queryColumns);

        let childUsersBalances = await getChildUserBalanceSum(userId, true, childUserBalanceWhere);

        totalBalance.currBalance = childUsersBalances?.[0]?.balance;
        totalBalance.availableBalance = parseFloat(totalBalance.availableBalance || 0) - parseFloat(totalBalance.totalExposureOnlyUser || 0);

        return { data: JSON.stringify(totalBalance) }
    } catch (error) {
        logger.error({
            message: "Error in user list total balance.",
            context: error.message,
            stake: error.stack
        });
        throw {
            code: grpc.status.INTERNAL,
            message: error?.message || __mf("internalServerError"),
        };
    }
}

exports.getAllUserBalance = async (call) => {
    try {

        const { roleName, userId: id } = call?.request;
        let balanceSum = {};
        if (roleName == userRoleConstant.fairGameWallet) {

            const demoUserId = await getAllUsers({ isDemo: true }, ["id"]);
            let childUsersBalances = await getAllUsersBalanceSum({ userId: Not(In(demoUserId?.map((item) => item?.id))) });
            balanceSum[id] = parseFloat(parseFloat(childUsersBalances?.balance).toFixed(2));

        }
        else if (roleName == userRoleConstant.fairGameAdmin) {
            let childUsersBalances = await getAllUsersBalanceSumByFgId(id);
            balanceSum[id] = parseFloat(parseFloat(childUsersBalances?.balance).toFixed(2));
        }
        else {
            balanceSum = {};
            for (let item of id?.split(",")) {
                let childUsersBalances = await getChildUserBalanceSum(item);
                balanceSum[item] = parseFloat(parseFloat(childUsersBalances?.[0]?.balance).toFixed(2));
            };
        }

        return { data: JSON.stringify({ balance: balanceSum }) }
    } catch (error) {
        logger.error({
            context: `Error in get all user balance.`,
            error: error.message,
            stake: error.stack,
        });
        throw {
            code: grpc.status.INTERNAL,
            message: error?.message || __mf("internalServerError"),
        };
    }
}


exports.getUsersProfitLoss = async (call) => {
    try {
        const { userIds, matchId } = call.request;

        const resUserData = [];
        let markets = {};

        for (let userData of userIds?.split("|")) {
            userData = JSON.parse(userData);
            let userProfitLossData = {};


            let betsData = await getUserProfitLossForUpperLevel(userData, matchId);

            Object.keys(betsData || {}).forEach((item) => {
                markets[item] = { betId: item, name: betsData[item]?.name };
                Object.keys(betsData[item].teams || {})?.forEach((teams) => {
                    betsData[item].teams[teams].pl = {
                        rate: betsData[item].teams?.[teams]?.pl,
                        percent: parseFloat(parseFloat(parseFloat(betsData[item].teams?.[teams]?.pl).toFixed(2)) * parseFloat(userData.partnerShip) / 100).toFixed(2)
                    }
                })
            });
            userProfitLossData.userName = userData?.userName;
            userProfitLossData.profitLoss = betsData;

            if (Object.keys(betsData || {}).length > 0) {
                resUserData.push(userProfitLossData);
            }
        }
        return { data: JSON.stringify({ profitLoss: resUserData, markets: Object.values(markets) }) }
    } catch (error) {
        logger.error({
            context: `Error in get profit loss user data.`,
            error: error.message,
            stake: error.stack,
        });
        throw {
            code: grpc.status.INTERNAL,
            message: error?.message || __mf("internalServerError"),
        };
    }
}


exports.deleteWalletUsers = async (call) => {
    try {
        const { userId, roleName } = call.request;

        if (roleName == userRoleConstant.fairGameAdmin) {
            await deleteUserByDirectParent(userId);
        }
        else {
            await softDeleteAllUsers(userId);
        }

        return {}
    }
    catch (error) {
        logger.error({
            context: `error in delete user`,
            error: error.message,
            stake: error.stack,
        });
        throw {
            code: grpc.status.INTERNAL,
            message: error?.message || __mf("internalServerError"),
        };
    }
}

exports.checkUserBalance = async (call) => {
    try {
        const { roleName, userId } = call.request;

        if (roleName == userRoleConstant.fairGameAdmin) {
            const childUsers = await getMultipleUsersWithUserBalances({ superParentId: userId });
            for (let childData of childUsers) {
                if (parseFloat(childData?.exposure || 0) != 0 || parseFloat(childData?.currentBalance || 0) != 0 || parseFloat(childData?.profitLoss || 0) != 0 || parseFloat(childData.creditRefrence || 0) != 0 || parseFloat(childData?.totalCommission || 0) != 0) {
                    return ErrorResponse(
                        { statusCode: 400, message: { msg: "settleAccount", keys: { name: childData?.userName } } }, req, res);
                }
                forceLogoutIfLogin(childData.id);
            }
        }
        else {
            const userData = await getUserDataWithUserBalance({ id: userId });

            if (!userData) {
                throw {
                    code: grpc.status.NOT_FOUND,
                    message: __mf("notFound", { name: "User" }),
                };
            }
            if (parseFloat(userData.userBal?.exposure || 0) != 0 || parseFloat(userData.userBal?.currentBalance || 0) != 0 || parseFloat(userData.userBal?.profitLoss || 0) != 0 || parseFloat(userData.creditRefrence || 0) != 0 || parseFloat(userData.userBal?.totalCommission || 0) != 0) {
                throw {
                    code: grpc.status.BAD_REQUEST,
                    message: __mf("settleAccount", { name: "your" }),
                }
            }

            const childUsers = await getChildUserBalanceAndData(userId);
            for (let childData of childUsers) {
                if (parseFloat(childData?.exposure || 0) != 0 || parseFloat(childData?.currentBalance || 0) != 0 || parseFloat(childData?.profitLoss || 0) != 0 || parseFloat(childData.creditRefrence || 0) != 0 || parseFloat(childData?.totalCommission || 0) != 0) {

                    throw {
                        code: grpc.status.BAD_REQUEST, message: __mf("settleAccount", { name: childData?.userName }),
                    }


                }
                forceLogoutIfLogin(childData.id);
            }
        }

        return {}
    }
    catch (error) {
        logger.error({
            context: `error in delete user`,
            error: error.message,
            stake: error.stack,
        });
        throw {
            code: grpc.status.INTERNAL,
            message: error?.message || __mf("internalServerError"),
        };
    }
}

exports.getAllChildSearchList = async (call) => {
    try {
        const { roleName, userName, id, isUser } = call.request;

        let users = [];
        if (roleName == userRoleConstant.fairGameAdmin) {
            users = await getAllUsers({ superParentId: id, userName: ILike(`%${userName}%`), ...(isUser ? { roleName: userRoleConstant.user } : {}) }, ["id", "userName", "betBlock", "userBlock"]);
        }
        else {
            users = await getAllUsers({ userName: ILike(`%${userName}%`), isDemo: false, ...(isUser ? { roleName: userRoleConstant.user } : {}) }, ["id", "userName", "betBlock", "userBlock"]);
        }

        return { data: JSON.stringify(users) };
    }
    catch (error) {
        logger.error({
            context: `error in delete user`,
            error: error.message,
            stake: error.stack,
        });
        throw {
            code: grpc.status.INTERNAL,
            message: error?.message || __mf("internalServerError"),
        };
    }
}