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
const { logger } = require("../../../config/logger");
const { getMatchBetPlaceWithUser, addNewBet, getMultipleAccountOtherMatchProfitLoss, updatePlaceBet, getDistinctUserBetPlaced, findAllPlacedBet } = require("../../../services/betPlacedService");
const {
    insertBulkTransactions,
    insertBulkCommissions,
    parseRedisData,
    calculateProfitLossForRacingMatchToResult,
} = require("../../../services/commonService");
const grpc = require("@grpc/grpc-js");
const { __mf } = require("i18n");
const { getUserRedisData, deleteKeyFromUserRedis, incrementValuesRedis } = require("../../../services/redis/commonfunction");
const {
    updateUserBalanceData,
    updateUserDeclareBalanceData,
} = require("../../../services/userBalanceService");
const {
    getParentsWithBalance,
    getUserDataWithUserBalanceDeclare,
} = require("../../../services/userService");
const { sendMessageToUser, broadcastEvent } = require("../../../sockets/socketManager");
const { deleteCommission, getCombinedCommission } = require("../../../services/commissionService");
const { updateMatchData } = require("../../../services/matchService");
const internalRedis = require("../../../config/internalRedisConnection");

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
        let matchOddWinBets = [];

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
                matchOddWinBets.push(item)
            }
            updateRecords.push(item);
            userData.add(item?.user?.id);
        }

        await addNewBet(updateRecords);


        let users = await getUserDataWithUserBalanceDeclare({ id: In([...userData]) });

        let upperUserObj = {};
        let bulkWalletRecord = [];
        let commissionReport = [];
        const profitLossData = await calculateProfitLossTournamentMatchForUserDeclare(
            users,
            marketDetail?.id,
            matchId,
            0,
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
            isMatchOdd
        );

        insertBulkTransactions(bulkWalletRecord);
        logger.info({
            message: "Upper user for this bet.",
            data: { upperUserObj, betId: marketDetail?.id },
        });

        const userEntries = Object.entries(upperUserObj);
        if (!userEntries.length) return;

        // 1️⃣ Fetch all current balances in one Redis pipeline
        const balanceResponses = await internalRedis.pipeline(
            userEntries.map(([userId]) =>
                ['hmget', userId, 'profitLoss', 'myProfitLoss', 'exposure', 'totalCommission']
            )
        ).exec();

        // 2️⃣ Compute deltas, queue Redis updates, and send socket messages
        const updatePipeline = internalRedis.pipeline();

        userEntries.forEach(([userId, updateData], idx) => {
            upperUserObj[userId].exposure = -upperUserObj[userId].exposure;
            upperUserObj[userId].myProfitLoss = -upperUserObj[userId].myProfitLoss;

            if (balanceResponses[idx][1]?.filter((items) => !!items).length) {
                const [plStr, mplStr, expStr, comStr] = balanceResponses[idx][1];
                const currentProfitLoss = +plStr || 0;
                const currentMyProfitLoss = +mplStr || 0;
                const currentExposure = +expStr || 0;
                const currentTotalCommission = +comStr || 0;


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

                // queue Redis increments & key deletion
                updatePipeline
                    .hincrbyfloat(userId, 'profitLoss', profitLossDelta)
                    .hincrbyfloat(userId, 'myProfitLoss', myProfitLossDelta)
                    .hincrbyfloat(userId, 'exposure', adjustedExposure)
                    .hincrbyfloat(userId, 'totalCommission', commissionDelta)
                    .hdel(userId, `${marketDetail.id}${redisKeys.profitLoss}_${matchId}`);

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

        await Promise.all([updatePipeline.exec(), updateUserDeclareBalanceData(upperUserObj)]);

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

const calculateProfitLossTournamentMatchForUserDeclare = async (users, betId, matchId, fwProfitLoss, redisEventName, userId, bulkWalletRecord, upperUserObj, result, matchData, marketDetail, commission, bulkCommission, commissionReport, matchOddWinBets, isMatchOdd) => {

    let faAdminCal = {
        commission: [],
        userData: {}
    };
    let superAdminData = {};

    for (let user of users) {
        user = { user: user };
        let getWinAmount = 0;
        let getLossAmount = 0;
        let getCommissionLossAmount = 0;
        let getCommissionWinAmount = 0;
        let profitLoss = 0;
        let commissionProfitLoss = 0;
        let userRedisData = await getUserRedisData(user.user.id);
        let getMultipleAmount = await getMultipleAccountOtherMatchProfitLoss([betId], user.user.id);

        Object.keys(getMultipleAmount)?.forEach((item) => {
            getMultipleAmount[item] = parseRedisData(item, getMultipleAmount);
        });

        let maxLoss = 0;
        logger.info({ message: "Updated users", data: user.user });

        // check if data is already present in the redis or not
        if (userRedisData?.[`${betId}${redisKeys.profitLoss}_${matchId}`]) {
            maxLoss = (Math.abs(Math.min(...Object.values(JSON.parse(userRedisData?.[`${betId}${redisKeys.profitLoss}_${matchId}`]) || {}), 0))) || 0;
        }
        else {
            // if data is not available in the redis then get data from redis and find max loss amount for all placed bet by user
            let redisData = await calculateProfitLossForRacingMatchToResult([betId], user.user?.id, marketDetail);
            Object.keys(redisData)?.forEach((key) => {
                maxLoss += Math.abs(Math.min(...Object.values(redisData[key] || {}), 0));
            });
        }

        user.user.userBalance.exposure = user.user.userBalance.exposure - maxLoss;

        logger.info({
            message: "Update user exposure.",
            data: user.user.userBalance.exposure
        });

        getWinAmount = getMultipleAmount.winAmount;
        getLossAmount = getMultipleAmount.lossAmount;
        getCommissionLossAmount = getMultipleAmount.lossAmountCommission;
        getCommissionWinAmount = getMultipleAmount.winAmountCommission;
        profitLoss = parseFloat(getWinAmount.toString()) - parseFloat(getLossAmount.toString());
        commissionProfitLoss = parseFloat(getCommissionWinAmount.toString()) - parseFloat(getCommissionLossAmount.toString());

        fwProfitLoss = parseFloat(fwProfitLoss.toString()) + parseFloat(((-profitLoss * user.user.fwPartnership) / 100).toString());

        let userCurrentBalance = parseFloat(user.user.userBalance.currentBalance);
        matchOddWinBets?.filter((item) => item.user.id == user.user.id)?.forEach((matchOddData, uniqueId) => {
            userCurrentBalance -= parseFloat(parseFloat((matchOddData?.winAmount) / 100).toFixed(2))
            bulkWalletRecord.push({
                type: transactionType.sports,
                matchId: matchId,
                actionBy: userId,
                searchId: user.user.id,
                userId: user.user.id,
                amount: -parseFloat(parseFloat((matchOddData?.winAmount) / 100).toFixed(2)),
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
            profitLoss -= parseFloat(((parseFloat(getWinAmount) / 100)).toFixed(2));
        }

        const userCurrBalance = Number(user.user.userBalance.currentBalance + profitLoss).toFixed(2);
        let userBalanceData = {
            currentBalance: userCurrBalance,
            profitLoss: user.user.userBalance.profitLoss + profitLoss,
            myProfitLoss: user.user.userBalance.myProfitLoss + profitLoss,
            exposure: user.user.userBalance.exposure
        }

        let totalCommissionData = 0;

        if (user.user.matchCommission) {
            if (user.user.matchComissionType == matchComissionTypeConstant.entryWise) {
                userBalanceData.totalCommission = parseFloat((parseFloat(user.user.userBalance.totalCommission) + parseFloat(getCommissionLossAmount) * parseFloat(user.user.matchCommission) / 100).toFixed(2));
                totalCommissionData += parseFloat((parseFloat(getCommissionLossAmount) * parseFloat(user.user.matchCommission) / 100).toFixed(2))
            }
            else if (commissionProfitLoss < 0) {
                userBalanceData.totalCommission = parseFloat((parseFloat(user.user.userBalance.totalCommission) + Math.abs(parseFloat(commissionProfitLoss)) * parseFloat(user.user.matchCommission) / 100).toFixed(2));
                totalCommissionData += parseFloat((Math.abs(parseFloat(commissionProfitLoss)) * parseFloat(user.user.matchCommission) / 100).toFixed(2))
            }
        }

        await updateUserBalanceData(user.user.id, {
            profitLoss: profitLoss,
            myProfitLoss: profitLoss,
            exposure: -maxLoss,
            totalCommission: totalCommissionData
        });

        if (userRedisData?.exposure) {

            await incrementValuesRedis(user.user.id, {
                profitLoss: profitLoss,
                myProfitLoss: profitLoss,
                exposure: -maxLoss,
                currentBalance: profitLoss
            });
        }


        if (user?.user?.matchCommission) {

            if (user.user.matchComissionType == matchComissionTypeConstant.entryWise) {
                bulkCommission[user?.user?.id]?.forEach((item) => {
                    commissionReport.push({
                        createBy: user.user.id,
                        matchId: item.matchId,
                        betId: item?.betId,
                        betPlaceId: item?.betPlaceId,
                        commissionAmount: parseFloat((parseFloat(item?.lossAmount) * parseFloat(user?.user?.matchCommission) / 100).toFixed(2)),
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
                    commissionAmount: parseFloat((parseFloat(Math.abs(commissionProfitLoss)) * parseFloat(user?.user?.matchCommission) / 100).toFixed(2)),
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
                            commissionAmount: parseFloat((parseFloat(item?.lossAmount) * parseFloat(user?.user?.matchCommission) / 100).toFixed(2)),
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
                        commissionAmount: parseFloat((parseFloat(Math.abs(commissionProfitLoss)) * parseFloat(user?.user?.matchCommission) / 100).toFixed(2)),
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

        sendMessageToUser(user.user.id, redisEventName, { ...user.user, betId: betId, matchId, userBalanceData });
        // deducting 1% from match odd win amount 
        if (parseFloat(getWinAmount) > 0 && isMatchOdd) {
            user.user.userBalance.currentBalance = parseFloat(parseFloat(user.user.userBalance.currentBalance - (parseFloat(getWinAmount) / 100)).toFixed(2));
        }

        let currBal = user.user.userBalance.currentBalance;

        const transactions = [
            ...(result != resultType.noResult ? [{
                winAmount: parseFloat(getMultipleAmount.winAmount),
                lossAmount: parseFloat(getMultipleAmount.lossAmount),
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

        await deleteKeyFromUserRedis(user.user.id, redisKeys.userMatchExposure + matchId, `${betId}${redisKeys.profitLoss}_${matchId}`);

        if (user.user.createBy === user.user.id && !user.user.isDemo) {
            superAdminData[user.user.id] = {
                role: user.user.roleName,
                profitLoss: profitLoss,
                myProfitLoss: profitLoss,
                exposure: maxLoss,
                totalCommission: (user.user.matchComissionType == matchComissionTypeConstant.entryWise ? (commission[user.user.id] || 0) : commissionProfitLoss < 0 ? parseFloat((parseFloat(Math.abs(commissionProfitLoss)) * parseFloat(user?.user?.matchCommission) / 100).toFixed(2)) : 0)
            };
        }

        if (!user.user.isDemo) {
            let parentUsers = await getParentsWithBalance(user.user.id);

            for (const patentUser of parentUsers) {
                let upLinePartnership = 100;
                if (patentUser.roleName === userRoleConstant.superAdmin) {
                    upLinePartnership = user.user.fwPartnership + user.user.faPartnership;
                } else if (patentUser.roleName === userRoleConstant.admin) {
                    upLinePartnership = user.user.fwPartnership + user.user.faPartnership + user.user.saPartnership;
                } else if (patentUser.roleName === userRoleConstant.superMaster) {
                    upLinePartnership = user.user.fwPartnership + user.user.faPartnership + user.user.saPartnership + user.user.aPartnership;
                } else if (patentUser.roleName === userRoleConstant.master) {
                    upLinePartnership = user.user.fwPartnership + user.user.faPartnership + user.user.saPartnership + user.user.aPartnership + user.user.smPartnership;
                }
                else if (patentUser.roleName === userRoleConstant.agent) {
                    upLinePartnership = user.user.fwPartnership + user.user.faPartnership + user.user.saPartnership + user.user.aPartnership + user.user.smPartnership + user.user.mPartnership;
                }

                let myProfitLoss = parseFloat(
                    (((profitLoss) * upLinePartnership) / 100).toString()
                );
                let parentCommission = parseFloat((parseFloat(((parseFloat(patentUser?.matchCommission) * ((patentUser.matchComissionType == matchComissionTypeConstant.entryWise ? getCommissionLossAmount : commissionProfitLoss < 0 ? Math.abs(commissionProfitLoss) : 0))) / 100).toFixed(2)) * parseFloat(upLinePartnership) / 100).toFixed(2));

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
                                commissionAmount: parseFloat((parseFloat(item?.lossAmount) * parseFloat(patentUser?.matchCommission) / 100).toFixed(2)),
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
                            commissionAmount: parseFloat((parseFloat(Math.abs(commissionProfitLoss)) * parseFloat(patentUser?.matchCommission) / 100).toFixed(2)),
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
                                    commissionAmount: parseFloat((parseFloat(item?.lossAmount) * parseFloat(patentUser?.matchCommission) / 100).toFixed(2)),
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
                                commissionAmount: parseFloat((parseFloat(Math.abs(commissionProfitLoss)) * parseFloat(patentUser?.matchCommission) / 100).toFixed(2)),
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
                myProfitLoss: parseFloat((((faAdminCal.userData?.[user.user.superParentId]?.profitLoss || 0)) + ((profitLoss) * (user.user.superParentType == userRoleConstant.fairGameAdmin ? parseFloat(user.user.fwPartnership) : 1) / 100)).toFixed(2)),
                userOriginalProfitLoss: commissionProfitLoss + (faAdminCal.userData?.[user.user.superParentId]?.userOriginalProfitLoss || 0),
                role: user.user.superParentType
            }

            faAdminCal.fwWalletDeduction = 0;
        }

    };
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

        let matchOddsWinBets = await findAllPlacedBet({
            bettingName: matchOddName,
            result: betResultStatus.WIN,
            matchId: matchId,
        });

        const profitLossData = await calculateProfitLossTournamentMatchForUserUnDeclare(
            users,
            matchBetting?.id,
            matchId,
            0,
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
        if (!userEntries.length) return;

        // 1️⃣ Fetch all current balances in one Redis pipeline
        const balanceResponses = await internalRedis.pipeline(
            userEntries.map(([userId]) =>
                ['hmget', userId, 'profitLoss', 'myProfitLoss', 'exposure', 'totalCommission']
            )
        ).exec();

        // 2️⃣ Compute deltas, queue Redis updates, and send socket messages
        const updatePipeline = internalRedis.pipeline();

        userEntries.forEach(([userId, updateData], idx) => {
            upperUserObj[userId].profitLoss = -upperUserObj[userId].profitLoss;
            upperUserObj[userId].totalCommission = -upperUserObj[userId].totalCommission;

            if (balanceResponses[idx][1]?.filter((items) => !!items).length) {
                const [plStr, mplStr, expStr, comStr] = balanceResponses[idx][1];
                const currentProfitLoss = +plStr || 0;
                const currentMyProfitLoss = +mplStr || 0;
                const currentExposure = +expStr || 0;
                const currentTotalCommission = +comStr || 0;


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

                let { exposure, profitLoss, myProfitLoss, ...parentRedisUpdateObj } = updateData;
                Object.keys(parentRedisUpdateObj)?.forEach((plKey) => {
                    parentRedisUpdateObj[plKey] = JSON.stringify(parentRedisUpdateObj[plKey]);
                });

                // queue Redis increments & key deletion
                updatePipeline
                    .hincrbyfloat(userId, 'profitLoss', profitLossDelta)
                    .hincrbyfloat(userId, 'myProfitLoss', myProfitLossDelta)
                    .hincrbyfloat(userId, 'exposure', adjustedExposure)
                    .hincrbyfloat(userId, 'totalCommission', commissionDelta)
                    .hmset(userId, parentRedisUpdateObj);

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

        await Promise.all([updatePipeline.exec(), updateUserDeclareBalanceData(upperUserObj)]);


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
        await updateMatchData({ id: matchId }, { stopAt: null });
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

const calculateProfitLossTournamentMatchForUserUnDeclare = async (users, betId, matchId, fwProfitLoss, redisEventName, userId, bulkWalletRecord, upperUserObj, matchDetails, commissionData, matchOddsWinBets, isMatchOdd) => {

    let faAdminCal = {
        admin: {},
        wallet: {}
    };
    let superAdminData = {};

    let parentCommissionIds = new Set();

    for (const user of users) {
        let getWinAmount = 0;
        let getLossAmount = 0;
        let profitLoss = 0;
        let userRedisData = await getUserRedisData(user.user.id);
        let getMultipleAmount = await getMultipleAccountOtherMatchProfitLoss([betId], user.user.id);

        Object.keys(getMultipleAmount)?.forEach((item) => {
            getMultipleAmount[item] = parseFloat(parseFloat(getMultipleAmount[item]).toFixed(2));
        });
        let maxLoss = 0;

        logger.info({ message: "Updated users", data: user.user });

        // if data is not available in the redis then get data from redis and find max loss amount for all placed bet by user
        let redisData = await calculateProfitLossForRacingMatchToResult([betId], user.user?.id, matchDetails);
        Object.keys(redisData)?.forEach((key) => {
            maxLoss += Math.abs(Math.min(...Object.values(redisData[key] || {}), 0));
        });

        logger.info({
            maxLoss: maxLoss
        });

        user.user.userBalance.exposure = user.user.userBalance.exposure + maxLoss;

        logger.info({
            message: "Update user exposure.",
            data: user.user.exposure
        });

        let result = matchDetails?.result;

        getWinAmount = getMultipleAmount.winAmount;
        getLossAmount = getMultipleAmount.lossAmount;

        profitLoss = parseFloat(getWinAmount.toString()) - parseFloat(getLossAmount.toString());
        fwProfitLoss = parseFloat((parseFloat(fwProfitLoss.toString()) - parseFloat(((-profitLoss * user.user.fwPartnership) / 100).toString())).toFixed(2));

        let userCurrentBalance = parseFloat(user.user.userBalance.currentBalance);
        matchOddsWinBets?.filter((item) => item.createBy == user.user.id)?.forEach((matchOddData, uniqueId) => {
            userCurrentBalance += parseFloat(parseFloat((matchOddData?.winAmount) / 100).toFixed(2))
            bulkWalletRecord.push({
                matchId: matchId,
                actionBy: userId,
                searchId: user.user.id,
                userId: user.user.id,
                amount: parseFloat(parseFloat((matchOddData?.winAmount) / 100).toFixed(2)),
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
        if (parseFloat(getWinAmount) > 0 && isMatchOdd) {
            profitLoss -= parseFloat(((parseFloat(getWinAmount) / 100)).toFixed(2));
        }

        const userCurrBalance = Number(
            (user.user.userBalance.currentBalance - profitLoss).toFixed(2)
        );

        let userBalanceData = {
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
                totalCommission: parseFloat(commissionData?.find((item) => item?.userId == user.user.id)?.amount || 0)
            };
        }

        let matchTeamRates = {}
        Object.keys(redisData)?.forEach((plData) => {
            matchTeamRates[plData] = JSON.stringify(redisData[plData]);
        });

        await updateUserBalanceData(user.user.id, {
            profitLoss: -profitLoss,
            myProfitLoss: -profitLoss,
            exposure: maxLoss,
            totalCommission: -totalCommissionData
        });

        if (userRedisData?.exposure) {

            await incrementValuesRedis(user.user.id, {
                currentBalance: -profitLoss,
                profitLoss: -profitLoss,
                myProfitLoss: -profitLoss,
                exposure: maxLoss,
                [redisKeys.userMatchExposure + matchId]: maxLoss
            }, matchTeamRates);
        }

        logger.info({
            message: "user save at un declare result",
            data: user
        });

        sendMessageToUser(user.user.id, redisEventName, {
            ...user.user, betId, matchId, matchExposure: maxLoss, userBalanceData, profitLoss: redisData[`${betId}${redisKeys.profitLoss}_${matchId}`],
            betType: matchBettingType.tournament,
        });

        // deducting 1% from match odd win amount 
        if (parseFloat(getWinAmount) > 0 && isMatchOdd) {
            user.user.userBalance.currentBalance = parseFloat(parseFloat(user.user.userBalance.currentBalance + (parseFloat(getWinAmount) / 100)).toFixed(2));
        }

        let currBal = user.user.userBalance.currentBalance;

        const transactions = [
            ...(result != resultType.noResult ? [{
                winAmount: parseFloat(parseFloat(getMultipleAmount.winAmount).toFixed(2)),
                lossAmount: parseFloat(parseFloat(getMultipleAmount.lossAmount).toFixed(2)),
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
            let parentUsers = await getParentsWithBalance(user.user.id);

            for (const patentUser of parentUsers) {
                let upLinePartnership = 100;
                if (patentUser.roleName === userRoleConstant.superAdmin) {
                    upLinePartnership = user.user.fwPartnership + user.user.faPartnership;
                } else if (patentUser.roleName === userRoleConstant.admin) {
                    upLinePartnership = user.user.fwPartnership + user.user.faPartnership + user.user.saPartnership;
                } else if (patentUser.roleName === userRoleConstant.superMaster) {
                    upLinePartnership = user.user.fwPartnership + user.user.faPartnership + user.user.saPartnership + user.user.aPartnership;
                } else if (patentUser.roleName === userRoleConstant.master) {
                    upLinePartnership = user.user.fwPartnership + user.user.faPartnership + user.user.saPartnership + user.user.aPartnership + user.user.smPartnership;
                }
                else if (patentUser.roleName === userRoleConstant.agent) {
                    upLinePartnership = user.user.fwPartnership + user.user.faPartnership + user.user.saPartnership + user.user.aPartnership + user.user.smPartnership + user.user.mPartnership;
                }

                let myProfitLoss = parseFloat(
                    (((profitLoss) * upLinePartnership) / 100).toString()
                );

                if (upperUserObj[patentUser.id]) {
                    upperUserObj[patentUser.id].profitLoss = upperUserObj[patentUser.id].profitLoss + profitLoss;
                    upperUserObj[patentUser.id].myProfitLoss = upperUserObj[patentUser.id].myProfitLoss + myProfitLoss;
                    upperUserObj[patentUser.id].exposure = upperUserObj[patentUser.id].exposure + maxLoss;

                    Object.keys(redisData)?.forEach((item) => {
                        if (upperUserObj[patentUser.id][item]) {
                            Object.keys(redisData[item])?.forEach((plKeys) => {
                                if (upperUserObj[patentUser.id]?.[item]?.[plKeys]) {
                                    upperUserObj[patentUser.id][item][plKeys] += -parseFloat((parseFloat(redisData[item][plKeys]) * parseFloat(user?.user[`${partnershipPrefixByRole[patentUser?.roleName]}Partnership`]) / 100).toFixed(2));
                                }
                                else {
                                    upperUserObj[patentUser.id][item][plKeys] = -parseFloat((parseFloat(redisData[item][plKeys]) * parseFloat(user?.user[`${partnershipPrefixByRole[patentUser?.roleName]}Partnership`]) / 100).toFixed(2));
                                }
                            });
                        }
                        else {
                            upperUserObj[patentUser.id][item] = {};
                            Object.keys(redisData[item])?.forEach((plKeys) => {
                                if (upperUserObj[patentUser.id]?.[item]?.[plKeys]) {
                                    upperUserObj[patentUser.id][item][plKeys] += -parseFloat((parseFloat(redisData[item][plKeys]) * parseFloat(user?.user[`${partnershipPrefixByRole[patentUser?.roleName]}Partnership`]) / 100).toFixed(2));
                                }
                                else {
                                    upperUserObj[patentUser.id][item][plKeys] = -parseFloat((parseFloat(redisData[item][plKeys]) * parseFloat(user?.user[`${partnershipPrefixByRole[patentUser?.roleName]}Partnership`]) / 100).toFixed(2));
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
                            upperUserObj[patentUser.id].totalCommission = parseFloat((parseFloat(userCommission?.amount || 0) * parseFloat(upLinePartnership) / 100).toFixed(2));
                        }
                    }

                    Object.keys(redisData)?.forEach((item) => {
                        upperUserObj[patentUser.id][item] = {};
                        Object.keys(redisData[item])?.forEach((plKeys) => {
                            if (upperUserObj[patentUser.id]?.[item]?.[plKeys]) {
                                upperUserObj[patentUser.id][item][plKeys] += -parseFloat((parseFloat(redisData[item][plKeys]) * parseFloat(user?.user[`${partnershipPrefixByRole[patentUser?.roleName]}Partnership`]) / 100).toFixed(2));
                            }
                            else {
                                upperUserObj[patentUser.id][item][plKeys] = -parseFloat((parseFloat(redisData[item][plKeys]) * parseFloat(user?.user[`${partnershipPrefixByRole[patentUser?.roleName]}Partnership`]) / 100).toFixed(2));
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
                                faAdminCal.admin[user.user.superParentId][item][plKeys] += -parseFloat((parseFloat(redisData[item][plKeys]) * parseFloat(user?.user[`faPartnership`]) / 100).toFixed(2));
                            }
                            else {
                                faAdminCal.admin[user.user.superParentId][item][plKeys] = -parseFloat((parseFloat(redisData[item][plKeys]) * parseFloat(user?.user[`faPartnership`]) / 100).toFixed(2));
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
                                faAdminCal.admin[user.user.superParentId][item][plKeys] += -parseFloat((parseFloat(redisData[item][plKeys]) * parseFloat(user?.user[`faPartnership`]) / 100).toFixed(2));
                            }
                            else {
                                faAdminCal.admin[user.user.superParentId][item][plKeys] = -parseFloat((parseFloat(redisData[item][plKeys]) * parseFloat(user?.user[`faPartnership`]) / 100).toFixed(2));
                            }
                        });
                    }
                }
                if (faAdminCal.wallet?.[item]) {
                    Object.keys(redisData[item])?.forEach((plKeys) => {
                        if (faAdminCal.wallet?.[item]?.[plKeys]) {
                            faAdminCal.wallet[item][plKeys] += -parseFloat((parseFloat(redisData[item][plKeys]) * parseFloat(user?.user[`fwPartnership`]) / 100).toFixed(2));
                        }
                        else {
                            faAdminCal.wallet[item][plKeys] = -parseFloat((parseFloat(redisData[item][plKeys]) * parseFloat(user?.user[`fwPartnership`]) / 100).toFixed(2));
                        }
                    });
                }
                else {
                    faAdminCal.wallet[item] = {};
                    Object.keys(redisData[item])?.forEach((plKeys) => {
                        if (faAdminCal.wallet[item]?.[plKeys]) {
                            faAdminCal.wallet[item][plKeys] += -parseFloat((parseFloat(redisData[item][plKeys]) * parseFloat(user?.user[`fwPartnership`]) / 100).toFixed(2));
                        }
                        else {
                            faAdminCal.wallet[item][plKeys] = -parseFloat((parseFloat(redisData[item][plKeys]) * parseFloat(user?.user[`fwPartnership`]) / 100).toFixed(2));
                        }
                    });
                }
            });

            faAdminCal.admin[user.user.superParentId] = {
                ...faAdminCal.admin[user.user.superParentId],
                profitLoss: profitLoss + (faAdminCal.admin[user.user.superParentId]?.profitLoss || 0),
                exposure: maxLoss + (faAdminCal.admin[user.user.superParentId]?.exposure || 0),
                myProfitLoss: parseFloat((parseFloat(faAdminCal.admin[user.user.superParentId]?.myProfitLoss || 0) + (parseFloat(profitLoss) * parseFloat(user.user.fwPartnership) / 100)).toFixed(2)),
                role: user.user.superParentType
            }

            faAdminCal.fwWalletDeduction = (faAdminCal.fwWalletDeduction || 0);
        }
    };
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
