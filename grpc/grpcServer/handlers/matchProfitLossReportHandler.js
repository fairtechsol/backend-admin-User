const { __mf } = require("i18n");
const grpc = require("@grpc/grpc-js");
const { logger } = require("../../../config/logger");
const { getTotalProfitLoss, getAllMatchTotalProfitLoss, getUserWiseProfitLoss, getSessionsProfitLoss } = require("../../../services/betPlacedService");

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
        partnerShipRoleName = partnerShipRoleName || user.roleName;

        if (!user) {
            throw {
                code: grpc.status.INVALID_ARGUMENT,
                message: __mf("invalidData"),
            };
        }

        const userData = await getUserWiseProfitLoss(user?.id, matchId || null, runnerId || null, userIds != '' && userIds?.split(",")?.length ? userIds?.split(",") : null, searchId || null, partnerShipRoleName || null, user.roleName || null);

        return { data: JSON.stringify(userData) };
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
        const role = partnerShipRoleName || user.roleName;

        if (!user) {
            throw {
                code: grpc.status.INVALID_ARGUMENT,
                message: __mf("invalidArgument"),
            };
        }
        const result = await getSessionsProfitLoss(user.id, matchId, searchId || null, role || null);

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