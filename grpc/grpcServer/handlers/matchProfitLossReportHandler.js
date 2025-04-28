const { __mf } = require("i18n");
const grpc = require("@grpc/grpc-js");
const { userRoleConstant, betResultStatus, marketBetType } = require("../../../config/contants");
const { logger } = require("../../../config/logger");
const { getTotalProfitLoss, getAllMatchTotalProfitLoss, getUserWiseProfitLoss, getSessionsProfitLoss } = require("../../../services/betPlacedService");
const { profitLossPercentCol } = require("../../../services/commonService");
const { getAllUsers, getUsersByWallet, getChildsWithOnlyUserRole } = require("../../../services/userService");
const { Not, In } = require("typeorm");

exports.totalProfitLossWallet = async (call) => {
    try {
        let { user, startDate, endDate, matchId, searchId } = call.request;
        user = JSON.parse(user);

        if (!user) {
            throw {
                code: grpc.status.INVALID_ARGUMENT,
                message: __mf("invalidData"),
            }
        }
        const result = (await getTotalProfitLoss(user.id, searchId || null, startDate, endDate || null, user.roleName, null, matchId));

        return { data: JSON.stringify(result) }

    } catch (error) {
        logger.error({
            context: `error in get total profit loss`,
            error: error.message,
            stake: error.stack,
        });
        throw {
            code: grpc.status.INTERNAL,
            message: error?.message || __mf("internalServerError"),
        };
    }
}

exports.totalProfitLossByMatch = async (call) => {
    try {
        let { user, type, startDate, endDate, searchId } = call.request;
        user = JSON.parse(user);


        if (!user) {
            throw {
                code: grpc.status.INVALID_ARGUMENT,
                message: __mf("invalidData"),
            }
        }

        const data = (await getAllMatchTotalProfitLoss(user.id, searchId || null, startDate, endDate || null, user.roleName, type))?.[0]?.getMatchWiseProfitLoss || { count: 0, result: [] };

        return { data: JSON.stringify(data?.result) }
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
                code: grpc.status.INVALID_ARGUMENT,
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
            code: grpc.status.INTERNAL,
            message: error?.message || __mf("internalServerError"),
        };
    }
}

exports.getSessionBetProfitLoss = async (call) => {
    try {
        let { user, matchId, searchId, partnerShipRoleName } = call.request;
        user = JSON.parse(user);
        const role=partnerShipRoleName || user.roleName;

        if (!user) {
            throw {
                code: grpc.status.INVALID_ARGUMENT,
                message: __mf("invalidArgument"),
            };
        }
        const result = await getSessionsProfitLoss(user.id,matchId, searchId || null, role || null);

        return { data: JSON.stringify(result) };
    } catch (error) {
        logger.error({
            context: `Error in get session profit loss.`,
            error: error.message,
            stake: error.stack,
        });
        throw {
            code: grpc.status.INTERNAL,
            message: error?.message || __mf("internalServerError"),
        };
    }
}