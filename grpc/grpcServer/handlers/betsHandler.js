const grpc = require("@grpc/grpc-js");
const { __mf } = require("i18n");
const { logger } = require("../../../config/logger");
const { userRoleConstant, partnershipPrefixByRole } = require("../../../config/contants");
const { getBet, updatePlaceBet } = require("../../../../betFairBackend/services/betPlacedService");
const { getChildsWithOnlyUserRole, getAllUsers } = require("../../../../betFairBackend/services/userService");

exports.getPlacedBets = async (call) => {
  try {
    let { roleName, userId, ...queryData } = JSON.parse(call.request.query || "{}");
    let result;
    let select = [
      "betPlaced.id", "betPlaced.verifyBy", "betPlaced.isVerified", "betPlaced.eventName", "betPlaced.teamName", "betPlaced.betType", "betPlaced.amount", "betPlaced.rate", "betPlaced.winAmount", "betPlaced.lossAmount", "betPlaced.createdAt", "betPlaced.eventType", "betPlaced.marketType", "betPlaced.odds", "betPlaced.marketBetType", "betPlaced.result", "betPlaced.matchId", "betPlaced.betId", "betPlaced.deleteReason", "betPlaced.bettingName", "match.startAt", "match.teamC", "betPlaced.runnerId", "betPlaced.isCommissionActive"
    ];

    if (roleName == userRoleConstant.user) {
      select.push("user.id", "user.userName");
      result = await getBet({ createBy: userId }, queryData, roleName, select, null, true);
    } else if (roleName && ![userRoleConstant.fairGameAdmin, userRoleConstant.fairGameWallet].includes(roleName)) {
      let childsId = await getChildsWithOnlyUserRole(userId);
      childsId = childsId.map(item => item.id);
      if (!childsId.length) {
        return { data: JSON.stringify({ count: 0, rows: [] }) }
      }
      let partnershipColumn = partnershipPrefixByRole[roleName] + 'Partnership';
      select.push("user.id", "user.userName", `user.${partnershipColumn}`);
      result = await getBet({ createBy: In(childsId) }, queryData, roleName, select, null, true);
    }
    else {
      const demoUsers = await getAllUsers({ isDemo: true });
      select.push("user.id", "user.userName", "user.fwPartnership", "user.faPartnership");
      result = await getBet(`user.id is not null ${demoUsers?.length ? `and betPlaced.createBy not in ('${demoUsers?.map((item) => item?.id).join("','")}')` : ""}`, queryData, roleName, select, userId);
    }

    if (!result[1]) {
      return { data: JSON.stringify({ count: 0, rows: [] }) }

    }
    const domainUrl = `https://${call.call.host}`;
    result[0] = result?.[0]?.map((item) => {
      return {
        ...item,
        domain: domainUrl,
      };
    });

    return { data: JSON.stringify({ count: result[1], rows: result[0] }) }

  } catch (err) {
    logger.error({
      error: "Error in get bet for wallet",
      stack: err.stack,
      message: err.message,
    })
    throw {
      code: grpc.status.INTERNAL,
      message: err?.message || __mf("internalServerError"),
    };
  }

};

exports.verifyBet = async (call) => {
  try {
    let { isVerified, id, verifyBy } = call.request;
    await updatePlaceBet({ id: id }, { isVerified: isVerified, verifyBy: verifyBy })
    return {};
  } catch (error) {
    logger.error({
      error: `Error at verify bet.`,
      stack: error.stack,
      message: error.message,
    });
    throw {
      code: grpc.status.INTERNAL,
      message: err?.message || __mf("internalServerError"),
    };
  }
}