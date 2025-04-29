const { In, Not } = require("typeorm");
const { casinoMicroServiceDomain, userRoleConstant } = require("../config/contants");
const { childIdquery, profitLossPercentCol } = require("../services/commonService");
const { getAllUsers, getUsersByWallet, getChildsWithOnlyUserRole } = require("../services/userService");
const { getTotalProfitLossLiveCasino, getAllLiveCasinoMatchTotalProfitLoss, getLiveCasinoBetsProfitLoss, getUserWiseProfitLossLiveCasino } = require("../services/virtualCasinoBetPlacedsService");
const { apiCall, apiMethod, allApiRoutes } = require("../utils/apiService");
const { SuccessResponse, ErrorResponse } = require("../utils/response");
const { getBetsCondition } = require("./betPlacedController");
const { getQueryColumns } = require("../services/commonService");
const { logger } = require("../config/logger");
const { getCardResultHandler, getCardResultDetailHandler } = require("../grpc/grpcClient/handlers/wallet/matchHandler");

exports.getCardResultByFGWallet = async (req, res) => {
  try {
    const { type } = req.params;
    const query = req.query;
    let result = await getCardResultHandler({ query: JSON.stringify({ type: type, ...query }) });
    return SuccessResponse(
      {
        statusCode: 200,
        data: result,
      },
      req,
      res
    );
  }
  catch (error) {
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

exports.getCardResultDetailByFGWallet = async (req, res) => {
  try {
    const { id } = req.params;

    let result = await getCardResultDetailHandler({ id: id })
    if (!result?.data) {
      result = await apiCall(apiMethod.get, casinoMicroServiceDomain + allApiRoutes.MICROSERVICE.cardResultDetail + id, null, null, null);
      result = {
        data: {
          result: result?.data?.[0]
        }
      }
    }

    let betPlaced = await getBetsCondition(req.user, { "betPlaced.runnerId": id, "sort": "betPlaced.createdAt:ASC" });
    if (betPlaced[1]) {
      result.data.bets = {
        count: betPlaced[1],
        rows: betPlaced[0]
      };
    }
    return SuccessResponse(
      {
        statusCode: 200,
        data: result?.data,
      },
      req,
      res
    );
  }
  catch (error) {
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

exports.totalProfitLossLiveCasinoWallet = async (req, res) => {
  try {
    let { user, startDate, endDate, searchId, partnerShipRoleName } = req.body;
    user = user || req.user;
    partnerShipRoleName = partnerShipRoleName || req.user?.roleName;
    let totalLoss;
    let queryColumns = ``;
    let where = {}

    if (!user) {
      return ErrorResponse(
        { statusCode: 400, message: { msg: "invalidData" } },
        req,
        res
      );
    }
    queryColumns = await getQueryColumns(user, partnerShipRoleName);
    totalLoss = `(Sum(placeBet.amount / 100 * ${queryColumns})) as "totalLoss"`;

    if (user.roleName == userRoleConstant.user) {
      totalLoss = '-' + totalLoss;
    }
    let subQuery = await childIdquery(user, searchId);
    const result = await getTotalProfitLossLiveCasino(where, startDate, endDate, totalLoss, subQuery);
    return SuccessResponse(
      {
        statusCode: 200, data: result
      },
      req,
      res
    );
  } catch (error) {
    logger.error({
      context: `error in get total profit loss live casino`,
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

exports.totalProfitLossByProviderNameLiveCasino = async (req, res) => {
  try {
    let { user, providerName, startDate, endDate, searchId, partnerShipRoleName } = req.body;
    user = user || req.user;
    partnerShipRoleName = partnerShipRoleName || req.user?.roleName;

    let queryColumns = ``;
    let where = {
      providerName: providerName
    }

    if (!user) {
      return ErrorResponse(
        { statusCode: 400, message: { msg: "invalidData" } },
        req,
        res
      );
    }
    queryColumns = await getQueryColumns(user, partnerShipRoleName);
    let rateProfitLoss = `(Sum( placeBet.amount / 100 * ${queryColumns}))  as "rateProfitLoss"`;

    if (req?.user?.roleName == userRoleConstant.user) {
      rateProfitLoss = '-' + rateProfitLoss;
    }
    let subQuery = await childIdquery(user, searchId);

    const data = await getAllLiveCasinoMatchTotalProfitLoss(where, startDate, endDate, [rateProfitLoss], subQuery);
    const result = data.result;

    return SuccessResponse(
      {
        statusCode: 200, data: { result }
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

exports.getLiveCasinoResultBetProfitLoss = async (req, res) => {
  try {
    let { user, gameId, searchId, partnerShipRoleName } = req.body;
    user = user || req.user;
    partnerShipRoleName = partnerShipRoleName || req.user?.roleName;
    let where = {};
    let queryColumns = ``;

    if (gameId) {
      where.gameId = gameId;
    }

    if (!user) {
      return ErrorResponse(
        { statusCode: 400, message: { msg: "invalidData" } },
        req,
        res
      );
    }
    queryColumns = await getQueryColumns(user, partnerShipRoleName);
    let totalLoss = `(Sum(placeBet.amount / 100 * ${queryColumns})) as "totalLoss"`;

    if (req?.user?.roleName == userRoleConstant.user) {
      totalLoss = '-' + totalLoss;
    }
    let subQuery = await childIdquery(user, searchId);
    const domainUrl = `${process.env.GRPC_URL}`;

    const result = await getLiveCasinoBetsProfitLoss(where, totalLoss, subQuery, domainUrl);
    return SuccessResponse(
      {
        statusCode: 200, data: result
      },
      req,
      res
    );
  } catch (error) {
    logger.error({
      context: `Error in get card bet profit loss.`,
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

exports.getLiveCasinoUserWiseTotalProfitLoss = async (req, res) => {
  try {
    let { user, searchId, userIds, partnerShipRoleName, gameId } = req.body;
    user = user || req.user;

    let queryColumns = ``;
    let where = {};

    if (gameId) {
      where.gameId = gameId;
    }

    if (!user) {
      return ErrorResponse(
        { statusCode: 400, message: { msg: "invalidData" } },
        req,
        res
      );
    }
    queryColumns = await profitLossPercentCol(partnerShipRoleName ? { roleName: partnerShipRoleName } : user, queryColumns);
    let totalLoss = `(Sum( placeBet.amount / 100 * ${queryColumns} ) ) as "totalLoss"`;
    let rateProfitLoss = `-(Sum( placeBet.amount / 100 * ${queryColumns})) as "rateProfitLoss"`;

    if (req?.user?.roleName == userRoleConstant.user) {
      rateProfitLoss = "-" + rateProfitLoss;
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
      where.userId = In(childrenId);

      const userData = await getUserWiseProfitLossLiveCasino(where, [totalLoss, rateProfitLoss]);
      if (userData.totalLoss != null && userData.totalLoss != undefined) {
        result.push({ ...userData, userId: directUser.id, roleName: directUser.roleName, userName: directUser.userName });
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