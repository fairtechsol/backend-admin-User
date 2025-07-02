const { IsNull } = require("typeorm");

const { logger } = require("../config/logger");
const { getTotalProfitLoss, getAllMatchTotalProfitLoss, getBetsProfitLoss, getSessionsProfitLoss, getUserWiseProfitLoss, getBetCountData } = require("../services/betPlacedService");

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
    partnerShipRoleName = partnerShipRoleName || req.user?.roleName;


    if (!user) {
      return ErrorResponse(
        { statusCode: 400, message: { msg: "invalidData" } },
        req,
        res
      );
    }

    const userData = await getUserWiseProfitLoss(user?.id, matchId || null, runnerId || null, userIds || null, searchId || null, partnerShipRoleName || null, req.user?.roleName || null);


    return SuccessResponse(
      {
        statusCode: 200, data: userData
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
