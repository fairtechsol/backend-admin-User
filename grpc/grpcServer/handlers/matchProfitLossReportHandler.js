const { __mf } = require("i18n");
const grpcReq = require("../../../../fairgameWalletBackend/grpc/grpcClient");
const { matchOddName, userRoleConstant, betResultStatus, marketBetType } = require("../../../config/contants");
const { logger } = require("../../../config/logger");
const { getQueryColumns } = require("../../../controllers/fairgameWalletController");
const { getTotalProfitLoss, getTotalProfitLossRacing, getAllRacinMatchTotalProfitLoss, getAllMatchTotalProfitLoss, getUserWiseProfitLoss, getSessionsProfitLoss } = require("../../../services/betPlacedService");
const { childIdquery, profitLossPercentCol } = require("../../../services/commonService");
const { getAllUsers, getUsersByWallet, getChildsWithOnlyUserRole } = require("../../../services/userService");
const { Not, In } = require("typeorm");

exports.totalProfitLossWallet = async (call) => {
    try {
        let { user, startDate, endDate, matchId, searchId } = call.request;
        user = JSON.parse(user);
        let totalLoss;
        let queryColumns = ``;
        let where = {}

        if (matchId) {
            where.matchId = matchId
        }

        if (!user) {
            throw {
                code: grpcReq.status.INVALID_ARGUMENT,
                message: __mf("invalidData"),
            }
        }
        queryColumns = await getQueryColumns(user);
        totalLoss = `(Sum(CASE WHEN placeBet.result = 'LOSS' then ROUND(placeBet.lossAmount / 100 * ${queryColumns}, 2) ELSE 0 END) - Sum(CASE WHEN placeBet.result = 'WIN' then ROUND(placeBet.winAmount / 100 * ${queryColumns}, 2) ELSE 0 END)) as "totalLoss"`;

        if (user.roleName == userRoleConstant.user) {
            totalLoss = '-' + totalLoss;
        }
        totalLoss = `SUM(CASE WHEN placeBet.result = 'WIN' AND placeBet.bettingName = '${matchOddName}' THEN ROUND(placeBet.winAmount / 100, 2) ELSE 0 END) as "totalDeduction", ` + totalLoss;
        let subQuery = await childIdquery(user, searchId);
        const result = await getTotalProfitLoss(where, startDate, endDate, totalLoss, subQuery);
        const racingReport = await getTotalProfitLossRacing(where, startDate, endDate, totalLoss, subQuery);
        return { data: JSON.stringify([...result, ...racingReport]) }

    } catch (error) {
        logger.error({
            context: `error in get total profit loss`,
            error: error.message,
            stake: error.stack,
        });
        throw {
            code: grpcReq.status.INTERNAL,
            message: error?.message || __mf("internalServerError"),
        };
    }
}

exports.totalProfitLossByMatch = async (call) => {
    try {
        let { user, type, startDate, endDate, searchId, isRacing } = call.request;
        user = JSON.parse(user);

        let queryColumns = ``;
        let where = {
            eventType: type
        }

        if (!user) {
            throw {
                code: grpcReq.status.INVALID_ARGUMENT,
                message: __mf("invalidData"),
            }
        }
        queryColumns = await getQueryColumns(user);
        let rateProfitLoss = `(Sum(CASE WHEN placeBet.result = '${betResultStatus.LOSS}' and (placeBet.marketBetType = '${marketBetType.MATCHBETTING}' or placeBet.marketBetType = '${marketBetType.RACING}') then ROUND(placeBet.lossAmount / 100 * ${queryColumns}, 2) ELSE 0 END) - Sum(CASE WHEN placeBet.result = '${betResultStatus.WIN}' and (placeBet.marketBetType = '${marketBetType.MATCHBETTING}' or placeBet.marketBetType = '${marketBetType.RACING}') then ROUND(placeBet.winAmount / 100 * ${queryColumns}, 2) ELSE 0 END)) as "rateProfitLoss"`;
        let sessionProfitLoss = `(Sum(CASE WHEN placeBet.result = '${betResultStatus.LOSS}' and (placeBet.marketBetType = '${marketBetType.SESSION}') then ROUND(placeBet.lossAmount / 100 * ${queryColumns}, 2) ELSE 0 END) - Sum(CASE WHEN placeBet.result = '${betResultStatus.WIN}' and (placeBet.marketBetType = '${marketBetType.SESSION}' ) then ROUND(placeBet.winAmount / 100 * ${queryColumns}, 2) ELSE 0 END)) as "sessionProfitLoss"`;

        if (user?.roleName == userRoleConstant.user) {
            rateProfitLoss = '-' + rateProfitLoss;
            sessionProfitLoss = '-' + sessionProfitLoss;
        }
        let totalDeduction = `SUM(CASE WHEN placeBet.result = 'WIN' AND placeBet.bettingName = '${matchOddName}' THEN ROUND(placeBet.winAmount / 100, 2) ELSE 0 END) as "totalDeduction"`;
        let subQuery = await childIdquery(user, searchId);
        let result;
        if (isRacing) {
            const data = await getAllRacinMatchTotalProfitLoss(where, startDate, endDate, [sessionProfitLoss, rateProfitLoss, totalDeduction], null, null, subQuery);
            result = data.result;
        }
        else {
            const data = await getAllMatchTotalProfitLoss(where, startDate, endDate, [sessionProfitLoss, rateProfitLoss, totalDeduction], null, null, subQuery);
            result = data.result;
        }

        return { date: JSON.stringify(result) }
    } catch (error) {
        logger.error({
            context: `error in get total domain wise profit loss`,
            error: error.message,
            stake: error.stack,
        });
        throw {
            code: grpcReq.status.INTERNAL,
            message: error?.message || __mf("internalServerError"),
        };
    }
}

exports.getUserWiseTotalProfitLoss = async (call) => {
    try {
        let { user, matchId, searchId, userIds, partnerShipRoleName, runnerId } = call.request;
        user = JSON.parse(user);

        let queryColumns = ``;
        let where = {};

        if (matchId) {
            where.matchId = matchId;
        }
        if (runnerId) {
            where.runnerId = runnerId;
        }

        if (!user) {
            throw {
                code: grpcReq.status.INVALID_ARGUMENT,
                message: __mf("invalidData"),
            };
        }
        queryColumns = await profitLossPercentCol(partnerShipRoleName ? { roleName: partnerShipRoleName } : user, queryColumns);
        let totalLoss = `(-Sum(CASE WHEN placeBet.result = '${betResultStatus.LOSS}' then ROUND(placeBet.lossAmount / 100 * ${queryColumns}, 2) ELSE 0 END) + Sum(CASE WHEN placeBet.result = '${betResultStatus.WIN}' then ROUND(placeBet.winAmount / 100 * ${queryColumns}, 2) ELSE 0 END)) as "totalLoss"`;
        let rateProfitLoss = `(Sum(CASE WHEN placeBet.result = '${betResultStatus.LOSS}' and (placeBet.marketBetType = '${marketBetType.MATCHBETTING}' or placeBet.marketBetType = '${marketBetType.RACING}') then ROUND(placeBet.lossAmount / 100 * ${queryColumns}, 2) ELSE 0 END) - Sum(CASE WHEN placeBet.result = '${betResultStatus.WIN}' and (placeBet.marketBetType = '${marketBetType.MATCHBETTING}' or placeBet.marketBetType = '${marketBetType.RACING}') then ROUND(placeBet.winAmount / 100 * ${queryColumns}, 2) ELSE 0 END)) as "rateProfitLoss"`;
        let sessionProfitLoss = `(Sum(CASE WHEN placeBet.result = '${betResultStatus.LOSS}' and (placeBet.marketBetType = '${marketBetType.SESSION}') then ROUND(placeBet.lossAmount / 100 * ${queryColumns}, 2) ELSE 0 END) - Sum(CASE WHEN placeBet.result = '${betResultStatus.WIN}' and (placeBet.marketBetType = '${marketBetType.SESSION}') then ROUND(placeBet.winAmount / 100 * ${queryColumns}, 2) ELSE 0 END)) as "sessionProfitLoss"`;

        if (user?.roleName == userRoleConstant.user) {
            rateProfitLoss = "-" + rateProfitLoss;
            sessionProfitLoss = "-" + sessionProfitLoss;
        }

        const getAllDirectUsers = searchId ?
            await getAllUsers({
                id: searchId,
            })
            : userIds ?
                await getAllUsers({
                    id: In(userIds?.split(",")),
                })
                : (user.roleName == userRoleConstant.fairGameWallet || user.roleName == userRoleConstant.fairGameAdmin) ?
                    await getUsersByWallet({
                        superParentId: user.id,
                        isDemo: false
                    })
                    :
                    await getAllUsers({
                        createBy: user.id,
                        id: Not(user.id)
                    });
        let result = [];
        for (let directUser of getAllDirectUsers) {
            let childrenId = await getChildsWithOnlyUserRole(directUser.id);

            childrenId = childrenId.map(item => item.id);
            if (!childrenId.length) {
                continue;
            }
            where.createBy = In(childrenId);

            const userData = await getUserWiseProfitLoss(where, [totalLoss, rateProfitLoss, sessionProfitLoss]);
            if (userData.totalLoss != null && userData.totalLoss != undefined) {
                result.push({ ...userData, userId: directUser.id, roleName: directUser.roleName, matchId: matchId, userName: directUser.userName });
            }
        }

        return { data: JSON.stringify(result) };
    } catch (error) {
        logger.error({
            context: `Error in get bet profit loss.`,
            error: error.message,
            stake: error.stack,
        });
        throw {
            code: grpcReq.status.INTERNAL,
            message: error?.message || __mf("internalServerError"),
        };
    }
}

exports.getSessionBetProfitLoss = async (call) => {
    try {
        let { user, matchId, searchId, partnerShipRoleName } = call.request;
        user = JSON.parse(user);

        let queryColumns = ``;
        let where = { marketBetType: marketBetType.SESSION, matchId: matchId };


        if (!user) {
            throw {
                code: grpcReq.status.INVALID_ARGUMENT,
                message: __mf("invalidArgument"),
            };
        }
        queryColumns = await getQueryColumns(user, partnerShipRoleName);
        let totalLoss = `(Sum(CASE WHEN placeBet.result = '${betResultStatus.LOSS}' then ROUND(placeBet.lossAmount / 100 * ${queryColumns}, 2) ELSE 0 END) - Sum(CASE WHEN placeBet.result = '${betResultStatus.WIN}' then ROUND(placeBet.winAmount / 100 * ${queryColumns}, 2) ELSE 0 END)) as "totalLoss"`;

        if (user?.roleName == userRoleConstant.user) {
            totalLoss = '-' + totalLoss;
        }
        let subQuery = await childIdquery(user, searchId);
        const result = await getSessionsProfitLoss(where, totalLoss, subQuery);

        return { data: JSON.stringify(result) };
    } catch (error) {
        logger.error({
            context: `Error in get session profit loss.`,
            error: error.message,
            stake: error.stack,
        });
        throw {
            code: grpcReq.status.INTERNAL,
            message: error?.message || __mf("internalServerError"),
        };
    }
}