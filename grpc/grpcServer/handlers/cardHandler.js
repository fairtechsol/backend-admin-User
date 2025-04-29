const grpc = require("@grpc/grpc-js");
const { __mf } = require("i18n");
const { logger } = require("../../../config/logger");
const { In } = require("typeorm");
const {
    transType,
    userRoleConstant,
    socketData,
    betResultStatus,
    redisKeys,
    cardGameType,
    transactionType,
    betType,
} = require("../../../config/contants");
const { addNewBet, getMultipleAccountCardMatchProfitLoss, getMatchBetPlaceWithUserCard, getAllCardMatchTotalProfitLoss, getBetsProfitLoss } = require("../../../services/betPlacedService");
const {
    insertBulkTransactions,
    parseRedisData,
    calculateProfitLossForCardMatchToResult,
} = require("../../../services/commonService");

const { getUserRedisData, deleteKeyFromUserRedis, incrementValuesRedis, deleteHashKeysByPattern } = require("../../../services/redis/commonfunction");
const {
    getUserBalanceDataByUserId,
    updateUserBalanceData,
} = require("../../../services/userBalanceService");
const {
    getParentsWithBalance,
    getUserDataWithUserBalanceDeclare,
} = require("../../../services/userService");
const { sendMessageToUser, broadcastEvent } = require("../../../sockets/socketManager");
const { CardWinOrLose } = require("../../../services/cardService/cardWinAccordingToBet");
const { CardResultTypeWin } = require("../../../services/cardService/winCardAccordingToTransaction");
const { childIdquery } = require("../../../services/commonService");
const { getQueryColumns } = require("../../../services/commonService");
const { getTotalProfitLossCard } = require("../../../services/betPlacedService");



exports.declareCardMatchResult = async (call) => {
    try {
        let { result, matchDetails, type } = call.request;
        result = JSON.parse(result);
        matchDetails = JSON.parse(matchDetails);
        // await updatePlaceBet({ result: betResultStatus.PENDING, runnerId: Not(result?.mid), eventType: matchDetails?.type }, { result: betResultStatus.TIE });
        const betPlaced = await getMatchBetPlaceWithUserCard({ runnerId: result?.mid, result: betResultStatus.PENDING, });

        if (betPlaced?.length <= 0) {
            return { data: JSON.stringify({ fwProfitLoss: 0, faAdminCal: { userData: {} }, superAdminData: {} }) }
        }

        logger.info({
            message: "Card match result declared.",
            data: {
                result,
            },
        });

        let updateRecords = [];
        const userData = new Set();
        for (let item of betPlaced) {
            if (result.result == "noresult") {
                item.result = betResultStatus.TIE;
                item.lossAmount = item.lossAmount;
                item.winAmount = item.winAmount;
                updateRecords.push(item);
                userData.add(item?.user?.id);
            }
            else {
                const calculatedBetPlaceData = new CardWinOrLose(type, item?.teamName, result, item?.betType, item).getCardGameProfitLoss()
                item.result = calculatedBetPlaceData.result;
                item.lossAmount = calculatedBetPlaceData.lossAmount;
                item.winAmount = calculatedBetPlaceData.winAmount;
                updateRecords.push(item);
                userData.add(item?.user?.id);
            }

        }

        await addNewBet(updateRecords);


        let users = await getUserDataWithUserBalanceDeclare({ id: In([...userData]) });

        let upperUserObj = {};
        let bulkWalletRecord = [];

        const profitLossData = await calculateProfitLossCardMatchForUserDeclare(
            users,
            matchDetails?.id,
            0,
            socketData.cardResult,
            bulkWalletRecord,
            upperUserObj,
            result,
            matchDetails
        );

        insertBulkTransactions(bulkWalletRecord);
        logger.info({
            message: "Upper user for this bet.",
            data: { upperUserObj },
        });

        for (let [key, value] of Object.entries(upperUserObj)) {
            let parentUser = await getUserBalanceDataByUserId(key);

            let parentUserRedisData = await getUserRedisData(parentUser.userId);

            let parentProfitLoss = parentUser?.profitLoss || 0;
            if (parentUserRedisData?.profitLoss) {
                parentProfitLoss = parseFloat(parentUserRedisData.profitLoss);
            }
            let parentMyProfitLoss = parentUser?.myProfitLoss || 0;
            if (parentUserRedisData?.myProfitLoss) {
                parentMyProfitLoss = parseFloat(parentUserRedisData.myProfitLoss);
            }
            let parentExposure = parentUser?.exposure || 0;
            if (parentUserRedisData?.exposure) {
                parentExposure = parseFloat(parentUserRedisData?.exposure);
            }

            parentUser.profitLoss = parentProfitLoss + value?.["profitLoss"];
            parentUser.myProfitLoss = parentMyProfitLoss - value["myProfitLoss"];
            parentUser.exposure = parentExposure - value["exposure"];
            if (parentUser.exposure < 0) {
                logger.info({
                    message: "Exposure in negative for user: ",
                    data: {
                        matchId: matchDetails?.id,
                        parentUser,
                    },
                });
                value["exposure"] += parentUser.exposure;
                parentUser.exposure = 0;
            }


            await updateUserBalanceData(key, {
                balance: 0,
                profitLoss: value?.["profitLoss"],
                myProfitLoss: -value["myProfitLoss"],
                exposure: -value["exposure"],
            });

            logger.info({
                message: "Declare result db update for parent ",
                data: {
                    parentUser,
                },
            });
            if (parentUserRedisData?.exposure) {
                await incrementValuesRedis(key, {
                    profitLoss: value?.["profitLoss"],
                    myProfitLoss: -value["myProfitLoss"],
                    exposure: -value["exposure"],
                });
                await deleteHashKeysByPattern(key, result?.mid + "*");
                await deleteKeyFromUserRedis(key, `${redisKeys.userMatchExposure}${result?.mid}`);

            }

            sendMessageToUser(key, socketData.matchResult, {
                ...parentUser,
                matchId: matchDetails?.id,
                betType: type
            });
        }
        // insertBulkCommissions(commissionReport);
        broadcastEvent(socketData.declaredMatchResultAllUser, { matchId: matchDetails?.id, gameType: type });
        return { data: JSON.stringify(profitLossData) }

    } catch (error) {
        logger.error({
            error: `Error at declare card match result for the user.`,
            stack: error.stack,
            message: error.message,
        });
        // Handle any errors and return an error response
        throw {
            code: grpc.status.INTERNAL,
            message: err?.message || __mf("internalServerError"),
        };
    }

};

const calculateProfitLossCardMatchForUserDeclare = async (users, matchId, fwProfitLoss, redisEventName, bulkWalletRecord, upperUserObj, result, matchData) => {

    let faAdminCal = {
        userData: {}
    };
    let superAdminData = {};

    for (let user of users) {
        user = { user: user };
        let getWinAmount = 0;
        let getLossAmount = 0;
        let profitLoss = 0;
        let userRedisData = await getUserRedisData(user.user.id);
        let getMultipleAmount = await getMultipleAccountCardMatchProfitLoss(result?.mid, user.user.id);

        Object.keys(getMultipleAmount)?.forEach((item) => {
            getMultipleAmount[item] = parseRedisData(item, getMultipleAmount);
        });

        let maxLoss = 0;
        logger.info({ message: "Updated users", data: user.user });

        // check if data is already present in the redis or not
        if (userRedisData?.[`${redisKeys.userMatchExposure}${result?.mid}`]) {
            maxLoss = (Math.abs(parseFloat(userRedisData?.[`${redisKeys.userMatchExposure}${result?.mid}`]))) || 0;
        }
        else {
            let resultData;
            if ([cardGameType.lucky7, cardGameType.lucky7eu].includes(matchData?.type) && result?.result != "noresult") {
                const { desc } = result;
                const resultSplit = desc?.split("||")?.map((item) => (item.replace(/\s+/g, '')?.toLowerCase()));
                resultData = resultSplit?.[0]?.replace(/\s+/g, '')?.toLowerCase() == "tie" ? 7 : 0;
            }
            // if data is not available in the redis then get data from redis and find max loss amount for all placed bet by user
            let redisData = await calculateProfitLossForCardMatchToResult(user.user?.id, result?.mid, matchData?.type, null, null, resultData);
            maxLoss = redisData?.exposure;
        }

        user.user.userBalance.exposure = user.user.userBalance.exposure - maxLoss;

        logger.info({
            message: "Update user exposure.",
            data: user.user.userBalance.exposure
        });

        getWinAmount = getMultipleAmount.winAmount;
        getLossAmount = getMultipleAmount.lossAmount;

        profitLoss = parseFloat(getWinAmount.toString()) - parseFloat(getLossAmount.toString());

        fwProfitLoss = parseFloat(fwProfitLoss.toString()) + parseFloat(((-profitLoss * user.user.fwPartnership) / 100).toString());

        let userOriginalProfitLoss = profitLoss;

        const userCurrBalance = Number(user.user.userBalance.currentBalance + profitLoss).toFixed(2);
        let userBalanceData = {
            currentBalance: userCurrBalance,
            profitLoss: user.user.userBalance.profitLoss + profitLoss,
            myProfitLoss: user.user.userBalance.myProfitLoss + profitLoss,
            exposure: user.user.userBalance.exposure
        }

        await updateUserBalanceData(user.user.id, {
            profitLoss: profitLoss,
            myProfitLoss: profitLoss,
            exposure: -maxLoss,
        });

        if (userRedisData?.exposure) {

            await incrementValuesRedis(user.user.id, {
                profitLoss: profitLoss,
                myProfitLoss: profitLoss,
                exposure: -maxLoss,
                currentBalance: profitLoss
            });
        }

        sendMessageToUser(user.user.id, redisEventName, { ...user.user, matchId, userBalanceData });

        let currBal = user.user.userBalance.currentBalance;

        const transactions = [
            {
                winAmount: parseFloat(getMultipleAmount.winAmount),
                lossAmount: parseFloat(getMultipleAmount.lossAmount),
                type: "MATCH ODDS"
            }
        ];

        transactions.forEach((item, uniqueId) => {
            currBal = currBal + item.winAmount - item.lossAmount;

            bulkWalletRecord.push({
                type: transactionType.casino,
                matchId: matchId,
                actionBy: user.user.id,
                searchId: user.user.id,
                userId: user.user.id,
                amount: item.winAmount - item.lossAmount,
                transType: item.winAmount - item.lossAmount > 0 ? transType.win : transType.loss,
                closingBalance: currBal,
                description: `${matchData?.type}/${matchData?.name} Rno. ${result?.mid}/${matchData?.type} - ${new CardResultTypeWin(matchData?.type, result).getCardGameProfitLoss()} `,
                createdAt: new Date(),
                uniqueId: uniqueId,
            });
        });

        await deleteHashKeysByPattern(user.user.id, result?.mid + "*");
        await deleteKeyFromUserRedis(user.user.id, `${redisKeys.userMatchExposure}${result?.mid}`);

        if (user.user.createBy === user.user.id && !user.user.isDemo) {
            superAdminData[user.user.id] = {
                role: user.user.roleName,
                profitLoss: profitLoss,
                myProfitLoss: profitLoss,
                exposure: maxLoss,
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

                if (upperUserObj[patentUser.id]) {
                    upperUserObj[patentUser.id].profitLoss = upperUserObj[patentUser.id].profitLoss + profitLoss;
                    upperUserObj[patentUser.id].myProfitLoss = upperUserObj[patentUser.id].myProfitLoss + myProfitLoss;
                    upperUserObj[patentUser.id].exposure = upperUserObj[patentUser.id].exposure + maxLoss;

                } else {
                    upperUserObj[patentUser.id] = { profitLoss: profitLoss, myProfitLoss: myProfitLoss, exposure: maxLoss };
                }

                if (patentUser.createBy === patentUser.id) {
                    superAdminData[patentUser.id] = {
                        ...upperUserObj[patentUser.id],
                        role: patentUser.roleName,
                    };
                }
            }

            faAdminCal.userData[user.user.superParentId] = {
                profitLoss: profitLoss + (faAdminCal.userData?.[user.user.superParentId]?.profitLoss || 0),
                exposure: maxLoss + (faAdminCal.userData?.[user.user.superParentId]?.exposure || 0),
                myProfitLoss: parseFloat((((faAdminCal.userData?.[user.user.superParentId]?.profitLoss || 0)) + ((profitLoss) * (user.user.superParentType == userRoleConstant.fairGameAdmin ? parseFloat(user.user.fwPartnership) : 1) / 100)).toFixed(2)),
                userOriginalProfitLoss: userOriginalProfitLoss + (faAdminCal.userData?.[user.user.superParentId]?.userOriginalProfitLoss || 0),
                role: user.user.superParentType
            }

            faAdminCal.fwWalletDeduction = 0;
        }
    };
    return { fwProfitLoss, faAdminCal, superAdminData };
}


exports.totalProfitLossCardsWallet = async (call) => {
    try {
        let { user, startDate, endDate, searchId, partnerShipRoleName } = call.request;
        user = JSON.parse(user);
        let totalLoss;
        let queryColumns = ``;
        let where = {}

        if (!user) {
            throw {
                code: grpc.status.INVALID_ARGUMENT,
                message: __mf("invalidData"),
            }
        }
        queryColumns = await getQueryColumns(user, partnerShipRoleName);
        totalLoss = `(Sum(CASE WHEN placeBet.result = 'LOSS' then ROUND(placeBet.lossAmount / 100 * ${queryColumns}, 2) ELSE 0 END) - Sum(CASE WHEN placeBet.result = 'WIN' then ROUND(placeBet.winAmount / 100 * ${queryColumns}, 2) ELSE 0 END)) as "totalLoss"`;

        if (user.roleName == userRoleConstant.user) {
            totalLoss = '-' + totalLoss;
        }
        let subQuery = await childIdquery(user, searchId)
        const result = await getTotalProfitLossCard(where, startDate, endDate, totalLoss, subQuery);
        return { data: JSON.stringify(result) };
    } catch (error) {
        logger.error({
            context: `error in get total profit loss cards.`,
            error: error.message,
            stake: error.stack,
        });
        throw {
            code: grpc.status.INTERNAL,
            message: error?.message || __mf("internalServerError"),
        };
    }
}

exports.totalProfitLossByRoundCards = async (call) => {
    try {
        let { user, matchId, startDate, endDate, searchId } = call.request;
        user = JSON.parse(user);

        let queryColumns = ``;
        let where = {
            matchId: matchId
        }

        if (!user) {
            throw {
                code: grpc.status.INVALID_ARGUMENT,
                message: __mf("invalidData"),
            }
        }
        queryColumns = await getQueryColumns(user);
        let rateProfitLoss = `(Sum(CASE WHEN placeBet.result = '${betResultStatus.LOSS}' and (placeBet.betType = '${betType.BACK}' or placeBet.betType = '${betType.LAY}') then ROUND(placeBet.lossAmount / 100 * ${queryColumns}, 2) ELSE 0 END) - Sum(CASE WHEN placeBet.result = '${betResultStatus.WIN}' and (placeBet.betType = '${betType.BACK}' or placeBet.betType = '${betType.LAY}') then ROUND(placeBet.winAmount / 100 * ${queryColumns}, 2) ELSE 0 END)) as "rateProfitLoss"`;

        if (user.roleName == userRoleConstant.user) {
            rateProfitLoss = '-' + rateProfitLoss;
        }
        let subQuery = await childIdquery(user, searchId);

        const data = await getAllCardMatchTotalProfitLoss(where, startDate, endDate, [rateProfitLoss], subQuery);
        const result = data.result;

        return { data: JSON.stringify(result) };
    } catch (error) {
        logger.error({
            context: `error in get total domain wise profit loss`,
            error: error.message,
            stake: error.stack,
        });
        throw {
            code: grpc.status.INTERNAL,
            message: error?.message || __mf("internalServerError"),
        };
    }
}

exports.getCardResultBetProfitLoss = async (call) => {
    try {
        let { user, runnerId, searchId, partnerShipRoleName } = call.request;
        user = JSON.parse(user);
        let where = {};
        let queryColumns = ``;

        if (runnerId) {
            where.runnerId = runnerId;
        }

        if (!user) {
            throw {
                code: grpc.status.INVALID_ARGUMENT,
                message: __mf("invalidData"),
            }
        }
        queryColumns = await getQueryColumns(user, partnerShipRoleName);
        let totalLoss = `(Sum(CASE WHEN placeBet.result = '${betResultStatus.LOSS}' then ROUND(placeBet.lossAmount / 100 * ${queryColumns}, 2) ELSE 0 END) - Sum(CASE WHEN placeBet.result = '${betResultStatus.WIN}' then ROUND(placeBet.winAmount / 100 * ${queryColumns}, 2) ELSE 0 END)) as "totalLoss"`;

        if (user?.roleName == userRoleConstant.user) {
            totalLoss = '-' + totalLoss;
        }
        let subQuery = await childIdquery(user, searchId);
        const domainUrl = `${call?.call?.host}`;

        const result = await getBetsProfitLoss(where, totalLoss, subQuery, domainUrl);
        return { data: JSON.stringify(result) };
    } catch (error) {
        logger.error({
            context: `Error in get card bet profit loss.`,
            error: error.message,
            stake: error.stack,
        });

        throw {
            code: grpc.status.INTERNAL,
            message: error?.message || __mf("internalServerError"),
        };
    }
}