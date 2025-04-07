const { IsNull, In, ILike, Not } = require("typeorm");
const {
  userRoleConstant,
  socketData,
  betResultStatus,
  partnershipPrefixByRole,
  marketBetType,
  matchOddName,
} = require("../config/contants");
const { logger } = require("../config/logger");
const {    updatePlaceBet, getTotalProfitLoss, getAllMatchTotalProfitLoss, getBetsProfitLoss, getSessionsProfitLoss, getBetsWithMatchId, findAllPlacedBet, getUserWiseProfitLoss, getTotalProfitLossRacing, getAllRacinMatchTotalProfitLoss, getBetCountData } = require("../services/betPlacedService");
const {
  forceLogoutUser,
  profitLossPercentCol,
  getUserProfitLossForUpperLevel,
  forceLogoutIfLogin,
  childIdquery,
  findUserPartnerShipObj,
} = require("../services/commonService");

const { getUserRedisData } = require("../services/redis/commonfunction");
const {
  getAllUsersBalanceSum,
} = require("../services/userBalanceService");
const {
  getUserById,
  updateUser,
  userBlockUnblock,
  betBlockUnblock,
  getChildsWithOnlyUserRole,
  getChildUserBalanceSum,
  getAllUsersBalanceSumByFgId,
  getAllUsers,
  updateUserExposureLimit,
  getChildUserBalanceAndData,
  getMultipleUsersWithUserBalances,
  getUserDataWithUserBalance,
  softDeleteAllUsers,
  deleteUserByDirectParent,
  getUsersByWallet,
  getChildsWithOnlyMultiUserRole,
} = require("../services/userService");
const { sendMessageToUser } = require("../sockets/socketManager");
const { ErrorResponse, SuccessResponse } = require("../utils/response");

const { getVirtualCasinoExposureSum } = require("../services/virtualCasinoBetPlacedsService");


exports.setExposureLimitByFGAdmin = async (req, res, next) => {
  try {
    let { exposureLimit, id, roleName } = req.body;

    exposureLimit = parseInt(exposureLimit);
    let childUsers = await getAllUsers(roleName == userRoleConstant.fairGameAdmin ? { superParentId: id } : {}, ["id", "exposureLimit"]);

    const childUsersId = childUsers.map((childObj) => {
      return childObj.id;

    });


    await updateUserExposureLimit(exposureLimit, childUsersId);


    return SuccessResponse(
      {
        statusCode: 200,
        message: { msg: "user.ExposurelimitSet" },
      },
      req,
      res
    );
  } catch (error) {
    console.log(error);
    logger.error({
      error: `Error in exposure limit.`,
      stack: error.stack,
      message: error.message,
    });
    return ErrorResponse(error, req, res);
  }
};

exports.lockUnlockSuperAdmin = async (req, res, next) => {
  try {
    // Extract relevant data from the request body and user object
    const { userId, betBlock, userBlock, loginId } = req.body;

    // Fetch details of the user who is performing the block/unblock operation,
    // including the hierarchy and block information
    const blockingUserDetail = await getUserById(userId, [
      "createBy",
      "userBlock",
      "betBlock",
      "userBlockedBy",
      "betBlockedBy"
    ]);

    if (!blockingUserDetail) {
      return ErrorResponse(
        {
          statusCode: 400,
          message: {
            msg: "notFound",
            keys: { name: "User" },
          },
        },
        req,
        res
      );
    }

    if (blockingUserDetail?.userBlock && loginId != blockingUserDetail?.userBlockedBy && !userBlock) {
      return ErrorResponse(
        {
          statusCode: 400,
          message: {
            msg: "user.blockedBySomeOneElse",
            keys: { name: "user" }
          },
        },
        req,
        res
      );
    }
    if (blockingUserDetail?.betBlock && loginId != blockingUserDetail?.betBlockedBy && !betBlock) {
      return ErrorResponse(
        {
          statusCode: 400,
          message: {
            msg: "user.blockedBySomeOneElse",
            keys: { name: "user's bet" }
          },
        },
        req,
        res
      );
    }

    // Check if the user is already blocked or unblocked (prevent redundant operations)
    if (blockingUserDetail?.userBlock != userBlock && userBlock != null) {
      // Perform the user block/unblock operation
      const blockedUsers = await userBlockUnblock(userId, loginId, userBlock);
      //   if blocktype is user and its block then user would be logout by socket
      if (userBlock) {
        blockedUsers?.[0]?.forEach(async (item) => {
          await forceLogoutUser(item?.id);
        });
      }
    }

    // Check if the user is already bet-blocked or unblocked (prevent redundant operations)
    if (blockingUserDetail?.betBlock != betBlock && betBlock != null) {
      // Perform the bet block/unblock operation

      const blockedBets = await betBlockUnblock(userId, loginId, betBlock);

      blockedBets?.[0]?.filter((item) => item?.roleName == userRoleConstant.user)?.forEach((item) => {
        sendMessageToUser(item?.id, socketData.betBlockEvent, {
          betBlock: betBlock,
        });
      });
    }

    // Return success response
    return SuccessResponse(
      { statusCode: 200, message: { msg: "user.lock/unlockSuccessfully" } },
      req,
      res
    );
  } catch (error) {
    return ErrorResponse(
      {
        statusCode: 500,
        message: error.message,
      },
      req,
      res
    );
  }
};

// API endpoint for changing password
exports.changePasswordSuperAdmin = async (req, res, next) => {
  try {
    // Destructure request body
    const { userId, password } = req.body;

    const userDetail = await getUserById(userId, ["id"]);

    if (!userDetail) {
      return ErrorResponse(
        {
          statusCode: 400,
          message: {
            msg: "notFound",
            keys: { name: "User" },
          },
        },
        req,
        res
      );
    }

    // Update loginAt, password, and reset transactionPassword
    await updateUser(userId, {
      loginAt: null,
      password,
      transPassword: null,
    });

    // deleting token for logout
    await forceLogoutUser(userId);
    return SuccessResponse(
      {
        statusCode: 200,
        message: { msg: "auth.passwordChanged" },
      },
      req,
      res
    );
  } catch (error) {
    // Log any errors that occur
    return ErrorResponse(
      {
        statusCode: 500,
        message: error.message,
      },
      req,
      res
    );
  }
};

exports.getVirtualBetExposures = async (req, res) => {
  try {
    let { roleName, userId } = req.query;
    let bets = [];
      if (roleName == userRoleConstant.user) {
        bets = await getVirtualCasinoExposureSum({ userId: userId, settled: false });
      }
      else {
        const users = await getChildsWithOnlyMultiUserRole((await getAllUsers(roleName == userRoleConstant.fairGameAdmin ? { superParentId: userId } : {})).map((item) => item.id));
        bets = await getVirtualCasinoExposureSum({ userId: In(users.map((item) => item.id)), settled: false, });
      }
    
    let result = {
      exposure: Math.abs(bets?.count?.totalAmount || 0),
      match: bets?.list?.reduce((prev,curr) => {
        prev[curr.gameName] = { ...curr, totalAmount: Math.abs(curr.totalAmount) };
        return prev;
      },{})
    }
    return SuccessResponse({
      statusCode: 200, message: { msg: "fetched", keys: { type: "Bet" } }, data: result
    }, req, res)
  } catch (err) {
    logger.error({
      error: "Error in get bet for wallet",
      stack: err.stack,
      message: err.message,
    })
    return ErrorResponse(err, req, res);

  }

};

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

exports.getBetCount = async (req, res) => {
  try {
    const parentId = req.query.parentId;
    const matchId = req.query.matchId;
    const result = await getBetsWithMatchId((parentId ? ` AND user.superParentId = '${parentId}'` : ""), (matchId ? { matchId: matchId } : {}));
    return SuccessResponse(
      {
        statusCode: 200, data: result
      },
      req,
      res
    );
  } catch (error) {
    logger.error({
      context: `Error in get bet count.`,
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

exports.getAllUserBalance = async (req, res) => {
  try {

    const { roleName } = req.query;
    const { id } = req.params;
    let balanceSum = {};
    if (roleName == userRoleConstant.fairGameWallet) {
      const demoUserId = await getAllUsers({ isDemo: true }, ["id"]);
      let childUsersBalances = await getAllUsersBalanceSum({ userId: Not(In(demoUserId?.map((item) => item?.id))) });
      balanceSum[id] = parseFloat(parseFloat(childUsersBalances?.balance).toFixed(2));
    }
    else if (roleName == userRoleConstant.fairGameAdmin) {
      let childUsersBalances = await getAllUsersBalanceSumByFgId(id);
      balanceSum[id] = parseFloat(parseFloat(childUsersBalances?.balance).toFixed(2));
    }
    else {
      balanceSum = {};
      for (let item of id?.split(",")) {
        let childUsersBalances = await getChildUserBalanceSum(item);
        balanceSum[item] = parseFloat(parseFloat(childUsersBalances?.[0]?.balance).toFixed(2));
      };
    }

    return SuccessResponse(
      {
        statusCode: 200, data: { balance: balanceSum }
      },
      req,
      res
    );
  } catch (error) {
    logger.error({
      context: `Error in get all user balance.`,
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

exports.getUsersProfitLoss = async (req, res) => {
  try {
    const { userIds } = req.query;
    const { matchId } = req.params;

    const resUserData = [];
    let markets = {};

    for (let userData of userIds?.split("|")) {
      userData = JSON.parse(userData);
      let userProfitLossData = {};


      let betsData = await getUserProfitLossForUpperLevel(userData, matchId);
      // userProfitLossData = {
      //   teamRateA: betsData?.[redisKeys.userTeamARate + matchId] ? -parseFloat(betsData?.[redisKeys.userTeamARate + matchId]).toFixed(2) : 0, teamRateB: betsData?.[redisKeys.userTeamBRate + matchId] ? -parseFloat(betsData?.[redisKeys.userTeamBRate + matchId]).toFixed(2) : 0, teamRateC: betsData?.[redisKeys.userTeamCRate + matchId] ? -parseFloat(betsData?.[redisKeys.userTeamCRate + matchId]).toFixed(2) : 0,
      //   percentTeamRateA: betsData?.[redisKeys.userTeamARate + matchId] ? parseFloat(parseFloat(parseFloat(betsData?.[redisKeys.userTeamARate + matchId]).toFixed(2)) * parseFloat(userData.partnerShip) / 100).toFixed(2) : 0, percentTeamRateB: betsData?.[redisKeys.userTeamBRate + matchId] ? parseFloat(parseFloat(parseFloat(betsData?.[redisKeys.userTeamBRate + matchId]).toFixed(2)) * parseFloat(userData.partnerShip) / 100).toFixed(2) : 0, percentTeamRateC: betsData?.[redisKeys.userTeamCRate + matchId] ? parseFloat(parseFloat(parseFloat(betsData?.[redisKeys.userTeamCRate + matchId]).toFixed(2)) * parseFloat(userData.partnerShip) / 100).toFixed(2) : 0
      // }
      Object.keys(betsData || {}).forEach((item) => {
        markets[item]={ betId: item, name: betsData[item]?.name };
        Object.keys(betsData[item].teams || {})?.forEach((teams) => {
          betsData[item].teams[teams].pl = {
            rate: betsData[item].teams?.[teams]?.pl,
            percent: parseFloat(parseFloat(parseFloat(betsData[item].teams?.[teams]?.pl).toFixed(2)) * parseFloat(userData.partnerShip) / 100).toFixed(2)
          }
        })
      });
      userProfitLossData.userName = userData?.userName;
      userProfitLossData.profitLoss = betsData;

      if (Object.keys(betsData || {}).length > 0) {
        resUserData.push(userProfitLossData);
      }
    }
    return SuccessResponse(
      {
        statusCode: 200, data: { profitLoss: resUserData, markets: Object.values(markets) }
      },
      req,
      res
    );
  } catch (error) {
    logger.error({
      context: `Error in get profit loss user data.`,
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

exports.checkUserBalance = async (req, res) => {
  try {
    const { roleName, id } = req.body;

    if (roleName == userRoleConstant.fairGameAdmin) {
      const childUsers = await getMultipleUsersWithUserBalances({ superParentId: id });
      for (let childData of childUsers) {
        if (parseFloat(childData?.exposure || 0) != 0 || parseFloat(childData?.currentBalance || 0) != 0 || parseFloat(childData?.profitLoss || 0) != 0 || parseFloat(childData.creditRefrence || 0) != 0 || parseFloat(childData?.totalCommission || 0) != 0) {
          return ErrorResponse(
            { statusCode: 400, message: { msg: "settleAccount", keys: { name: childData?.userName } } }, req, res);
        }
        forceLogoutIfLogin(childData.id);
      }
    }
    else {
      const userData = await getUserDataWithUserBalance({ id: id });

      if (!userData) {
        return ErrorResponse({ statusCode: 400, message: { msg: "notFound", keys: { name: "User" } } }, req, res);
      }
      if (parseFloat(userData.userBal?.exposure || 0) != 0 || parseFloat(userData.userBal?.currentBalance || 0) != 0 || parseFloat(userData.userBal?.profitLoss || 0) != 0 || parseFloat(userData.creditRefrence || 0) != 0 || parseFloat(userData.userBal?.totalCommission || 0) != 0) {
        return ErrorResponse({ statusCode: 400, message: { msg: "settleAccount", keys: { name: "your" } } }, req, res);
      }

      const childUsers = await getChildUserBalanceAndData(id);
      for (let childData of childUsers) {
        if (parseFloat(childData?.exposure || 0) != 0 || parseFloat(childData?.currentBalance || 0) != 0 || parseFloat(childData?.profitLoss || 0) != 0 || parseFloat(childData.creditRefrence || 0) != 0 || parseFloat(childData?.totalCommission || 0) != 0) {
          return ErrorResponse({ statusCode: 400, message: { msg: "settleAccount", keys: { name: childData?.userName } } }, req, res);
        }
        forceLogoutIfLogin(childData.id);
      }
    }

    return SuccessResponse({ statusCode: 200 }, req, res);
  }
  catch (error) {
    logger.error({
      context: `error in delete user`,
      error: error.message,
      stake: error.stack,
    });
    return ErrorResponse(error, req, res);
  }
}

exports.deleteWalletUsers = async (req, res) => {
  try {
    const { id } = req.params;
    const { roleName } = req.body;

    if (roleName == userRoleConstant.fairGameAdmin) {
      await deleteUserByDirectParent(id);
    }
    else {
      await softDeleteAllUsers(id);
    }

    return SuccessResponse({ statusCode: 200 }, req, res);
  }
  catch (error) {
    logger.error({
      context: `error in delete user`,
      error: error.message,
      stake: error.stack,
    });
    return ErrorResponse(error, req, res);
  }
}

exports.getAllChildSearchList = async (req, res) => {
  try {
    const { roleName, userName, id, isUser } = req.query;

    let users = [];
    if (roleName == userRoleConstant.fairGameAdmin) {
      users = await getAllUsers({ superParentId: id, userName: ILike(`%${userName}%`), ...(isUser ? { roleName: userRoleConstant.user } : {}) }, ["id", "userName", "betBlock", "userBlock"]);
    }
    else {
      users = await getAllUsers({ userName: ILike(`%${userName}%`), isDemo: false, ...(isUser ? { roleName: userRoleConstant.user } : {}) }, ["id", "userName", "betBlock", "userBlock"]);
    }

    return SuccessResponse({ statusCode: 200, data: users }, req, res);
  }
  catch (error) {
    logger.error({
      context: `error in delete user`,
      error: error.message,
      stake: error.stack,
    });
    return ErrorResponse(error, req, res);
  }
}

exports.changeBetsDeleteReason = async (req, res) => {
  try {
    let { deleteReason, betIds, matchId } = req.body;

    await updatePlaceBet({ id: In(betIds), deleteReason: Not(IsNull()) }, { deleteReason: deleteReason });

    const userIds = await findAllPlacedBet({ id: In(betIds) }, ["createBy","id"]);

    const userWiseBetId = {};
    const walletWiseBetId = {};

    for(let item of userIds){
      if (!userWiseBetId?.[item?.createBy]) {
        let userRedisData = await getUserRedisData(item?.createBy);
        let isUserLogin = userRedisData ? true : false;
        let partnership = {};
        if (isUserLogin) {
          partnership = JSON.parse(userRedisData.partnerShips);
        }
        else {
          const user = await getUserById(item?.createBy, [
            "id",
            "roleName",
            "createBy",
          ]);
          partnership = await findUserPartnerShipObj(user);
          partnership = JSON.parse(partnership);
        }
        const adminIds = Object.values(partnershipPrefixByRole)?.filter((items) => !!partnership[`${items}PartnershipId`] && items != partnershipPrefixByRole[userRoleConstant.fairGameAdmin] && items != partnershipPrefixByRole[userRoleConstant.fairGameWallet])?.map((items) => partnership[`${items}PartnershipId`]);
        const superAdminIds = Object.keys(partnership)?.filter((items) => [`${partnershipPrefixByRole[userRoleConstant.fairGameAdmin]}PartnershipId`,`${partnershipPrefixByRole[userRoleConstant.fairGameWallet]}PartnershipId`].includes(items) )?.map((items) => partnership[items]);
        userWiseBetId[item?.createBy] = {
          bets: [],
          parent: adminIds,
          superParent: superAdminIds
        };
      }
      userWiseBetId?.[item?.createBy]?.bets?.push(item?.id);
      for (let parentItem of userWiseBetId?.[item?.createBy]?.parent) {
        if (!userWiseBetId?.[parentItem]) {
          userWiseBetId[parentItem] = { bets: [item?.id] };
        }
        else {
          userWiseBetId?.[parentItem]?.bets?.push(item?.id);

        }
      }
      for (let parentItem of userWiseBetId?.[item?.createBy]?.superParent) {
        if (!walletWiseBetId?.[parentItem]) {
          walletWiseBetId[parentItem] = { bets: [item?.id] };
        }
        else {
          walletWiseBetId?.[parentItem]?.bets?.push(item?.id);
        }
      }
    };

    Object.keys(userWiseBetId)?.forEach((item)=>{
      sendMessageToUser(item, socketData.updateDeleteReason, {
        betIds: userWiseBetId?.[item]?.bets,
        deleteReason: deleteReason,
        matchId: matchId
      });
    });

    return SuccessResponse({ statusCode: 200, message: { msg: "updated", keys: { name: "Delete bet reason" } }, data: walletWiseBetId }, req, res);
  } catch (err) {
    return ErrorResponse(err, req, res);
  }
};

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
