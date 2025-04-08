const { IsNull, In, Not } = require("typeorm");
const {
  userRoleConstant,
  betResultStatus,
  marketBetType,
  matchOddName,
} = require("../config/contants");
const { logger } = require("../config/logger");
const {     getTotalProfitLoss, getAllMatchTotalProfitLoss, getBetsProfitLoss, getSessionsProfitLoss, getBetsWithMatchId,  getUserWiseProfitLoss, getTotalProfitLossRacing, getAllRacinMatchTotalProfitLoss, getBetCountData } = require("../services/betPlacedService");
const {
  profitLossPercentCol,
  childIdquery,
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
    let totalLoss;
    let queryColumns = ``;
    let where = {}


    if (matchId) {
      where.matchId = matchId
    }

    if (!user) {
      return ErrorResponse(
        { statusCode: 400, message: { msg: "invalidData" } },
        req,
        res
      );
    }
    queryColumns = await getQueryColumns(user, partnerShipRoleName);
    totalLoss = `(Sum(CASE WHEN placeBet.result = 'LOSS' then ROUND(placeBet.lossAmount / 100 * ${queryColumns}, 2) ELSE 0 END) - Sum(CASE WHEN placeBet.result = 'WIN' then ROUND(placeBet.winAmount / 100 * ${queryColumns}, 2) ELSE 0 END)) as "totalLoss"`;

    if (user.roleName == userRoleConstant.user) {
      totalLoss = '-' + totalLoss;
    }
    totalLoss = `SUM(CASE WHEN placeBet.result = 'WIN' AND placeBet.bettingName = '${matchOddName}' THEN ROUND(placeBet.winAmount / 100, 2) ELSE 0 END) as "totalDeduction", ` + totalLoss;
    let subQuery = await childIdquery(user, searchId);
    const result = await getTotalProfitLoss(where, startDate, endDate, totalLoss, subQuery);
    const racingReport = await getTotalProfitLossRacing(where, startDate, endDate, totalLoss, subQuery);
    return SuccessResponse(
      {
        statusCode: 200, data: [...result, ...racingReport]
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
    let { user, type, startDate, endDate, searchId, partnerShipRoleName, page, limit, isRacing } = req.body;
    user = user || req.user;
    partnerShipRoleName = partnerShipRoleName || req.user?.roleName;

    let queryColumns = ``;
    let where = {
      eventType: type
    }

    if (!user) {
      return ErrorResponse(
        { statusCode: 400, message: { msg: "invalidData" } },
        req,
        res
      );
    }
    queryColumns = await getQueryColumns(user, partnerShipRoleName);
    let rateProfitLoss = `(Sum(CASE WHEN placeBet.result = '${betResultStatus.LOSS}' and (placeBet.marketBetType = '${marketBetType.MATCHBETTING}' or placeBet.marketBetType = '${marketBetType.RACING}') then ROUND(placeBet.lossAmount / 100 * ${queryColumns}, 2) ELSE 0 END) - Sum(CASE WHEN placeBet.result = '${betResultStatus.WIN}' and (placeBet.marketBetType = '${marketBetType.MATCHBETTING}' or placeBet.marketBetType = '${marketBetType.RACING}') then ROUND(placeBet.winAmount / 100 * ${queryColumns}, 2) ELSE 0 END)) as "rateProfitLoss"`;
    let sessionProfitLoss = `(Sum(CASE WHEN placeBet.result = '${betResultStatus.LOSS}' and (placeBet.marketBetType = '${marketBetType.SESSION}') then ROUND(placeBet.lossAmount / 100 * ${queryColumns}, 2) ELSE 0 END) - Sum(CASE WHEN placeBet.result = '${betResultStatus.WIN}' and (placeBet.marketBetType = '${marketBetType.SESSION}' ) then ROUND(placeBet.winAmount / 100 * ${queryColumns}, 2) ELSE 0 END)) as "sessionProfitLoss"`;

    if (req?.user?.roleName == userRoleConstant.user) {
      rateProfitLoss = '-' + rateProfitLoss;
      sessionProfitLoss = '-' + sessionProfitLoss;
    }
    let totalDeduction = `SUM(CASE WHEN placeBet.result = 'WIN' AND placeBet.bettingName = '${matchOddName}' THEN ROUND(placeBet.winAmount / 100, 2) ELSE 0 END) as "totalDeduction"`;
    let subQuery = await childIdquery(user, searchId);
    let result, count;
    if (isRacing) {
      const data = await getAllRacinMatchTotalProfitLoss(where, startDate, endDate, [sessionProfitLoss, rateProfitLoss, totalDeduction], page, limit, subQuery);
      result = data.result;
      count = data.count;
    }
    else {
      const data = await getAllMatchTotalProfitLoss(where, startDate, endDate, [sessionProfitLoss, rateProfitLoss, totalDeduction], page, limit, subQuery);
      result = data.result;
      count = data.count;
    }

    return SuccessResponse(
      {
        statusCode: 200, data: { result, count }
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

    let queryColumns = ``;
    let where = { marketBetType: isSession ? marketBetType.SESSION : In([marketBetType.MATCHBETTING, marketBetType.RACING]) };

    if (matchId) {
      where.matchId = matchId;
    }
    if (betId) {
      where.betId = betId;
    }

    if (!user) {
      return ErrorResponse(
        { statusCode: 400, message: { msg: "invalidData" } },
        req,
        res
      );
    }
    queryColumns = await getQueryColumns(user, partnerShipRoleName);
    let totalLoss = `(Sum(CASE WHEN placeBet.result = '${betResultStatus.LOSS}' then ROUND(placeBet.lossAmount / 100 * ${queryColumns}, 2) ELSE 0 END) - Sum(CASE WHEN placeBet.result = '${betResultStatus.WIN}' then ROUND(placeBet.winAmount / 100 * ${queryColumns}, 2) ELSE 0 END)) as "totalLoss"`;

    if (req?.user?.roleName == userRoleConstant.user) {
      totalLoss = '-' + totalLoss;
    }
    let subQuery = await childIdquery(user, searchId);
    const domainUrl = `${req.protocol}://${req.get('host')}`;

    const result = await getBetsProfitLoss(where, totalLoss, subQuery, domainUrl);
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

    let queryColumns = ``;
    let where = { marketBetType: marketBetType.SESSION, matchId: matchId };


    if (!user) {
      return ErrorResponse(
        { statusCode: 400, message: { msg: "invalidData" } },
        req,
        res
      );
    }
    queryColumns = await getQueryColumns(user, partnerShipRoleName);
    let totalLoss = `(Sum(CASE WHEN placeBet.result = '${betResultStatus.LOSS}' then ROUND(placeBet.lossAmount / 100 * ${queryColumns}, 2) ELSE 0 END) - Sum(CASE WHEN placeBet.result = '${betResultStatus.WIN}' then ROUND(placeBet.winAmount / 100 * ${queryColumns}, 2) ELSE 0 END)) as "totalLoss"`;

    if (req?.user?.roleName == userRoleConstant.user) {
      totalLoss = '-' + totalLoss;
    }
    let subQuery = await childIdquery(user, searchId);
    const result = await getSessionsProfitLoss(where, totalLoss, subQuery);
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
const getQueryColumns = async (user, partnerShipRoleName) => {
  return partnerShipRoleName ? await profitLossPercentCol({ roleName: partnerShipRoleName }) : await profitLossPercentCol(user);
}

exports.getQueryColumns=getQueryColumns;

exports.getUserWiseTotalProfitLoss = async (req, res) => {
  try {
    let { user, matchId, searchId, userIds, partnerShipRoleName, runnerId } = req.body;
    user = user || req.user;

    let queryColumns = ``;
    let where = {};

    if (matchId) {
      where.matchId = matchId;
    }
    if(runnerId){
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
