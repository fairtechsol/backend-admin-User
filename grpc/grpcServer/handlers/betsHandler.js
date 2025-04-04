const grpc = require("@grpc/grpc-js");
const { __mf } = require("i18n");
const { logger } = require("../../../config/logger");
const { userRoleConstant, partnershipPrefixByRole, betResultStatus, marketBetType } = require("../../../config/contants");
const { getBet, updatePlaceBet, getUserSessionsProfitLoss, getBetsProfitLoss } = require("../../../services/betPlacedService");
const { getChildsWithOnlyUserRole, getAllUsers } = require("../../../services/userService");
const { profitLossPercentCol, childIdquery } = require("../../../services/commonService");
const { In } = require("typeorm");
const { getQueryColumns } = require("../../../controllers/fairgameWalletController");

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

exports.getSessionBetProfitLossExpert = async (call) => {
  try {
    let { betId } = call?.request;

    let queryColumns = ``;
    let where = { betId: betId };

    queryColumns = await profitLossPercentCol({ roleName: userRoleConstant.fairGameWallet }, queryColumns);
    let sessionProfitLoss = `(Sum(CASE WHEN placeBet.result = '${betResultStatus.LOSS}' and (placeBet.marketBetType = '${marketBetType.SESSION}') then ROUND(placeBet.lossAmount / 100 * ${queryColumns}, 2) ELSE 0 END) - Sum(CASE WHEN placeBet.result = '${betResultStatus.WIN}' and (placeBet.marketBetType = '${marketBetType.SESSION}') then ROUND(placeBet.winAmount / 100 * ${queryColumns}, 2) ELSE 0 END)) as "sessionProfitLoss", COUNT(placeBet.id) as "totalBet"`;

    const userData = await getUserSessionsProfitLoss(where, [sessionProfitLoss, 'user.userName as "userName"', 'user.id as "userId"']);

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

exports.getResultBetProfitLoss = async (call) => {
  try {
    let { user, matchId, betId, isSession, searchId, partnerShipRoleName } = call.request;
    user = user;
    partnerShipRoleName = partnerShipRoleName;

    let queryColumns = ``;
    let where = { marketBetType: isSession ? marketBetType.SESSION : In([marketBetType.MATCHBETTING, marketBetType.RACING]) };

    if (matchId) {
      where.matchId = matchId;
    }
    if (betId) {
      where.betId = betId;
    }

    if (!user) {
      throw {
        code: grpc.status.INVALID_ARGUMENT,
        message: __mf("invalidData"),
      };
    }
    queryColumns = await getQueryColumns(user, partnerShipRoleName);
    let totalLoss = `(Sum(CASE WHEN placeBet.result = '${betResultStatus.LOSS}' then ROUND(placeBet.lossAmount / 100 * ${queryColumns}, 2) ELSE 0 END) - Sum(CASE WHEN placeBet.result = '${betResultStatus.WIN}' then ROUND(placeBet.winAmount / 100 * ${queryColumns}, 2) ELSE 0 END)) as "totalLoss"`;

    let subQuery = await childIdquery(user, searchId);
    const domainUrl = `${call?.call?.host}`;

    const result = await getBetsProfitLoss(where, totalLoss, subQuery, domainUrl);
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