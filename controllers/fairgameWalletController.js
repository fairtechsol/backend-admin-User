const { IsNull, In, Not } = require("typeorm");
const {
  userRoleConstant,
  betResultStatus,
  marketBetType,
} = require("../config/contants");
const { logger } = require("../config/logger");
const { getTotalProfitLoss, getAllMatchTotalProfitLoss, getBetsProfitLoss, getSessionsProfitLoss, getUserWiseProfitLoss, getBetCountData } = require("../services/betPlacedService");
const {
  profitLossPercentCol,
} = require("../services/commonService");

const {
  getChildsWithOnlyUserRole,
  getAllUsers,
  getUsersByWallet,
} = require("../services/userService");
const { ErrorResponse, SuccessResponse } = require("../utils/response");

exports.totalProfitLossWallet = async (req, res) => {
  try {
    let { user, startDate, endDate, matchId, searchId, partnerShipRoleName } = req.body;
    user = user || req.user;
    partnerShipRoleName = partnerShipRoleName || req.user?.roleName;

    if (!user) {
      return ErrorResponse(
        { statusCode: 400, message: { msg: "invalidData" } },
        req,
        res
      );
    }

    const result = await getTotalProfitLoss(user.id, searchId, startDate, endDate, partnerShipRoleName, null, matchId);

    return SuccessResponse(
      {
        statusCode: 200, data: result
      },
      req,
      res
    );
  } catch (error) {
    logger.error({
      context: `error in get total profit loss`,
      error: error.message,
      stake: error.stack,
    });
    return ErrorResponse(
      {
        statusCode: 500,
        message: error.message,
      },
      req,
      res
    );
  }
}

exports.totalProfitLossByMatch = async (req, res) => {
  try {
    let { user, type, startDate, endDate, searchId, partnerShipRoleName, page, limit } = req.body;
    user = user || req.user;
    partnerShipRoleName = partnerShipRoleName || req.user?.roleName;

    if (!user) {
      return ErrorResponse(
        { statusCode: 400, message: { msg: "invalidData" } },
        req,
        res
      );
    }

    const data = (await getAllMatchTotalProfitLoss(user.id, searchId, startDate, endDate, partnerShipRoleName, type, (parseInt(page) - 1) * parseInt(limit), limit))?.[0]?.getMatchWiseProfitLoss || { count: 0, result: [] };

    return SuccessResponse(
      {
        statusCode: 200, data: data
      },
      req,
      res
    );
  } catch (error) {
    logger.error({
      context: `error in get total domain wise profit loss`,
      error: error.message,
      stake: error.stack,
    });
    return ErrorResponse(
      {
        statusCode: 500,
        message: error.message,
      },
      req,
      res
    );
  }
}

exports.getResultBetProfitLoss = async (req, res) => {
  try {
    let { user, matchId, betId, isSession, searchId, partnerShipRoleName } = req.body;
    user = user || req.user;
    partnerShipRoleName = partnerShipRoleName || req.user?.roleName;


    if (!user) {
      return ErrorResponse(
        { statusCode: 400, message: { msg: "invalidData" } },
        req,
        res
      );
    }

    const domainUrl = `${process.env.GRPC_URL}`;

    const result = await getBetsProfitLoss(user.id, matchId || null, betId || null, searchId || null, partnerShipRoleName, domainUrl, isSession);
    return SuccessResponse(
      {
        statusCode: 200, data: result
      },
      req,
      res
    );
  } catch (error) {
    logger.error({
      context: `Error in get bet profit loss.`,
      error: error.message,
      stake: error.stack,
    });
    return ErrorResponse(
      {
        statusCode: 500,
        message: error.message,
      },
      req,
      res
    );
  }
}

exports.getSessionBetProfitLoss = async (req, res) => {
  try {
    let { user, matchId, searchId, partnerShipRoleName } = req.body;
    user = user || req.user;
    partnerShipRoleName = partnerShipRoleName || req.user?.roleName;

    if (!user) {
      return ErrorResponse(
        { statusCode: 400, message: { msg: "invalidData" } },
        req,
        res
      );
    }

    const result = await getSessionsProfitLoss(user.id, matchId, searchId || null, partnerShipRoleName || null);
    return SuccessResponse(
      {
        statusCode: 200, data: result
      },
      req,
      res
    );
  } catch (error) {
    logger.error({
      context: `Error in get session profit loss.`,
      error: error.message,
      stake: error.stack,
    });
    return ErrorResponse(
      {
        statusCode: 500,
        message: error.message,
      },
      req,
      res
    );
  }
}

exports.getUserWiseTotalProfitLoss = async (req, res) => {
  try {
    let { user, matchId, searchId, userIds, partnerShipRoleName, runnerId } = req.body;
    user = user || req.user;

    let queryColumns = ``;
    let where = {};

    if (matchId) {
      where.matchId = matchId;
    }
    if (runnerId) {
      where.runnerId = runnerId;
    }

    if (!user) {
      return ErrorResponse(
        { statusCode: 400, message: { msg: "invalidData" } },
        req,
        res
      );
    }
    queryColumns = await profitLossPercentCol(partnerShipRoleName ? { roleName: partnerShipRoleName } : user, queryColumns);
    let totalLoss = `(-Sum(CASE WHEN placeBet.result = '${betResultStatus.LOSS}' then ROUND(placeBet.lossAmount / 100 * ${queryColumns}, 2) ELSE 0 END) + Sum(CASE WHEN placeBet.result = '${betResultStatus.WIN}' then ROUND(placeBet.winAmount / 100 * ${queryColumns}, 2) ELSE 0 END)) as "totalLoss"`;
    let rateProfitLoss = `(Sum(CASE WHEN placeBet.result = '${betResultStatus.LOSS}' and (placeBet.marketBetType = '${marketBetType.MATCHBETTING}' or placeBet.marketBetType = '${marketBetType.RACING}') then ROUND(placeBet.lossAmount / 100 * ${queryColumns}, 2) ELSE 0 END) - Sum(CASE WHEN placeBet.result = '${betResultStatus.WIN}' and (placeBet.marketBetType = '${marketBetType.MATCHBETTING}' or placeBet.marketBetType = '${marketBetType.RACING}') then ROUND(placeBet.winAmount / 100 * ${queryColumns}, 2) ELSE 0 END)) as "rateProfitLoss"`;
    let sessionProfitLoss = `(Sum(CASE WHEN placeBet.result = '${betResultStatus.LOSS}' and (placeBet.marketBetType = '${marketBetType.SESSION}') then ROUND(placeBet.lossAmount / 100 * ${queryColumns}, 2) ELSE 0 END) - Sum(CASE WHEN placeBet.result = '${betResultStatus.WIN}' and (placeBet.marketBetType = '${marketBetType.SESSION}') then ROUND(placeBet.winAmount / 100 * ${queryColumns}, 2) ELSE 0 END)) as "sessionProfitLoss"`;

    if (req?.user?.roleName == userRoleConstant.user) {
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

    return SuccessResponse(
      {
        statusCode: 200, data: result
      },
      req,
      res
    );
  } catch (error) {
    logger.error({
      context: `Error in get bet profit loss.`,
      error: error.message,
      stake: error.stack,
    });
    return ErrorResponse(
      {
        statusCode: 500,
        message: error.message,
      },
      req,
      res
    );
  }
}



exports.checkVerifiedBets = async (req, res) => {
  try {
    let { betId } = req.body;
    const betCount = await getBetCountData({ betId: betId, isVerified: false, deleteReason: IsNull() })
    return SuccessResponse({ statusCode: 200, message: { msg: "bet.isVerified" }, data: betCount }, req, res);

  } catch (error) {
    logger.error({
      error: `Error at get verify bet.`,
      stack: error.stack,
      message: error.message,
    });
    return ErrorResponse(error, req, res)
  }
}
