const { In, IsNull } = require("typeorm");
const {
    transType,
    userRoleConstant,
    socketData,
    betType,
    betResultStatus,
    redisKeys,
    resultType,
    matchBettingType,
    marketBetType,
    matchComissionTypeConstant,
    transactionType,
    matchOddName,
    partnershipPrefixByRole,
} = require("../../../config/contants");
const PromiseLimit = require('bluebird');

const { logger } = require("../../../config/logger");
const { getMatchBetPlaceWithUser, addNewBet, getMultipleAccountProfitLossTournament, updatePlaceBet, getDistinctUserBetPlaced, findAllPlacedBet, findAllPlacedBetWithUserIdAndBetId } = require("../../../services/betPlacedService");
const {
    insertBulkTransactions,
    insertBulkCommissions,
    parseRedisData,
    calculateRatesRacingMatch,
    getUpLinePartnerShipCalc,
    convertToBatches,
} = require("../../../services/commonService");
const grpc = require("@grpc/grpc-js");
const { __mf } = require("i18n");
const { getUserRedisMultiKeyData, getUserRedisMultiKeyDataMatch } = require("../../../services/redis/commonfunction");
const {
    updateUserDeclareBalanceData,
} = require("../../../services/userBalanceService");
const {
    getUserDataWithUserBalanceDeclare,
    getMultiUserParentsWithBalance,
} = require("../../../services/userService");
const { sendMessageToUser, broadcastEvent } = require("../../../sockets/socketManager");
const { deleteCommission, getCombinedCommission } = require("../../../services/commissionService");
const { updateMatchData } = require("../../../services/matchService");
const internalRedis = require("../../../config/internalRedisConnection");
const { roundToTwoDecimals } = require("../../../utils/mathUtils");

exports.declareTournamentMatchResult = async (call) => {
    try {
        const { result, marketDetail, userId, matchId, match, isMatchOdd } = call.request;

        const betPlaced = await getMatchBetPlaceWithUser([marketDetail?.id]);

        if (betPlaced?.length <= 0) {
            broadcastEvent(socketData.declaredMatchResultAllUser, { matchId, gameType: match?.matchType, betId: marketDetail?.id, betType: matchBettingType.tournament });
            return { data: { fwProfitLoss: 0, faAdminCal: JSON.stringify({ userData: {} }), superAdminData: JSON.stringify({}) } }
        }

        logger.info({
            message: "Tournament market match result declared.",
            data: {
                betId: marketDetail?.id,
                result,
            },
        });

        let updateRecords = [];
        let bulkCommission = {};
        let commissions = {};
        let matchOddWinBets = {};
        const betPlacedData = {};

        const userData = new Set();
        for (let item of betPlaced) {
            if (result === resultType.noResult) {
                item.result = betResultStatus.TIE;
            } else {
                item.result = ((item.betType === betType.BACK && item.runnerId == result) || (item.betType === betType.LAY && item.runnerId != result)) ? betResultStatus.WIN : betResultStatus.LOSS;
            }
            if (item.user.matchCommission && item.isCommissionActive && item.result == betResultStatus.LOSS && item.user.matchComissionType == matchComissionTypeConstant.entryWise) {
                let commissionAmount = Number((parseFloat(item.lossAmount) * (parseFloat(item.user['matchCommission']) / 100)).toFixed(2));
                commissionAmount = Math.abs(commissionAmount);
                if (commissions[item?.user?.id]) {
                    commissions[item?.user?.id] = parseFloat(commissions[item?.user?.id]) + parseFloat(commissionAmount);
                } else {

                    commissions[item?.user?.id] = commissionAmount;
                }
            }
            if (item.result == betResultStatus.LOSS && item.isCommissionActive) {
                bulkCommission[item?.user?.id] = [...(bulkCommission[item?.user?.id] || []),
                {
                    matchId: matchId,
                    betId: item.betId,
                    betPlaceId: item?.id,
                    amount: item?.amount,
                    sessionName: item?.eventName,
                    betPlaceDate: item?.createdAt,
                    odds: item?.odds,
                    betType: item?.betType,
                    stake: item?.amount,
                    lossAmount: item?.lossAmount,
                    superParent: item?.user?.superParentId,
                    userName: item.user?.userName,
                    matchType: marketBetType.MATCHBETTING
                }
                ];
            }

            if (item.result == betResultStatus.WIN && isMatchOdd) {
                if (!matchOddWinBets[item.user.id]) {
                    matchOddWinBets[item.user.id] = [];
                }
                matchOddWinBets[item.user.id].push(item)
            }
            updateRecords.push(item);
            userData.add(item?.user?.id);

            if (!betPlacedData[item.user.id]) {
                betPlacedData[item.user.id] = [];
            }
            betPlacedData[item.user.id].push({
                id: item.id,
                matchId: item.matchId,
                betId: item.betId,
                winAmount: item.winAmount,
                lossAmount: item.lossAmount,
                betType: item.betType,
                eventType: item.eventType,
                runnerId: item.runnerId,
            })
        }

        await addNewBet(updateRecords);


        const users = await getUserDataWithUserBalanceDeclare({ id: In([...userData]) });

        let upperUserObj = {};
        let bulkWalletRecord = [];
        let commissionReport = [];
        const profitLossData = await calculateProfitLossTournamentMatchForUserDeclare(
            users,
            marketDetail?.id,
            matchId,
            socketData.matchResult,
            userId,
            bulkWalletRecord,
            upperUserObj,
            result,
            match,
            marketDetail,
            commissions,
            bulkCommission,
            commissionReport,
            matchOddWinBets,
            isMatchOdd,
            betPlacedData
        );

        insertBulkTransactions(bulkWalletRecord);
        logger.info({
            message: "Upper user for this bet.",
            data: { upperUserObj, betId: marketDetail?.id },
        });

        const userEntries = Object.entries(upperUserObj);
        if (userEntries.length) {
            // 1️⃣ Fetch all current balances in one Redis pipeline
            const balanceResponses = await getUserRedisMultiKeyData(userEntries?.map(([userId]) => userId), ['profitLoss', 'myProfitLoss', 'exposure', 'totalCommission']);

            // 2️⃣ Compute deltas, queue Redis updates, and send socket messages
            const updatePipeline = internalRedis.pipeline();

            userEntries.forEach(([userId, updateData]) => {
                upperUserObj[userId].exposure = -upperUserObj[userId].exposure;
                upperUserObj[userId].myProfitLoss = -upperUserObj[userId].myProfitLoss;

                if (Object.keys(balanceResponses[userId] || {}).length) {
                    const { profitLoss, myProfitLoss, exposure, totalCommission } = balanceResponses[userId];
                    const currentProfitLoss = +profitLoss || 0;
                    const currentMyProfitLoss = +myProfitLoss || 0;
                    const currentExposure = +exposure || 0;
                    const currentTotalCommission = +totalCommission || 0;


                    const profitLossDelta = +updateData.profitLoss || 0;
                    const myProfitLossDelta = -(+updateData.myProfitLoss) || 0;
                    const rawExposureDelta = -(+updateData.exposure) || 0;
                    const commissionDelta = +updateData.totalCommission || 0;

                    // clamp exposure and adjust leftover
                    let newExposure = currentExposure + rawExposureDelta;
                    let adjustedExposure = rawExposureDelta;
                    if (newExposure < 0) {
                        logger.info({
                            message: 'Exposure went negative',
                            data: {
                                betId: marketDetail?.id,
                                matchId, userId, before: currentExposure, delta: rawExposureDelta
                            }
                        });
                        adjustedExposure += newExposure;  // fold leftover back
                        newExposure = 0;
                    }
                    const baseKey = `match:${userId}:${matchId}:${marketDetail?.id}:profitLoss`;
                    // queue Redis increments & key deletion
                    updatePipeline
                        .hincrbyfloat(userId, 'profitLoss', profitLossDelta)
                        .hincrbyfloat(userId, 'myProfitLoss', myProfitLossDelta)
                        .hincrbyfloat(userId, 'exposure', adjustedExposure)
                        .del(baseKey);

                    logger.info({
                        message: "Declare result db update for parent ",
                        data: {
                            parentUser: {
                                profitLoss: currentProfitLoss + profitLossDelta,
                                myProfitLoss: currentMyProfitLoss + myProfitLossDelta,
                                exposure: newExposure,
                                totalCommission: currentTotalCommission + commissionDelta,
                            },
                            betId: marketDetail?.id
                        },
                    });

                    // fire-and-forget socket notification
                    sendMessageToUser(userId, socketData.matchResult, {
                        profitLoss: currentProfitLoss + profitLossDelta,
                        myProfitLoss: currentMyProfitLoss + myProfitLossDelta,
                        exposure: newExposure,
                        totalCommission: currentTotalCommission + commissionDelta,
                        betId: marketDetail.id,
                        matchId,
                        betType: matchBettingType.tournament
                    });
                }
            });

            await updatePipeline.exec();

            const updateUserBatch = convertToBatches(500, upperUserObj);
            for (let i = 0; i < updateUserBatch.length; i++) {
                await updateUserDeclareBalanceData(updateUserBatch[i]);
            }

        }

        insertBulkCommissions(commissionReport);
        broadcastEvent(socketData.declaredMatchResultAllUser, { matchId, gameType: match?.matchType, betId: marketDetail?.id, betType: matchBettingType.tournament });

        return { data: profitLossData }

    } catch (error) {
        logger.error({
            error: `Error at declare tournament market match result for the user.`,
            stack: error.stack,
            message: error.message,
        });
        // Handle any errors and return an error response
        throw {
            code: grpc.status.INTERNAL,
            message: error?.message || __mf("internalServerError"),
        };
    }
};

const calculateProfitLossTournamentMatchForUserDeclare = async (users, betId, matchId, redisEventName, userId, bulkWalletRecord, upperUserObj, result, matchData, marketDetail, commission, bulkCommission, commissionReport, matchOddWinBets, isMatchOdd, betPlacedData) => {

    let faAdminCal = {
        commission: [],
        userData: {}
    };
    let superAdminData = {};

    let fwProfitLoss = 0;
    const userIds = users?.map((item) => item?.id);

    const [
        userRedisData,
        getMultipleAmountData,
        multiUserParentData
    ] = await Promise.all([
        getUserRedisMultiKeyDataMatch(userIds, matchId, betId),
        getMultipleAccountProfitLossTournament(betId, userIds),
        getMultiUserParentsWithBalance(userIds)
    ]);

    const userUpdateDBData = {};
    const updateUserPipeline = internalRedis.pipeline();


    const processUser = async (user) => {
        user = { user: user };
        const getMultipleAmount = getMultipleAmountData[user.user.id] || {};

        Object.keys(getMultipleAmount)?.forEach((item) => {
            getMultipleAmount[item] = parseRedisData(item, getMultipleAmount);
        });

        let maxLoss = 0;
        logger.info({ message: "Updated users", data: user.user });

        // check if data is already present in the redis or not
        if (userRedisData?.[user.user.id]?.profitLoss) {
            maxLoss = (Math.abs(Math.min(...Object.values(userRedisData[user.user.id].profitLoss || {}), 0))) || 0;
        }
        else {
            // if data is not available in the redis then get data from redis and find max loss amount for all placed bet by user
            const redisData = await calculateRatesRacingMatch(betPlacedData[user.user.id] || [], 100, marketDetail);
            Object.keys(redisData)?.forEach((key) => {
                maxLoss += Math.abs(Math.min(...Object.values(redisData[key] || {}), 0));
            });
        }

        user.user.userBalance.exposure = user.user.userBalance.exposure - maxLoss;

        logger.info({
            message: "Update user exposure.",
            data: user.user.userBalance.exposure
        });

        const getWinAmount = roundToTwoDecimals(getMultipleAmount.winAmount);
        const getLossAmount = roundToTwoDecimals(getMultipleAmount.lossAmount);
        const getCommissionLossAmount = roundToTwoDecimals(getMultipleAmount.lossAmountCommission);
        const getCommissionWinAmount = roundToTwoDecimals(getMultipleAmount.winAmountCommission);
        let profitLoss = getWinAmount - getLossAmount;
        const commissionProfitLoss = getCommissionWinAmount - getCommissionLossAmount;

        fwProfitLoss = roundToTwoDecimals(fwProfitLoss + ((-profitLoss * parseFloat(user.user.fwPartnership)) / 100));

        let userCurrentBalance = parseFloat(user.user.userBalance.currentBalance);
        matchOddWinBets?.[user.user.id]?.forEach((matchOddData, uniqueId) => {
            const currWinAmount = roundToTwoDecimals(+matchOddData?.winAmount / 100);
            userCurrentBalance -= currWinAmount;
            bulkWalletRecord.push({
                type: transactionType.sports,
                matchId: matchId,
                actionBy: userId,
                searchId: user.user.id,
                userId: user.user.id,
                amount: -currWinAmount,
                transType: transType.loss,
                closingBalance: userCurrentBalance,
                description: `Deduct 1% for bet on match odds ${matchOddData?.eventType}/${matchOddData.eventName}-${matchOddData.teamName} on odds ${matchOddData.odds}/${matchOddData.betType} of stake ${matchOddData.amount} `,
                createdAt: new Date(),
                uniqueId: uniqueId,
                betId: [betId]
            });
        });

        // deducting 1% from match odd win amount 
        if (parseFloat(getWinAmount) > 0 && isMatchOdd) {
            profitLoss -= roundToTwoDecimals(getWinAmount / 100);
        }

        const userCurrBalance = roundToTwoDecimals(user.user.userBalance.currentBalance + profitLoss);
        const userBalanceData = {
            currentBalance: userCurrBalance,
            profitLoss: user.user.userBalance.profitLoss + profitLoss,
            myProfitLoss: user.user.userBalance.myProfitLoss + profitLoss,
            exposure: user.user.userBalance.exposure
        }

        let totalCommissionData = 0;

        if (user.user.matchCommission) {
            if (user.user.matchComissionType == matchComissionTypeConstant.entryWise) {
                userBalanceData.totalCommission = roundToTwoDecimals(parseFloat(user.user.userBalance.totalCommission) + getCommissionLossAmount * parseFloat(user.user.matchCommission) / 100);
                totalCommissionData += roundToTwoDecimals(getCommissionLossAmount * parseFloat(user.user.matchCommission) / 100)
            }
            else if (commissionProfitLoss < 0) {
                userBalanceData.totalCommission = roundToTwoDecimals(parseFloat(user.user.userBalance.totalCommission) + Math.abs(commissionProfitLoss) * parseFloat(user.user.matchCommission) / 100);
                totalCommissionData += roundToTwoDecimals(Math.abs(commissionProfitLoss) * parseFloat(user.user.matchCommission) / 100)
            }
        }

        //adding users balance data to update in db
        userUpdateDBData[user.user.id] = {
            profitLoss: profitLoss,
            myProfitLoss: profitLoss,
            exposure: -maxLoss,
            totalCommission: totalCommissionData
        };

        if (userRedisData?.[user.user.id]?.profitLoss) {
            const baseKey = `match:${user.user.id}:${matchId}:${betId}:profitLoss`;

            updateUserPipeline
                .hincrbyfloat(user.user.id, 'profitLoss', profitLoss)
                .hincrbyfloat(user.user.id, 'myProfitLoss', profitLoss)
                .hincrbyfloat(user.user.id, 'exposure', -maxLoss)
                .hincrbyfloat(user.user.id, 'currentBalance', profitLoss)
                .del(baseKey)
                .hdel(user.user.id, redisKeys.userMatchExposure + matchId);
        }


        if (user?.user?.matchCommission) {

            if (user.user.matchComissionType == matchComissionTypeConstant.entryWise) {
                bulkCommission[user?.user?.id]?.forEach((item) => {
                    commissionReport.push({
                        createBy: user.user.id,
                        matchId: item.matchId,
                        betId: item?.betId,
                        betPlaceId: item?.betPlaceId,
                        commissionAmount: roundToTwoDecimals(parseFloat(item?.lossAmount) * parseFloat(user?.user?.matchCommission) / 100),
                        parentId: user.user.id,
                        matchType: marketBetType.MATCHBETTING
                    });
                });
            }
            else if (commissionProfitLoss < 0) {
                commissionReport.push({
                    createBy: user.user.id,
                    matchId: matchId,
                    betId: betId,
                    commissionAmount: roundToTwoDecimals(parseFloat(Math.abs(commissionProfitLoss)) * parseFloat(user?.user?.matchCommission) / 100),
                    parentId: user.user.id,
                    stake: commissionProfitLoss
                });
            }
            if (user?.user?.id == user?.user?.createBy) {
                if (user.user.matchComissionType == matchComissionTypeConstant.entryWise) {
                    bulkCommission[user?.user?.id]?.forEach((item) => {
                        faAdminCal.commission.push({
                            createBy: user.user.id,
                            matchId: item.matchId,
                            betId: item?.betId,
                            betPlaceId: item?.betPlaceId,
                            parentId: user.user.id,
                            teamName: item?.sessionName,
                            betPlaceDate: new Date(item?.betPlaceDate),
                            odds: item?.odds,
                            betType: item?.betType,
                            stake: item?.stake,
                            commissionAmount: roundToTwoDecimals(parseFloat(item?.lossAmount) * parseFloat(user?.user?.matchCommission) / 100),
                            partnerShip: 100,
                            matchName: matchData?.title,
                            matchStartDate: new Date(matchData?.startAt),
                            userName: user.user.userName,
                            matchType: marketBetType.MATCHBETTING

                        });
                    });
                }
                else if (commissionProfitLoss < 0) {
                    faAdminCal.commission.push({
                        createBy: user.user.id,
                        matchId: matchId,
                        betId: betId,
                        parentId: user.user.id,
                        commissionAmount: roundToTwoDecimals(parseFloat(Math.abs(commissionProfitLoss)) * parseFloat(user?.user?.matchCommission) / 100),
                        partnerShip: 100,
                        matchName: matchData?.title,
                        matchStartDate: new Date(matchData?.startAt),
                        userName: user.user.userName,
                        stake: commissionProfitLoss,
                        matchType: marketBetType.MATCHBETTING
                    });
                }
            }
        }

        sendMessageToUser(user.user.id, redisEventName, { betId: betId, matchId, userBalanceData });
        // deducting 1% from match odd win amount 
        if (getWinAmount > 0 && isMatchOdd) {
            user.user.userBalance.currentBalance = roundToTwoDecimals(parseFloat(user.user.userBalance.currentBalance) - (getWinAmount / 100));
        }

        let currBal = user.user.userBalance.currentBalance;

        const transactions = [
            ...(result != resultType.noResult ? [{
                winAmount: getWinAmount,
                lossAmount: getLossAmount,
                type: marketDetail?.name,
                result: result,
                betId: [betId]
            }] : [])
        ];

        transactions.forEach((item, uniqueId) => {
            currBal = currBal + item.winAmount - item.lossAmount;

            bulkWalletRecord.push({
                type: transactionType.sports,
                matchId: matchId,
                actionBy: userId,
                searchId: user.user.id,
                userId: user.user.id,
                amount: item.winAmount - item.lossAmount,
                transType: item.winAmount - item.lossAmount > 0 ? transType.win : transType.loss,
                closingBalance: currBal,
                description: `${matchData?.matchType}/${matchData?.title}/${item.type} - ${marketDetail?.runners?.find((runnerData) => runnerData?.id == item.result)?.runnerName} `,
                createdAt: new Date(),
                uniqueId: uniqueId,
                betId: item?.betId
            });
        });


        if (user.user.createBy === user.user.id && !user.user.isDemo) {
            superAdminData[user.user.id] = {
                role: user.user.roleName,
                profitLoss: profitLoss,
                myProfitLoss: profitLoss,
                exposure: maxLoss,
                totalCommission: (user.user.matchComissionType == matchComissionTypeConstant.entryWise ? (commission[user.user.id] || 0) : commissionProfitLoss < 0 ? roundToTwoDecimals(Math.abs(commissionProfitLoss) * parseFloat(user?.user?.matchCommission) / 100) : 0)
            };
        }

        if (!user.user.isDemo) {
            const parentUsers = multiUserParentData[user.user.id] || [];

            for (const patentUser of parentUsers) {
                const upLinePartnership = getUpLinePartnerShipCalc(patentUser.roleName, user.user) ?? 100;

                const myProfitLoss = roundToTwoDecimals(profitLoss * upLinePartnership / 100);

                const parentCommission = roundToTwoDecimals(((parseFloat(patentUser?.matchCommission) * (patentUser.matchComissionType == matchComissionTypeConstant.entryWise ? getCommissionLossAmount : commissionProfitLoss < 0 ? Math.abs(commissionProfitLoss) : 0)) / 100) * (upLinePartnership / 100));

                if (upperUserObj[patentUser.id]) {
                    upperUserObj[patentUser.id].profitLoss = upperUserObj[patentUser.id].profitLoss + profitLoss;
                    upperUserObj[patentUser.id].myProfitLoss = upperUserObj[patentUser.id].myProfitLoss + myProfitLoss;
                    upperUserObj[patentUser.id].exposure = upperUserObj[patentUser.id].exposure + maxLoss;
                    if (patentUser?.matchCommission && parseFloat(patentUser?.matchCommission) != 0) {
                        upperUserObj[patentUser.id].totalCommission += parentCommission;
                    }
                } else {
                    upperUserObj[patentUser.id] = { profitLoss: profitLoss, myProfitLoss: myProfitLoss, balance: 0, exposure: maxLoss, ...(patentUser?.matchCommission && parseFloat(patentUser?.matchCommission) != 0 ? { totalCommission: parentCommission } : {}) };
                }

                if (patentUser.createBy === patentUser.id) {
                    superAdminData[patentUser.id] = {
                        ...upperUserObj[patentUser.id],
                        role: patentUser.roleName,
                    };
                }
                if (patentUser?.matchCommission) {
                    if (patentUser.matchComissionType == matchComissionTypeConstant.entryWise) {
                        bulkCommission[user?.user?.id]?.forEach((item) => {
                            commissionReport.push({
                                createBy: user.user.id,
                                matchId: item.matchId,
                                betId: item?.betId,
                                betPlaceId: item?.betPlaceId,
                                commissionAmount: roundToTwoDecimals(parseFloat(item?.lossAmount) * parseFloat(patentUser?.matchCommission) / 100),
                                parentId: patentUser.id,
                                matchType: marketBetType.MATCHBETTING
                            });
                        });
                    }
                    else if (commissionProfitLoss < 0) {
                        commissionReport.push({
                            createBy: user.user.id,
                            matchId: matchId,
                            betId: betId,
                            commissionAmount: roundToTwoDecimals(Math.abs(commissionProfitLoss) * parseFloat(patentUser?.matchCommission) / 100),
                            parentId: patentUser.id,
                            stake: commissionProfitLoss

                        });
                    }
                    if (patentUser?.id == patentUser?.createBy) {
                        if (patentUser.matchComissionType == matchComissionTypeConstant.entryWise) {
                            bulkCommission[user?.user?.id]?.forEach((item) => {
                                faAdminCal.commission.push({
                                    createBy: user.user.id,
                                    matchId: item.matchId,
                                    betId: item?.betId,
                                    betPlaceId: item?.betPlaceId,
                                    parentId: patentUser.id,
                                    teamName: item?.sessionName,
                                    betPlaceDate: item?.betPlaceDate,
                                    odds: item?.odds,
                                    betType: item?.betType,
                                    stake: item?.stake,
                                    commissionAmount: roundToTwoDecimals(parseFloat(item?.lossAmount) * parseFloat(patentUser?.matchCommission) / 100),
                                    partnerShip: upLinePartnership,
                                    matchName: matchData?.title,
                                    matchStartDate: matchData?.startAt,
                                    userName: user.user.userName,
                                    matchType: marketBetType.MATCHBETTING

                                });
                            });
                        }
                        else if (commissionProfitLoss < 0) {
                            faAdminCal.commission.push({
                                createBy: user.user.id,
                                matchId: matchId,
                                betId: betId,
                                parentId: patentUser.id,
                                commissionAmount: roundToTwoDecimals(Math.abs(commissionProfitLoss) * parseFloat(patentUser?.matchCommission) / 100),
                                partnerShip: upLinePartnership,
                                matchName: matchData?.title,
                                matchStartDate: matchData?.startAt,
                                userName: user.user.userName,
                                stake: commissionProfitLoss

                            });
                        }
                    }
                }
            }

            faAdminCal.userData[user.user.superParentId] = {
                profitLoss: profitLoss + (faAdminCal.userData?.[user.user.superParentId]?.profitLoss || 0),
                exposure: maxLoss + (faAdminCal.userData?.[user.user.superParentId]?.exposure || 0),
                myProfitLoss: roundToTwoDecimals(((faAdminCal.userData?.[user.user.superParentId]?.profitLoss || 0)) + ((profitLoss) * (user.user.superParentType == userRoleConstant.fairGameAdmin ? parseFloat(user.user.fwPartnership) : 1) / 100)),
                userOriginalProfitLoss: commissionProfitLoss + (faAdminCal.userData?.[user.user.superParentId]?.userOriginalProfitLoss || 0),
                role: user.user.superParentType
            }

            faAdminCal.fwWalletDeduction = 0;
        }
    };


    await PromiseLimit.map(users, user => processUser(user), { concurrency: 20 });
    await updateUserPipeline.exec();

    const updateUserBatch = convertToBatches(500, userUpdateDBData);
    for (let i = 0; i < updateUserBatch.length; i++) {
        await updateUserDeclareBalanceData(updateUserBatch[i]);
    }

    return { fwProfitLoss, faAdminCal: JSON.stringify(faAdminCal), superAdminData: JSON.stringify(superAdminData), bulkCommission: JSON.stringify(bulkCommission) };
}


exports.unDeclareTournamentMatchResult = async (call) => {
    try {

        const { matchId, match, matchBetting, userId, isMatchOdd } = call.request;

        let users = await getDistinctUserBetPlaced(In([matchBetting?.id]));

        logger.info({
            message: "Tournament match result un declared.",
            data: {
                betId: matchBetting?.id
            }
        });

        let upperUserObj = {};
        let bulkWalletRecord = [];
        const commissionData = await getCombinedCommission(matchBetting?.id);

        let matchOddsWinBets = (await findAllPlacedBet({
            bettingName: matchOddName,
            result: betResultStatus.WIN,
            matchId: matchId,
        }))?.reduce((prev, curr) => {
            if (!prev[curr.createBy]) {
                prev[curr.createBy] = []
            }
            prev[curr.createBy].push(curr)
            return prev
        }, {});

        const profitLossData = await calculateProfitLossTournamentMatchForUserUnDeclare(
            users,
            matchBetting?.id,
            matchId,
            socketData.matchResultUnDeclare,
            userId,
            bulkWalletRecord,
            upperUserObj,
            matchBetting,
            commissionData,
            matchOddsWinBets,
            isMatchOdd
        );
        deleteCommission(matchBetting?.id);

        insertBulkTransactions(bulkWalletRecord);
        logger.info({
            message: "Upper user for this bet.",
            data: { upperUserObj, betId: matchBetting?.id }
        });

        const userEntries = Object.entries(upperUserObj);
        if (userEntries.length) {

            // 1️⃣ Fetch all current balances in one Redis pipeline
            const balanceResponses = await getUserRedisMultiKeyData(userEntries?.map(([userId]) => userId), ['profitLoss', 'myProfitLoss', 'exposure', 'totalCommission']);

            // 2️⃣ Compute deltas, queue Redis updates, and send socket messages
            const updatePipeline = internalRedis.pipeline();

            userEntries.forEach(([userId, updateData], idx) => {
                upperUserObj[userId].profitLoss = -upperUserObj[userId].profitLoss;
                upperUserObj[userId].totalCommission = -upperUserObj[userId].totalCommission;

                if (Object.keys(balanceResponses[userId] || {}).length) {
                    const { profitLoss, myProfitLoss, exposure, totalCommission } = balanceResponses[userId];
                    const currentProfitLoss = +profitLoss || 0;
                    const currentMyProfitLoss = +myProfitLoss || 0;
                    const currentExposure = +exposure || 0;
                    const currentTotalCommission = +totalCommission || 0;


                    const profitLossDelta = -(+updateData.profitLoss) || 0;
                    const myProfitLossDelta = (+updateData.myProfitLoss) || 0;
                    const rawExposureDelta = (+updateData.exposure) || 0;
                    const commissionDelta = -(+updateData.totalCommission) || 0;

                    // clamp exposure and adjust leftover
                    let newExposure = currentExposure + rawExposureDelta;
                    let adjustedExposure = rawExposureDelta;
                    if (newExposure < 0) {
                        logger.info({
                            message: 'Exposure went negative',
                            data: { matchId, userId, before: currentExposure, delta: rawExposureDelta }
                        });
                        adjustedExposure += newExposure;  // fold leftover back
                        newExposure = 0;
                    }

                    let { exposure: ex, profitLoss: pl, myProfitLoss: mpl, ...parentRedisUpdateObj } = updateData;
                    parentRedisUpdateObj = parentRedisUpdateObj?.[`${matchBetting?.id}${redisKeys.profitLoss}_${matchId}`];
                    const baseKey = `match:${userId}:${matchId}:${matchBetting?.id}:profitLoss`;

                    // queue Redis increments & key deletion
                    updatePipeline
                        .hincrbyfloat(userId, 'profitLoss', profitLossDelta)
                        .hincrbyfloat(userId, 'myProfitLoss', myProfitLossDelta)
                        .hincrbyfloat(userId, 'exposure', adjustedExposure)
                        .hmset(baseKey, parentRedisUpdateObj);

                    logger.info({
                        message: "Un Declare result db update for parent ",
                        data: {
                            parentUser: {
                                profitLoss: currentProfitLoss + profitLossDelta,
                                myProfitLoss: currentMyProfitLoss + myProfitLossDelta,
                                exposure: newExposure,
                                totalCommission: currentTotalCommission + commissionDelta,
                            },
                            betId: matchBetting?.id
                        },
                    });

                    // fire-and-forget socket notification
                    sendMessageToUser(userId, socketData.matchResultUnDeclare, {
                        profitLoss: currentProfitLoss + profitLossDelta,
                        myProfitLoss: currentMyProfitLoss + myProfitLossDelta,
                        exposure: newExposure,
                        totalCommission: currentTotalCommission + commissionDelta,
                        betId: matchBetting.id,
                        profitLossData: updateData,
                        matchId,
                        betType: matchBettingType.tournament
                    });
                }
            });

            await updatePipeline.exec();

            const updateUserBatch = convertToBatches(500, upperUserObj);
            for (let i = 0; i < updateUserBatch.length; i++) {
                await updateUserDeclareBalanceData(updateUserBatch[i]);
            }
        }

        let userIds = users.map(user => user.createBy);
        await updatePlaceBet(
            {
                betId: In([matchBetting?.id]),
                deleteReason: IsNull(),
                createBy: In(userIds)
            },
            {
                result: betResultStatus.PENDING,
            }
        );

        broadcastEvent(socketData.unDeclaredMatchResultAllUser, { matchId, gameType: match?.matchType, betId: matchBetting?.id, betType: matchBettingType.tournament });

        return { data: profitLossData }


    } catch (error) {
        logger.error({
            error: `Error at un declare match result for the user.`,
            stack: error.stack,
            message: error.message,
        });
        // Handle any errors and return an error response
        throw {
            code: grpc.status.INTERNAL,
            message: error?.message || __mf("internalServerError"),
        };
    }
}

const calculateProfitLossTournamentMatchForUserUnDeclare = async (users, betId, matchId, redisEventName, userId, bulkWalletRecord, upperUserObj, matchDetails, commissionData, matchOddsWinBets, isMatchOdd) => {

    let faAdminCal = {
        admin: {},
        wallet: {}
    };
    let superAdminData = {};

    let parentCommissionIds = new Set();
    let fwProfitLoss = 0;

    const userIds = users?.map((item) => item?.user?.id);

    const [
        userRedisData,
        getMultipleAmountData,
        multiUserParentData,
        betPlace
    ] = await Promise.all([
        getUserRedisMultiKeyData(userIds, [`userName`]),
        getMultipleAccountProfitLossTournament(betId, userIds),
        getMultiUserParentsWithBalance(userIds),
        findAllPlacedBetWithUserIdAndBetId(In(userIds), betId).then((data) => {
            return data.reduce((acc, item) => {
                if (!acc[item.createBy]) {
                    acc[item.createBy] = []
                }
                acc[item.createBy].push(item);
                return acc;
            }, {})
        })
    ]);

    const userUpdateDBData = {};
    const updateUserPipeline = internalRedis.pipeline();

    const processUser = async (user) => {

        const getMultipleAmount = getMultipleAmountData[user.user.id] || {};

        Object.keys(getMultipleAmount)?.forEach((item) => {
            getMultipleAmount[item] = roundToTwoDecimals(getMultipleAmount[item]);
        });
        let maxLoss = 0;

        logger.info({ message: "Updated users", data: user.user });

        // if data is not available in the redis then get data from redis and find max loss amount for all placed bet by user
        const redisData = await calculateRatesRacingMatch(betPlace[user.user.id], 100, matchDetails);
        Object.keys(redisData)?.forEach((key) => {
            maxLoss += Math.abs(Math.min(...Object.values(redisData[key] || {}), 0));
        });

        logger.info({
            maxLoss: maxLoss
        });

        user.user.userBalance.exposure = user.user.userBalance.exposure + maxLoss;

        logger.info({
            message: "Update user exposure for match tournament undeclare.",
            userId: user.user.id,
            exposure: user.user.userBalance.exposure
        });

        let result = matchDetails?.result;

        const getWinAmount = roundToTwoDecimals(getMultipleAmount.winAmount);
        const getLossAmount = roundToTwoDecimals(getMultipleAmount.lossAmount);

        let profitLoss = getWinAmount - getLossAmount;
        fwProfitLoss = fwProfitLoss - ((-profitLoss * user.user.fwPartnership) / 100);

        let userCurrentBalance = parseFloat(user.user.userBalance.currentBalance);
        matchOddsWinBets?.[user.user.id]?.forEach((matchOddData, uniqueId) => {
            userCurrentBalance += roundToTwoDecimals(matchOddData?.winAmount / 100)
            bulkWalletRecord.push({
                matchId: matchId,
                actionBy: userId,
                searchId: user.user.id,
                userId: user.user.id,
                amount: roundToTwoDecimals(matchOddData?.winAmount / 100),
                transType: transType.win,
                closingBalance: userCurrentBalance,
                createdAt: new Date(),
                description: `Revert deducted 1% for bet on match odds ${matchOddData?.eventType}/${matchOddData.eventName}-${matchOddData.teamName} on odds ${matchOddData.odds}/${matchOddData.betType} of stake ${matchOddData.amount} `,
                uniqueId: uniqueId,
                betId: [matchOddData.betId],
                type: transactionType.sports,
            });
        });


        // deducting 1% from match odd win amount 
        if (getWinAmount > 0 && isMatchOdd) {
            profitLoss -= roundToTwoDecimals(getWinAmount / 100);
        }

        const userCurrBalance = roundToTwoDecimals(user.user.userBalance.currentBalance - profitLoss);

        const userBalanceData = {
            currentBalance: userCurrBalance,
            profitLoss: user.user.userBalance.profitLoss - profitLoss,
            myProfitLoss: user.user.userBalance.myProfitLoss - profitLoss,
            exposure: user.user.userBalance.exposure,
        }
        let totalCommissionData = 0;
        let userCommission = commissionData?.find((item) => item?.userId == user.user.id);
        if (userCommission) {
            userBalanceData.totalCommission = parseFloat(user.user.userBalance.totalCommission) - parseFloat(userCommission?.amount || 0);
            totalCommissionData += parseFloat(userCommission?.amount || 0);
        }

        if (user.user.createBy === user.user.id && !user.user.isDemo) {
            superAdminData[user.user.id] = {
                role: user.user.roleName,
                profitLoss: profitLoss,
                myProfitLoss: profitLoss,
                exposure: maxLoss,
                totalCommission: parseFloat(userCommission?.amount || 0)
            };
        }

        let matchTeamRates = {}
        Object.keys(redisData)?.forEach((plData) => {
            matchTeamRates = { ...matchTeamRates, ...redisData[plData] };
        });

        //adding users balance data to update in db
        userUpdateDBData[user.user.id] = {
            profitLoss: -profitLoss,
            myProfitLoss: -profitLoss,
            exposure: maxLoss,
            totalCommission: -totalCommissionData
        };

        if (userRedisData[user.user.id]) {
            const baseKey = `match:${user.user.id}:${matchId}:${betId}:profitLoss`;

            updateUserPipeline
                .hincrbyfloat(user.user.id, 'profitLoss', -profitLoss)
                .hincrbyfloat(user.user.id, 'myProfitLoss', -profitLoss)
                .hincrbyfloat(user.user.id, 'exposure', maxLoss)
                .hincrbyfloat(user.user.id, 'currentBalance', -profitLoss)
                .hincrbyfloat(user.user.id, [redisKeys.userMatchExposure + matchId], maxLoss)
                .hset(baseKey, matchTeamRates);
        }

        logger.info({
            message: "user save at un declare result",
            data: user
        });

        sendMessageToUser(user.user.id, redisEventName, {
            betId, matchId, matchExposure: maxLoss, userBalanceData, profitLoss: redisData[`${betId}${redisKeys.profitLoss}_${matchId}`],
            betType: matchBettingType.tournament,
        });

        // deducting 1% from match odd win amount 
        if (getWinAmount > 0 && isMatchOdd) {
            user.user.userBalance.currentBalance = roundToTwoDecimals(user.user.userBalance.currentBalance + (getWinAmount / 100));
        }

        let currBal = user.user.userBalance.currentBalance;

        const transactions = [
            ...(result != resultType.noResult ? [{
                winAmount: getWinAmount,
                lossAmount: getLossAmount,
                type: matchDetails?.name,
                result: result,
                betId: [betId]
            }] : [])
        ];


        transactions?.forEach((item, uniqueId) => {
            currBal = currBal - item.winAmount + item.lossAmount;
            bulkWalletRecord.push({
                type: transactionType.sports,
                matchId: matchId,
                actionBy: userId,
                searchId: user.user.id,
                userId: user.user.id,
                amount: -(item.winAmount - item.lossAmount),
                transType: -(item.winAmount - item.lossAmount) < 0 ? transType.loss : transType.win,
                closingBalance: currBal,
                description: `Revert ${user?.eventType}/${user?.eventName}/${item.type} - ${matchDetails?.runners?.find((runnerData) => runnerData?.id == item.result)?.runnerName}`,
                createdAt: new Date(),
                uniqueId: uniqueId,
                betId: item?.betId
            });
        });

        if (!user.user.isDemo) {
            const parentUsers = await multiUserParentData[user.user.id] || [];

            for (const patentUser of parentUsers) {
                const upLinePartnership = getUpLinePartnerShipCalc(patentUser.roleName, user.user) ?? 100;

                let myProfitLoss = roundToTwoDecimals(profitLoss * upLinePartnership / 100);

                if (upperUserObj[patentUser.id]) {
                    upperUserObj[patentUser.id].profitLoss = upperUserObj[patentUser.id].profitLoss + profitLoss;
                    upperUserObj[patentUser.id].myProfitLoss = upperUserObj[patentUser.id].myProfitLoss + myProfitLoss;
                    upperUserObj[patentUser.id].exposure = upperUserObj[patentUser.id].exposure + maxLoss;

                    Object.keys(redisData)?.forEach((item) => {
                        if (upperUserObj[patentUser.id][item]) {
                            Object.keys(redisData[item])?.forEach((plKeys) => {
                                if (upperUserObj[patentUser.id]?.[item]?.[plKeys]) {
                                    upperUserObj[patentUser.id][item][plKeys] += -roundToTwoDecimals(parseFloat(redisData[item][plKeys]) * parseFloat(user?.user[`${partnershipPrefixByRole[patentUser?.roleName]}Partnership`]) / 100);
                                }
                                else {
                                    upperUserObj[patentUser.id][item][plKeys] = -roundToTwoDecimals(parseFloat(redisData[item][plKeys]) * parseFloat(user?.user[`${partnershipPrefixByRole[patentUser?.roleName]}Partnership`]) / 100);
                                }
                            });
                        }
                        else {
                            upperUserObj[patentUser.id][item] = {};
                            Object.keys(redisData[item])?.forEach((plKeys) => {
                                if (upperUserObj[patentUser.id]?.[item]?.[plKeys]) {
                                    upperUserObj[patentUser.id][item][plKeys] += -roundToTwoDecimals(parseFloat(redisData[item][plKeys]) * parseFloat(user?.user[`${partnershipPrefixByRole[patentUser?.roleName]}Partnership`]) / 100);
                                }
                                else {
                                    upperUserObj[patentUser.id][item][plKeys] = -roundToTwoDecimals(parseFloat(redisData[item][plKeys]) * parseFloat(user?.user[`${partnershipPrefixByRole[patentUser?.roleName]}Partnership`]) / 100);
                                }
                            });
                        }
                    });

                } else {
                    upperUserObj[patentUser.id] = { profitLoss: profitLoss, myProfitLoss: myProfitLoss, balance: 0, exposure: maxLoss };

                    if (!parentCommissionIds.has(patentUser.id)) {
                        parentCommissionIds.add(patentUser.id);

                        let userCommission = commissionData?.find((item) => item?.userId == patentUser.id);
                        if (userCommission) {
                            upperUserObj[patentUser.id].totalCommission = roundToTwoDecimals(parseFloat(userCommission?.amount || 0) * upLinePartnership / 100);
                        }
                    }

                    Object.keys(redisData)?.forEach((item) => {
                        upperUserObj[patentUser.id][item] = {};
                        Object.keys(redisData[item])?.forEach((plKeys) => {
                            if (upperUserObj[patentUser.id]?.[item]?.[plKeys]) {
                                upperUserObj[patentUser.id][item][plKeys] += -roundToTwoDecimals(parseFloat(redisData[item][plKeys]) * parseFloat(user?.user[`${partnershipPrefixByRole[patentUser?.roleName]}Partnership`]) / 100);
                            }
                            else {
                                upperUserObj[patentUser.id][item][plKeys] = -roundToTwoDecimals(parseFloat(redisData[item][plKeys]) * parseFloat(user?.user[`${partnershipPrefixByRole[patentUser?.roleName]}Partnership`]) / 100);
                            }
                        });
                    });
                }

                if (patentUser.createBy === patentUser.id) {
                    superAdminData[patentUser.id] = {
                        ...upperUserObj[patentUser.id],
                        role: patentUser.roleName,
                    };
                }
            }


            Object.keys(redisData)?.forEach((item) => {
                if (user.user.superParentType == userRoleConstant.fairGameAdmin) {
                    if (faAdminCal.admin?.[user.user.superParentId]?.[item]) {
                        Object.keys(redisData[item])?.forEach((plKeys) => {
                            if (faAdminCal.admin[user.user.superParentId]?.[item]?.[plKeys]) {
                                faAdminCal.admin[user.user.superParentId][item][plKeys] += -roundToTwoDecimals(parseFloat(redisData[item][plKeys]) * parseFloat(user?.user[`faPartnership`]) / 100);
                            }
                            else {
                                faAdminCal.admin[user.user.superParentId][item][plKeys] = -roundToTwoDecimals(parseFloat(redisData[item][plKeys]) * parseFloat(user?.user[`faPartnership`]) / 100);
                            }
                        });
                    }
                    else {
                        if (!faAdminCal.admin[user.user.superParentId]) {
                            faAdminCal.admin[user.user.superParentId] = {};
                        }
                        faAdminCal.admin[user.user.superParentId][item] = {};
                        Object.keys(redisData[item])?.forEach((plKeys) => {
                            if (faAdminCal.admin[user.user.superParentId][item]?.[plKeys]) {
                                faAdminCal.admin[user.user.superParentId][item][plKeys] += -roundToTwoDecimals(parseFloat(redisData[item][plKeys]) * parseFloat(user?.user[`faPartnership`]) / 100);
                            }
                            else {
                                faAdminCal.admin[user.user.superParentId][item][plKeys] = -roundToTwoDecimals(parseFloat(redisData[item][plKeys]) * parseFloat(user?.user[`faPartnership`]) / 100);
                            }
                        });
                    }
                }
                if (faAdminCal.wallet?.[item]) {
                    Object.keys(redisData[item])?.forEach((plKeys) => {
                        if (faAdminCal.wallet?.[item]?.[plKeys]) {
                            faAdminCal.wallet[item][plKeys] += -roundToTwoDecimals(parseFloat(redisData[item][plKeys]) * parseFloat(user?.user[`fwPartnership`]) / 100);
                        }
                        else {
                            faAdminCal.wallet[item][plKeys] = -roundToTwoDecimals(parseFloat(redisData[item][plKeys]) * parseFloat(user?.user[`fwPartnership`]) / 100);
                        }
                    });
                }
                else {
                    faAdminCal.wallet[item] = {};
                    Object.keys(redisData[item])?.forEach((plKeys) => {
                        if (faAdminCal.wallet[item]?.[plKeys]) {
                            faAdminCal.wallet[item][plKeys] += -roundToTwoDecimals(parseFloat(redisData[item][plKeys]) * parseFloat(user?.user[`fwPartnership`]) / 100);
                        }
                        else {
                            faAdminCal.wallet[item][plKeys] = -roundToTwoDecimals(parseFloat(redisData[item][plKeys]) * parseFloat(user?.user[`fwPartnership`]) / 100);
                        }
                    });
                }
            });

            faAdminCal.admin[user.user.superParentId] = {
                ...faAdminCal.admin[user.user.superParentId],
                profitLoss: profitLoss + (faAdminCal.admin[user.user.superParentId]?.profitLoss || 0),
                exposure: maxLoss + (faAdminCal.admin[user.user.superParentId]?.exposure || 0),
                myProfitLoss: roundToTwoDecimals(parseFloat(faAdminCal.admin[user.user.superParentId]?.myProfitLoss || 0) + (profitLoss * parseFloat(user.user.fwPartnership) / 100)),
                role: user.user.superParentType
            }

            faAdminCal.fwWalletDeduction = (faAdminCal.fwWalletDeduction || 0);
        }
    };

    for (let user of users) {
        await processUser(user);
    }


    await updateUserPipeline.exec();
    const updateUserBatch = convertToBatches(500, userUpdateDBData);
    for (let i = 0; i < updateUserBatch.length; i++) {
        await updateUserDeclareBalanceData(updateUserBatch[i]);
    }

    return { fwProfitLoss, faAdminCal: JSON.stringify(faAdminCal), superAdminData: JSON.stringify(superAdminData) };
}

exports.declareFinalMatchResult = async (call) => {
    try {
        const { matchId, matchType } = call.request;

        logger.info({
            message: "Match final result declared.",
            data: {
                matchId
            },
        });

        broadcastEvent(socketData.declaredMatchResultAllUser, { matchId, gameType: matchType, isMatchDeclare: true });
        await updateMatchData({ id: matchId }, { stopAt: new Date() });
        return {}
    } catch (error) {
        logger.error({
            error: `Error at declare final match result for the user.`,
            stack: error.stack,
            message: error.message,
        });
        throw {
            code: grpc.status.INTERNAL,
            message: error?.message || __mf("internalServerError"),
        };
    }
};

exports.unDeclareFinalMatchResult = async (call) => {
    try {

        const { matchId, matchType } = call.request;

        logger.info({
            message: "Final match result un declared.",
            data: {
                matchId
            }
        });

        broadcastEvent(socketData.unDeclaredMatchResultAllUser, { matchId, gameType: matchType });
        await updateMatchData({ id: matchId }, { stopAt: null });

        return {}

    } catch (error) {
        logger.error({
            error: `Error at un declare final match result for the user.`,
            stack: error.stack,
            message: error.message,
        });
        // Handle any errors and return an error response
        throw {
            code: grpc.status.INTERNAL,
            message: error?.message || __mf("internalServerError"),
        };
    }
}
