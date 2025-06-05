const { In, IsNull, LessThanOrEqual } = require("typeorm");
const { socketData, betType, userRoleConstant, partnershipPrefixByRole, matchBettingType, redisKeys, marketBetType, gameType, betResultStatus, cardGameType, sessionBettingType, jwtSecret, demoRedisTimeOut, authenticatorType, uplinePartnerShipForAllUsers } = require("../config/contants");
const internalRedis = require("../config/internalRedisConnection");
const { sendMessageToUser } = require("../sockets/socketManager");
const { findAllPlacedBetWithUserIdAndBetId, getUserDistinctBets, getBetsWithUserRole, findAllPlacedBet, getMatchBetPlaceWithUserCard, getBetCountData, deleteBet } = require("./betPlacedService");
const { getUserById, getChildsWithOnlyUserRole, getAllUsers, userBlockUnblock, updateUser, userPasswordAttempts, deleteUser } = require("./userService");
const { logger } = require("../config/logger");
const { __mf } = require("i18n");
const { insertTransactions, deleteTransactions } = require("./transactionService");
const { insertCommissions } = require("./commissionService");
const { CardProfitLoss } = require("./cardService/cardProfitLossCalc");
const { getMatchData, getMatchList } = require("./matchService");
const { updateUserDataRedis, getUserRedisSingleKey } = require("./redis/commonfunction");
const jwt = require("jsonwebtoken");
const { deleteButton } = require("./buttonService");
const { deleteUserBalance } = require("./userBalanceService");
const { getAuthenticator, addAuthenticator } = require("./authService");
const { verifyAuthToken } = require("../utils/generateAuthToken");
const { getVirtualCasinoExposureSum } = require("./virtualCasinoBetPlacedsService");
const { getTournamentBettingHandler } = require("../grpc/grpcClient/handlers/expert/matchHandler");
const { lockUnlockUserByUserPanelHandler, getPartnershipIdHandler } = require("../grpc/grpcClient/handlers/wallet/userHandler");
const { roundToTwoDecimals } = require("../utils/mathUtils");
const { updateAccessUser, accessUserPasswordAttempts } = require("./accessUserService");

exports.forceLogoutIfLogin = async (userId) => {
  let token = await internalRedis.hget(userId, "token");

  if (token) {
    // function to force logout
    sendMessageToUser(userId, socketData.logoutUserForceEvent, { message: __mf("auth.forceLogout") })
  }
};


exports.forceLogoutUser = async (userId, stopForceLogout, isAccessUser = false, mainParentId) => {

  if (!stopForceLogout) {
    await this.forceLogoutIfLogin(userId);
  }
  if (!isAccessUser) {
    const userAccessData = await internalRedis.hget(userId, "accessUser");
    if (!userAccessData || !JSON.parse(userAccessData || "[]").length) {
      await internalRedis.del(userId);
    }
    else {
      await internalRedis.hdel(userId, "token");
    }
  } else {
    await internalRedis.del(userId);
    const mainUserData = await internalRedis.hget(mainParentId, "accessUser");
    await internalRedis.hmset(mainParentId, { accessUser: JSON.stringify(JSON.parse(mainUserData || "[]")?.filter((item) => item != userId)) });
  }

};

exports.calculateRacingRate = async (teamRates, data, partnership = 100) => {
  let { runners, winAmount, lossAmount, bettingType, runnerId } = data;
  let newTeamRates = { ...teamRates };
  runners.forEach((item) => {
    if (!newTeamRates[item?.id]) {
      newTeamRates[item?.id] = 0;
    }

    if ((item?.id == runnerId && bettingType == betType.BACK) || (item?.id != runnerId && bettingType == betType.LAY)) {
      newTeamRates[item?.id] += ((winAmount * partnership) / 100);
    }
    else if ((item?.id != runnerId && bettingType == betType.BACK) || (item?.id == runnerId && bettingType == betType.LAY)) {
      newTeamRates[item?.id] -= ((lossAmount * partnership) / 100);
    }

    newTeamRates[item?.id] = this.parseRedisData(item?.id, newTeamRates);
  });

  return newTeamRates;
}

exports.calculateRacingExpertRate = async (teamRates, data, partnership = 100) => {
  let { runners, winAmount, lossAmount, bettingType, runnerId } = data;
  let newTeamRates = { ...teamRates };

  runners.forEach((item) => {
    if (!newTeamRates[item?.id]) {
      newTeamRates[item?.id] = 0;
    }

    if ((item?.id == runnerId && bettingType == betType.BACK) || (item?.id != runnerId && bettingType == betType.LAY)) {
      newTeamRates[item?.id] -= ((winAmount * partnership) / 100);
    }
    else if ((item?.id != runnerId && bettingType == betType.BACK) || (item?.id == runnerId && bettingType == betType.LAY)) {
      newTeamRates[item?.id] += ((lossAmount * partnership) / 100);
    }

    newTeamRates[item?.id] = this.parseRedisData(item?.id, newTeamRates);
  });
  return newTeamRates;
}


const calculateProfitLoss = (betData, odds, partnership) => {
  if (
    (betData?.betPlacedData?.betType === betType.NO &&
      odds < betData?.betPlacedData?.odds) ||
    (betData?.betPlacedData?.betType === betType.YES &&
      odds >= betData?.betPlacedData?.odds)
  ) {
    return partnership != null || partnership != undefined
      ? -parseFloat(
        (parseFloat(betData?.winAmount) * partnership) / 100
      ).toFixed(2)
      : +parseFloat(parseFloat(betData?.winAmount).toFixed(2));
  } else if (
    (betData?.betPlacedData?.betType === betType.NO &&
      odds >= betData?.betPlacedData?.odds) ||
    (betData?.betPlacedData?.betType === betType.YES &&
      odds < betData?.betPlacedData?.odds)
  ) {
    return partnership != null || partnership != undefined
      ? +parseFloat(
        (parseFloat(betData?.lossAmount) * partnership) / 100
      ).toFixed(2)
      : -parseFloat(betData.lossAmount);
  }
  return 0;
};

const calculateProfitLossDataKhado = (betData, odds, partnership) => {
  if (
    (betData?.betPlacedData?.betType === betType.BACK &&
      ((odds < betData?.betPlacedData?.odds) || (odds > (betData?.betPlacedData?.odds + parseInt(betData?.betPlacedData?.eventName?.split("-").pop()) - 1))))
  ) {
    return partnership != null || partnership != undefined
      ? parseFloat(
        (parseFloat(betData?.lossAmount) * partnership) / 100
      ).toFixed(2)
      : -parseFloat(parseFloat(betData?.lossAmount).toFixed(2));
  }
  return partnership != null || partnership != undefined
    ? -parseFloat(
      (parseFloat(betData?.winAmount) * partnership) / 100
    ).toFixed(2)
    : parseFloat(betData.winAmount);

};

const calculateProfitLossDataMeter = (betData, odds, partnership) => {
  if (
    (betData?.betPlacedData?.betType === betType.NO &&
      odds < betData?.betPlacedData?.odds) ||
    (betData?.betPlacedData?.betType === betType.YES &&
      odds >= betData?.betPlacedData?.odds)
  ) {
    return partnership != null || partnership != undefined
      ? -parseFloat(
        (parseFloat((betData?.betPlacedData?.stake * betData?.betPlacedData?.rate / 100) * Math.abs(odds - betData?.betPlacedData?.odds)) * partnership) / 100
      ).toFixed(2)
      : +parseFloat(parseFloat((betData?.betPlacedData?.stake * betData?.betPlacedData?.rate / 100) * Math.abs(odds - betData?.betPlacedData?.odds)).toFixed(2));
  } else if (
    (betData?.betPlacedData?.betType === betType.NO &&
      odds >= betData?.betPlacedData?.odds) ||
    (betData?.betPlacedData?.betType === betType.YES &&
      odds < betData?.betPlacedData?.odds)
  ) {
    return partnership != null || partnership != undefined
      ? +parseFloat(
        (parseFloat((betData?.betPlacedData?.stake) * Math.abs(odds - betData?.betPlacedData?.odds)) * partnership) / 100
      ).toFixed(2)
      : -parseFloat((betData?.betPlacedData?.stake) * Math.abs(odds - betData?.betPlacedData?.odds));
  }
  return 0;
};

/**
* Calculates the profit or loss for a betting session.
* @param {object} redisProfitLoss - Redis data for profit and loss.
* @param {object} betData - Data for the current bet.
* @returns {object} - Object containing upper and lower limit odds, and the updated bet placed data.
*/
exports.calculateProfitLossSession = async (redisProfitLoss, betData, partnership) => {
  /**
   * Calculates the profit or loss for a specific bet at given odds.
   * @param {object} betData - Data for the current bet.
   * @param {number} odds - Odds for the current bet.
   * @returns {number} - Profit or loss amount.
   */
  let maxLoss = 0;

  /**
   * Gets the lower limit for the current bet data.
   * @param {object} betData - Data for the current bet.
   * @returns {number} - Lower limit for the odds.
   */
  const getLowerLimitBetData = (betData) =>
    Math.max(0, betData?.betPlacedData?.odds - 5);

  // Calculate lower and upper limits
  const lowerLimit = parseFloat(
    getLowerLimitBetData(betData) < (redisProfitLoss?.lowerLimitOdds ?? 0)
      ? getLowerLimitBetData(betData)
      : redisProfitLoss?.lowerLimitOdds ?? getLowerLimitBetData(betData)
  );

  const upperLimit = parseFloat(
    betData?.betPlacedData?.odds + 5 >
      (redisProfitLoss?.upperLimitOdds ?? betData?.betPlacedData?.odds + 5)
      ? betData?.betPlacedData?.odds + 5
      : redisProfitLoss?.upperLimitOdds ?? betData?.betPlacedData?.odds + 5
  );

  let betProfitloss = redisProfitLoss?.betPlaced ?? Array(Math.abs(upperLimit - lowerLimit + 1))
    .fill(0)?.map((_, index) => {
      let pl = 0;
      if (redisProfitLoss?.lowerLimitOdds != null && lowerLimit + index < (redisProfitLoss?.lowerLimitOdds ?? 0)) {
        pl = parseFloat(redisProfitLoss?.betPlaced?.[0]?.profitLoss || 0);
      }
      else if (redisProfitLoss?.upperLimitOdds != null && lowerLimit + index > (redisProfitLoss?.upperLimitOdds ?? 0)) {
        pl = parseFloat(redisProfitLoss?.betPlaced?.[redisProfitLoss?.betPlaced?.length - 1]?.profitLoss || 0)
      }
      return {
        odds: lowerLimit + index,
        profitLoss: pl,
      };
    });

  if (redisProfitLoss?.betPlaced?.length && redisProfitLoss?.lowerLimitOdds > lowerLimit) {
    betProfitloss = [
      ...Array(Math.abs((redisProfitLoss?.lowerLimitOdds ?? 0) - lowerLimit))
        .fill(0)
        ?.map((_, index) => {
          return {
            odds: lowerLimit + index,
            profitLoss: parseFloat(betProfitloss[0]?.profitLoss),
          };
        }),
      ...betProfitloss,
    ];
  }

  // Adjust betPlaced based on upper limit changes
  if (redisProfitLoss?.betPlaced?.length && upperLimit > redisProfitLoss?.upperLimitOdds) {
    betProfitloss = [
      ...betProfitloss,
      ...Array(Math.abs(upperLimit - (redisProfitLoss?.upperLimitOdds ?? 0)))
        .fill(0)
        ?.map((_, index) => {
          return {
            odds: (redisProfitLoss?.upperLimitOdds ?? 0) + index + 1,
            profitLoss: parseFloat(
              betProfitloss[betProfitloss?.length - 1]?.profitLoss
            ),
          };
        }),
    ];
  }

  // Initialize or update betPlaced if it's empty or not
  if (!betProfitloss?.length) {
    betProfitloss = Array(Math.abs(upperLimit - lowerLimit + 1))
      .fill(0)
      ?.map((_, index) => {
        let profitLoss = calculateProfitLoss(betData, lowerLimit + index, partnership);
        if (maxLoss < Math.abs(profitLoss) && profitLoss < 0) {
          maxLoss = Math.abs(profitLoss);
        }
        return {
          odds: lowerLimit + index,
          profitLoss: profitLoss,
        };
      });
  } else {
    betProfitloss = betProfitloss?.map((item) => {
      let profitLossVal = calculateProfitLoss(betData, item?.odds, partnership);
      profitLossVal = +(parseFloat(item?.profitLoss) + parseFloat(profitLossVal)).toFixed(2)
      if (
        maxLoss <
        Math.abs(
          profitLossVal
        ) &&
        profitLossVal < 0
      ) {
        maxLoss = Math.abs(
          profitLossVal
        );
      }
      return {
        odds: item?.odds,
        profitLoss: profitLossVal,
      };
    });
  }
  maxLoss = roundToTwoDecimals(maxLoss);
  // Return the result
  return {
    upperLimitOdds: parseFloat(upperLimit),
    lowerLimitOdds: parseFloat(lowerLimit),
    betPlaced: betProfitloss,
    maxLoss: parseFloat(maxLoss),
    totalBet: redisProfitLoss?.totalBet ? parseInt(redisProfitLoss?.totalBet) + 1 : 1
  };
};

/**
* Calculates the profit or loss for a betting khado.
* @param {object} redisProfitLoss - Redis data for profit and loss.
* @param {object} betData - Data for the current bet.
* @returns {object} - Object containing upper and lower limit odds, and the updated bet placed data.
*/
exports.calculateProfitLossKhado = async (redisProfitLoss, betData, partnership) => {

  let maxLoss = 0;


  // Calculate lower and upper limits
  const lowerLimit = 1;

  const upperLimit = parseFloat(
    betData?.betPlacedData?.odds + parseInt(betData?.betPlacedData?.eventName?.split("-").pop()) + 9 >
      (redisProfitLoss?.upperLimitOdds ?? betData?.betPlacedData?.odds + parseInt(betData?.betPlacedData?.eventName?.split("-").pop()) + 9)
      ? betData?.betPlacedData?.odds + parseInt(betData?.betPlacedData?.eventName?.split("-").pop()) + 9
      : redisProfitLoss?.upperLimitOdds ?? betData?.betPlacedData?.odds + parseInt(betData?.betPlacedData?.eventName?.split("-").pop()) + 9
  );

  let betProfitloss = redisProfitLoss?.betPlaced ?? Array(Math.abs(upperLimit - lowerLimit + 1))
    .fill(0)?.map((_, index) => {
      let pl = 0;
      if (redisProfitLoss?.lowerLimitOdds != null && lowerLimit + index < (redisProfitLoss?.lowerLimitOdds ?? 0)) {
        pl = parseFloat(redisProfitLoss?.betPlaced?.[0]?.profitLoss || 0);
      }
      else if (redisProfitLoss?.upperLimitOdds != null && lowerLimit + index > (redisProfitLoss?.upperLimitOdds ?? 0)) {
        pl = parseFloat(redisProfitLoss?.betPlaced?.[redisProfitLoss?.betPlaced?.length - 1]?.profitLoss || 0)
      }
      return {
        odds: lowerLimit + index,
        profitLoss: pl,
      };
    });

  // Adjust betPlaced based on lower limit changes
  if (redisProfitLoss?.betPlaced?.length && redisProfitLoss?.lowerLimitOdds > lowerLimit) {
    betProfitloss = [
      ...Array(Math.abs((redisProfitLoss?.lowerLimitOdds ?? 0) - lowerLimit))
        .fill(0)
        ?.map((_, index) => {
          return {
            odds: lowerLimit + index,
            profitLoss: parseFloat(betProfitloss[0]?.profitLoss),
          };
        }),
      ...betProfitloss,
    ];
  }

  // Adjust betPlaced based on upper limit changes
  if (redisProfitLoss?.betPlaced?.length && upperLimit > redisProfitLoss?.upperLimitOdds) {
    betProfitloss = [
      ...betProfitloss,
      ...Array(Math.abs(upperLimit - (redisProfitLoss?.upperLimitOdds ?? 0)))
        .fill(0)
        ?.map((_, index) => {
          return {
            odds: (redisProfitLoss?.upperLimitOdds ?? 0) + index + 1,
            profitLoss: parseFloat(
              betProfitloss[betProfitloss?.length - 1]?.profitLoss
            ),
          };
        }),
    ];
  }

  // Initialize or update betPlaced if it's empty or not
  if (!betProfitloss?.length) {
    betProfitloss = Array(Math.abs(upperLimit - lowerLimit + 1))
      .fill(0)
      ?.map((_, index) => {
        let profitLoss = calculateProfitLossDataKhado(betData, lowerLimit + index, partnership);
        if (maxLoss < Math.abs(profitLoss) && profitLoss < 0) {
          maxLoss = Math.abs(profitLoss);
        }
        return {
          odds: lowerLimit + index,
          profitLoss: profitLoss,
        };
      });
  } else {
    betProfitloss = betProfitloss?.map((item) => {
      let profitLossVal = calculateProfitLossDataKhado(betData, item?.odds, partnership);
      profitLossVal = +(parseFloat(item?.profitLoss) + parseFloat(profitLossVal)).toFixed(2)
      if (
        maxLoss <
        Math.abs(
          profitLossVal
        ) &&
        profitLossVal < 0
      ) {
        maxLoss = Math.abs(
          profitLossVal
        );
      }
      return {
        odds: item?.odds,
        profitLoss: profitLossVal,
      };
    });
  }
  maxLoss = roundToTwoDecimals(maxLoss);
  // Return the result
  return {
    upperLimitOdds: parseFloat(upperLimit),
    lowerLimitOdds: parseFloat(lowerLimit),
    betPlaced: betProfitloss,
    maxLoss: parseFloat(maxLoss),
    totalBet: redisProfitLoss?.totalBet ? parseInt(redisProfitLoss?.totalBet) + 1 : 1
  };
};

/**
* Calculates the profit or loss for a betting meter.
* @param {object} redisProfitLoss - Redis data for profit and loss.
* @param {object} betData - Data for the current bet.
* @returns {object} - Object containing upper and lower limit odds, and the updated bet placed data.
*/
exports.calculateProfitLossMeter = async (redisProfitLoss, betData, partnership) => {
  /**
   * Calculates the profit or loss for a specific bet at given odds.
   * @param {object} betData - Data for the current bet.
   * @param {number} odds - Odds for the current bet.
   * @returns {number} - Profit or loss amount.
   */
  let maxLoss = 0;

  // Calculate lower and upper limits
  const lowerLimit = 0;

  const upperLimit = parseFloat(
    betData?.betPlacedData?.odds + (betData?.betPlacedData?.isTeamC ? 200 : 100) >
      (redisProfitLoss?.upperLimitOdds ?? betData?.betPlacedData?.odds + (betData?.betPlacedData?.isTeamC ? 200 : 100))
      ? betData?.betPlacedData?.odds + (betData?.betPlacedData?.isTeamC ? 200 : 100)
      : redisProfitLoss?.upperLimitOdds ?? betData?.betPlacedData?.odds + (betData?.betPlacedData?.isTeamC ? 200 : 100)
  );

  let betProfitloss = redisProfitLoss?.betPlaced ?? Array(Math.abs(upperLimit - lowerLimit + 1))
    .fill(0)?.map((_, index) => {
      let pl = 0;
      if (redisProfitLoss?.lowerLimitOdds != null && lowerLimit + index < (redisProfitLoss?.lowerLimitOdds ?? 0)) {
        pl = parseFloat(redisProfitLoss?.betPlaced?.[0]?.profitLoss || 0);
      }
      else if (redisProfitLoss?.upperLimitOdds != null && lowerLimit + index > (redisProfitLoss?.upperLimitOdds ?? 0)) {
        pl = parseFloat(redisProfitLoss?.betPlaced?.[redisProfitLoss?.betPlaced?.length - 1]?.profitLoss || 0)
      }
      return {
        odds: lowerLimit + index,
        profitLoss: pl,
      };
    });

  // Adjust betPlaced based on upper limit changes
  if (redisProfitLoss?.betPlaced?.length && upperLimit > redisProfitLoss?.upperLimitOdds) {
    betProfitloss = [
      ...betProfitloss,
      ...Array(Math.abs(upperLimit - (redisProfitLoss?.upperLimitOdds ?? 0)))
        .fill(0)
        ?.map((_, index) => {
          return {
            odds: (redisProfitLoss?.upperLimitOdds ?? 0) + index + 1,
            profitLoss: parseFloat(
              (betProfitloss[betProfitloss?.length - 1]?.profitLoss) + ((parseFloat(betProfitloss[betProfitloss?.length - 1]?.profitLoss) - parseFloat(betProfitloss[betProfitloss?.length - 2]?.profitLoss)) * (index + 1))
            ),
          };
        }),
    ];
  }

  // Initialize or update betPlaced if it's empty or not
  if (!betProfitloss?.length) {
    betProfitloss = Array(Math.abs(upperLimit - lowerLimit + 1))
      .fill(0)
      ?.map((_, index) => {
        let profitLoss = calculateProfitLossDataMeter(betData, lowerLimit + index, partnership);
        if (maxLoss < Math.abs(profitLoss) && profitLoss < 0) {
          maxLoss = Math.abs(profitLoss);
        }
        return {
          odds: lowerLimit + index,
          profitLoss: profitLoss,
        };
      });
  } else {
    betProfitloss = betProfitloss?.map((item) => {
      let profitLossVal = calculateProfitLossDataMeter(betData, item?.odds, partnership);
      profitLossVal = +(parseFloat(item?.profitLoss) + parseFloat(profitLossVal)).toFixed(2)
      if (
        maxLoss <
        Math.abs(
          profitLossVal
        ) &&
        profitLossVal < 0
      ) {
        maxLoss = Math.abs(profitLossVal);
      }
      return {
        odds: item?.odds,
        profitLoss: profitLossVal,
      };
    });
  }
  maxLoss = roundToTwoDecimals(maxLoss);
  // Return the result
  return {
    upperLimitOdds: parseFloat(upperLimit),
    lowerLimitOdds: parseFloat(lowerLimit),
    betPlaced: betProfitloss,
    maxLoss: parseFloat(maxLoss),
    totalBet: redisProfitLoss?.totalBet ? parseInt(redisProfitLoss?.totalBet) + 1 : 1
  };
};

/**
* Calculates the profit or loss for a betting session.
* @param {object} redisProfitLoss - Redis data for profit and loss.
* @param {object} betData - Data for the current bet.
* @returns {object} - Object containing upper and lower limit odds, and the updated bet placed data.
*/
exports.calculateProfitLossSessionOddEven = async (redisProfitLoss, betData, partnership = 100) => {
  let maxLoss = 0;

  let betProfitloss = redisProfitLoss?.betPlaced ?? {};

  if (betData?.betPlacedData?.teamName?.toLowerCase() == "odd") {
    betProfitloss.odd = (betProfitloss.odd || 0) + (betData?.winAmount * partnership / 100);
    betProfitloss.even = (betProfitloss.even || 0) - (betData?.lossAmount * partnership / 100);
  }
  else if (betData?.betPlacedData?.teamName?.toLowerCase() == "even") {
    betProfitloss.odd = (betProfitloss.odd || 0) - (betData?.lossAmount * partnership / 100);
    betProfitloss.even = (betProfitloss.even || 0) + (betData?.winAmount * partnership / 100);
  }

  maxLoss = Number(Math.min(...Object.values(betProfitloss), 0).toFixed(2));
  // Return the result
  return {
    betPlaced: betProfitloss,
    maxLoss: parseFloat(Math.abs(maxLoss)),
    totalBet: redisProfitLoss?.totalBet ? parseInt(redisProfitLoss?.totalBet) + 1 : 1
  };
};

/**
* Calculates the profit or loss for a betting session.
* @param {object} redisProfitLoss - Redis data for profit and loss.
* @param {object} betData - Data for the current bet.
* @returns {object} - Object containing upper and lower limit odds, and the updated bet placed data.
*/
exports.calculateProfitLossSessionFancy1 = async (redisProfitLoss, betData, partnership = 100) => {
  let maxLoss = 0;

  let betProfitloss = redisProfitLoss?.betPlaced ?? {};

  if (betData?.betPlacedData?.betType == betType.BACK) {
    betProfitloss.yes = (betProfitloss.yes || 0) + (betData?.winAmount * partnership / 100);
    betProfitloss.no = (betProfitloss.no || 0) - (betData?.lossAmount * partnership / 100);
  }
  else if (betData?.betPlacedData?.betType == betType.LAY) {
    betProfitloss.yes = (betProfitloss.yes || 0) - (betData?.lossAmount * partnership / 100);
    betProfitloss.no = (betProfitloss.no || 0) + (betData?.winAmount * partnership / 100);
  }

  maxLoss = Number(Math.min(...Object.values(betProfitloss), 0).toFixed(2));
  // Return the result
  return {
    betPlaced: betProfitloss,
    maxLoss: parseFloat(Math.abs(maxLoss)),
    totalBet: redisProfitLoss?.totalBet ? parseInt(redisProfitLoss?.totalBet) + 1 : 1
  };
};

/**
* Calculates the profit or loss for a betting session.
* @param {object} redisProfitLoss - Redis data for profit and loss.
* @param {object} betData - Data for the current bet.
* @returns {object} - Object containing upper and lower limit odds, and the updated bet placed data.
*/
exports.calculateProfitLossSessionCasinoCricket = async (redisProfitLoss, betData, partnership = 100) => {
  let maxLoss = 0;

  let betProfitloss = redisProfitLoss?.betPlaced ?? {};

  Array.from({ length: 10 }, (_, index) => index)?.forEach((item) => {
    if (betData?.betPlacedData?.teamName?.split(" ")?.[0] == item) {
      betProfitloss[item] = parseFloat(betProfitloss[item] || 0) + (betData?.winAmount * partnership / 100);
    }
    else {
      betProfitloss[item] = parseFloat(betProfitloss[item] || 0) - (betData?.lossAmount * partnership / 100);
    }
  });

  maxLoss = Number(Math.min(...Object.values(betProfitloss), 0).toFixed(2));
  // Return the result
  return {
    betPlaced: betProfitloss,
    maxLoss: parseFloat(Math.abs(maxLoss)),
    totalBet: redisProfitLoss?.totalBet ? parseInt(redisProfitLoss?.totalBet) + 1 : 1
  };
};

exports.calculatePLAllBet = async (betPlace, type, userPartnerShip = 100, oldLowerLimitOdds, oldUpperLimitOdds, matchDetail) => {
  let profitLoss = {};
  switch (type) {
    case sessionBettingType.ballByBall:
    case sessionBettingType.overByOver:
    case sessionBettingType.session:
      if (!Array.isArray(betPlace) || betPlace.length === 0) {
        return {
          betData: [],
          line: 1,
          maxLoss: 0.0,
          total_bet: 0,
          lowerLimitOdds: oldLowerLimitOdds ? oldLowerLimitOdds + 5 : undefined,
          upperLimitOdds: oldUpperLimitOdds ? oldUpperLimitOdds - 5 : undefined
        };
      }

      let oddsValues = betPlace.map(({ odds }) => odds);
      let first = oldLowerLimitOdds ? oldLowerLimitOdds + 5 : Math.min(...oddsValues);
      let last = oldUpperLimitOdds ? oldUpperLimitOdds - 5 : Math.max(...oddsValues);

      let betData = [];
      let maxLoss = 0.0;

      for (let j = Math.max(first - 5, 0); j <= last + 5; j++) {
        let profitLoss = 0.0;
        for (let key in betPlace) {
          let partnership = userPartnerShip || 100;
          let bet = betPlace[key];
          let isWinningBet = (bet.betType === betType.NO && j < bet.odds) || (bet.betType === betType.YES && j >= bet.odds);
          profitLoss += isWinningBet ? (bet.winAmount * partnership / 100) : (-bet.lossAmount * partnership / 100);
        }
        maxLoss = Math.min(maxLoss, profitLoss);
        betData.push({ odds: j, profitLoss: Number(profitLoss.toFixed(2)) });
      }

      return {
        betData,
        line: betData.length - 1,
        maxLoss: Number(Math.abs(maxLoss).toFixed(2)),
        total_bet: betPlace.length,
        lowerLimitOdds: betData[0].odds,
        upperLimitOdds: betData[betData.length - 1].odds
      };

    case sessionBettingType.khado:
      if (!Array.isArray(betPlace) || betPlace.length === 0) {
        return {
          betData: [],
          line: 1,
          maxLoss: 0.0,
          total_bet: 0,
          lowerLimitOdds: oldLowerLimitOdds ? 1 : undefined,
          upperLimitOdds: oldUpperLimitOdds ? oldUpperLimitOdds : undefined
        };
      }

      let oddsValuesKhado = betPlace.map(({ odds, eventName }) => odds + parseInt(eventName?.split("-")?.pop()) + 9);
      let firstKhado = 1;
      let lastKhado = oldUpperLimitOdds ? oldUpperLimitOdds : Math.max(...oddsValuesKhado);

      let betDataKhado = [];
      let maxLossKhado = 0.0;

      for (let j = firstKhado; j <= lastKhado; j++) {
        let profitLoss = 0.0;
        for (let key in betPlace) {
          let partnership = userPartnerShip || 100;
          let bet = betPlace[key];
          let isWinningBet = (bet.betType === betType.BACK && (j >= bet.odds && j < bet.odds + parseInt(bet.eventName.split("-").pop())));
          profitLoss += isWinningBet ? (bet.winAmount * partnership / 100) : (-bet.lossAmount * partnership / 100);
        }
        maxLossKhado = Math.min(maxLossKhado, profitLoss);
        betDataKhado.push({ odds: j, profitLoss: Number(profitLoss.toFixed(2)) });
      }

      return {
        betData: betDataKhado,
        line: betDataKhado.length - 1,
        maxLoss: Number(Math.abs(maxLossKhado).toFixed(2)),
        total_bet: betPlace.length,
        lowerLimitOdds: betDataKhado[0].odds,
        upperLimitOdds: betDataKhado[betDataKhado.length - 1].odds
      };
    case sessionBettingType.meter:
      if (!Array.isArray(betPlace) || betPlace.length === 0) {
        return {
          betData: [],
          line: 1,
          maxLoss: 0.0,
          total_bet: 0,
          lowerLimitOdds: oldLowerLimitOdds ? 0 : undefined,
          upperLimitOdds: oldUpperLimitOdds ? oldUpperLimitOdds : undefined
        };
      }

      let oddsValuesMeter = betPlace.map(({ odds }) => odds + (matchDetail?.teamC ? 200 : 100));
      let firstMeter = 0;
      let lastMeter = oldUpperLimitOdds ? oldUpperLimitOdds : Math.max(...oddsValuesMeter);

      let betDataMeter = [];
      let maxLossMeter = 0.0;

      for (let j = firstMeter; j <= lastMeter; j++) {
        let profitLoss = 0.0;
        for (let key in betPlace) {
          let partnership = userPartnerShip || 100;
          let bet = betPlace[key];
          let isWinningBet = (bet.betType === betType.NO && j < bet.odds) || (bet.betType === betType.YES && j >= bet.odds);
          profitLoss += isWinningBet ? (((parseFloat(bet.amount) * parseFloat(bet.rate) / 100) * Math.abs(j - parseInt(bet.odds))) * partnership / 100) : (-((parseFloat(bet.amount) * parseFloat(bet.rate) / 100) * Math.abs(j - parseInt(bet.odds))) * partnership / 100);
        }
        maxLossMeter = Math.min(maxLossMeter, profitLoss);
        betDataMeter.push({ odds: j, profitLoss: Number(profitLoss.toFixed(2)) });
      }

      return {
        betData: betDataMeter,
        line: betDataMeter.length - 1,
        maxLoss: Number(Math.abs(maxLossMeter).toFixed(2)),
        total_bet: betPlace.length,
        lowerLimitOdds: betDataMeter[0].odds,
        upperLimitOdds: betDataMeter[betDataMeter.length - 1].odds
      };
    case sessionBettingType.oddEven:
      if (!Array.isArray(betPlace) || betPlace.length === 0) {
        return {
          betData: {},
          maxLoss: 0.0,
          total_bet: 0,
        };
      }

      for (let item of betPlace) {
        let data = {
          winAmount: item?.winAmount,
          lossAmount: item?.lossAmount,
          betPlacedData: {
            teamName: item?.teamName?.split("-")?.pop()?.trim(),
          },
        }
        profitLoss = await this.calculateProfitLossSessionOddEven(profitLoss, data, userPartnerShip);
      }
      return { betData: profitLoss.betPlaced, maxLoss: profitLoss.maxLoss, total_bet: profitLoss?.totalBet };
    case sessionBettingType.cricketCasino:
      if (!Array.isArray(betPlace) || betPlace.length === 0) {
        return {
          betData: {},
          maxLoss: 0.0,
          total_bet: 0,
        };
      }

      for (let item of betPlace) {
        let data = {
          winAmount: item?.winAmount,
          lossAmount: item?.lossAmount,
          betPlacedData: {
            teamName: item?.teamName?.split("-")?.pop()?.trim()
          },
        }
        profitLoss = await this.calculateProfitLossSessionCasinoCricket(profitLoss, data, userPartnerShip);
      }
      return { betData: profitLoss.betPlaced, maxLoss: profitLoss.maxLoss, total_bet: profitLoss?.totalBet };
    case sessionBettingType.fancy1:
      if (!Array.isArray(betPlace) || betPlace.length === 0) {
        return {
          betData: {},
          maxLoss: 0.0,
          total_bet: 0,
        };
      }

      for (let item of betPlace) {
        let data = {
          winAmount: item?.winAmount,
          lossAmount: item?.lossAmount,
          betPlacedData: {
            betType: item?.betType
          },
        }
        profitLoss = await this.calculateProfitLossSessionFancy1(profitLoss, data, userPartnerShip);
      }
      return { betData: profitLoss.betPlaced, maxLoss: profitLoss.maxLoss, total_bet: profitLoss?.totalBet };
    default:
      return {};
  }

};


exports.calculateRatesRacingMatch = async (betPlace, partnerShip = 100, matchData) => {
  let teamRates = {};
  const { runners } = matchData;

  for (let placedBets of betPlace) {
    const matchId = placedBets?.matchId;
    const betId = placedBets?.betId;
    const teamRate = teamRates[![gameType.greyHound, gameType.horseRacing].includes(placedBets.eventType) ? `${betId}${redisKeys.profitLoss}_${matchId}` : `${matchId}${redisKeys.profitLoss}`] || runners.reduce((acc, key) => {
      acc[key?.id] = 0;
      return acc;
    }, {});

    let calculatedRates = await this.calculateRacingRate(
      teamRate,
      {
        runners: runners,
        winAmount: placedBets?.winAmount,
        lossAmount: placedBets?.lossAmount,
        bettingType: placedBets?.betType,
        runnerId: placedBets?.runnerId
      },
      partnerShip
    );

    teamRates[![gameType.greyHound, gameType.horseRacing].includes(placedBets.eventType) ? `${betId}${redisKeys.profitLoss}_${matchId}` : `${matchId}${redisKeys.profitLoss}`] = calculatedRates;
  }

  return teamRates;
}

exports.calculateProfitLossForSessionToResult = async (betId, userId, matchData) => {
  let betPlace = await findAllPlacedBetWithUserIdAndBetId(userId, betId);
  let matchDetail;
  if (!matchData) {
    matchDetail = await getMatchData({ id: betPlace?.[0]?.matchId }, ["id", "teamC"]);
  }
  let redisData = await this.calculatePLAllBet(betPlace, betPlace?.[0]?.marketType, 100, null, null, matchData || matchDetail);
  return redisData;
}


exports.calculateProfitLossForRacingMatchToResult = async (betId, userId, matchData) => {
  let betPlace = await findAllPlacedBetWithUserIdAndBetId(userId, In(betId));
  let redisData = await this.calculateRatesRacingMatch(betPlace, 100, matchData);
  return redisData;
}

exports.calculateProfitLossForCardMatchToResult = async (userId, runnerId, type, partnership, isPending, result) => {
  let betPlace = await getMatchBetPlaceWithUserCard({
    createBy: userId,
    runnerId: runnerId,
    ...(isPending ? { result: betResultStatus.PENDING } : {})
  }, ["betPlaced.id", "betPlaced.teamName", "betPlaced.browserDetail", "betPlaced.betType", "betPlaced.winAmount", "betPlaced.lossAmount", ...(partnership ? [`user.${partnership}`] : [])]);
  let oldPl = {
    profitLoss: {},
    exposure: 0
  };
  for (let bets of betPlace) {
    let sid = bets?.browserDetail?.split("|")?.[1];
    switch (type) {
      case cardGameType.card32:
      case cardGameType.teen:
      case cardGameType.cricketv3:
      case cardGameType.superover:
      case cardGameType.cmatch20:
        sid = 1;
        break;
      case cardGameType.poker:
      case cardGameType.dt6:
        if (parseInt(sid) <= 2) {
          sid = 1;
        }
        break;
      case cardGameType.card32eu:
      case cardGameType.race20:
      case cardGameType.queen:
        if (parseInt(sid) <= 4) {
          sid = 1;
        }
        break;
      case cardGameType.aaa:
        if (parseInt(sid) <= 3) {
          sid = 1;
        }
        break;
      case cardGameType.btable:
        if (parseInt(sid) <= 6) {
          sid = 1;
        }
        break;
      default:
        break;
    }

    const data = new CardProfitLoss(type, oldPl.profitLoss[`${runnerId}_${sid}${redisKeys.card}`], { bettingType: bets?.betType, winAmount: bets.winAmount, lossAmount: bets.lossAmount, playerName: bets?.teamName, partnership: bets?.user?.[partnership] || 100, sid: sid, result: result }, (oldPl?.exposure || 0)).getCardGameProfitLoss();
    oldPl.profitLoss[`${runnerId}_${sid}${redisKeys.card}`] = data.profitLoss;
    oldPl.exposure = data.exposure;
  }
  return oldPl;
}

exports.mergeProfitLoss = (newbetPlaced, oldbetPlaced) => {

  if (newbetPlaced[0].odds > oldbetPlaced[0].odds) {
    while (newbetPlaced[0].odds != oldbetPlaced[0].odds) {
      const newEntry = {
        odds: newbetPlaced[0].odds - 1,
        profitLoss: parseFloat(newbetPlaced[0].profitLoss),
      };
      newbetPlaced.unshift(newEntry);
    }
  }
  if (newbetPlaced[0].odds < oldbetPlaced[0].odds) {
    while (newbetPlaced[0].odds != oldbetPlaced[0].odds) {
      const newEntry = {
        odds: oldbetPlaced[0].odds - 1,
        profitLoss: parseFloat(oldbetPlaced[0].profitLoss),
      };
      oldbetPlaced.unshift(newEntry);
    }
  }

  if (newbetPlaced[newbetPlaced.length - 1].odds > oldbetPlaced[oldbetPlaced.length - 1].odds) {
    while (newbetPlaced[newbetPlaced.length - 1].odds != oldbetPlaced[oldbetPlaced.length - 1].odds) {
      const newEntry = {
        odds: oldbetPlaced[oldbetPlaced.length - 1].odds + 1,
        profitLoss: parseFloat(oldbetPlaced[oldbetPlaced.length - 1].profitLoss),
      };
      oldbetPlaced.push(newEntry);
    }
  }
  if (newbetPlaced[newbetPlaced.length - 1].odds < oldbetPlaced[oldbetPlaced.length - 1].odds) {
    while (newbetPlaced[newbetPlaced.length - 1].odds != oldbetPlaced[oldbetPlaced.length - 1].odds) {
      const newEntry = {
        odds: newbetPlaced[newbetPlaced.length - 1].odds + 1,
        profitLoss: parseFloat(newbetPlaced[newbetPlaced.length - 1].profitLoss),
      };
      newbetPlaced.push(newEntry);
    }
  }
};

exports.findUserPartnerShipObj = async (user) => {
  try {
    const obj = {};

    const updateObj = (prefix, id) => {
      obj[`${prefix}Partnership`] = user[`${prefix}Partnership`];
      obj[`${prefix}PartnershipId`] = id;
    };

    const traverseHierarchy = async (currentUser, walletPartnerships) => {
      if (!currentUser) {
        return;
      }

      if (currentUser.roleName != userRoleConstant.user) {
        updateObj(partnershipPrefixByRole[currentUser.roleName], currentUser.id);
      }

      if (currentUser.createBy ||
        currentUser?.roleName == userRoleConstant.fairGameAdmin) {
        if (currentUser?.id == currentUser?.createBy) {
          try {
            let response = await getPartnershipIdHandler({ userId: currentUser.id }).catch((err) => {
              throw err?.response?.data;
            });
            await traverseHierarchy(
              response?.find(
                (item) => (item?.roleName == userRoleConstant.fairGameAdmin && response?.length == 2) || (item?.roleName == userRoleConstant.fairGameWallet && response?.length == 1)
              ),
              response
            );
          } catch (err) {

          }
        } else if (currentUser?.roleName == userRoleConstant.fairGameAdmin) {
          await traverseHierarchy(
            walletPartnerships?.find(
              (item) => item?.roleName == userRoleConstant.fairGameWallet
            )
          );
        } else {
          const createdByUser = await getUserById(currentUser.createBy, [
            "id",
            "roleName",
            "createBy",
          ]);
          await traverseHierarchy(createdByUser);
        }
      }
    };

    await traverseHierarchy(user);

    return JSON.stringify(obj);
  }
  catch (err) {
    throw err;
  }
};

/**
 * Retrieves and calculates various betting data for a user at login.
 * @param {Object} user - The user object.
 * @param {string} user.roleName - The role name of the user.
 * @param {string} user.id - The unique identifier of the user.
 * @returns {Object} - An object containing calculated betting data.
 * @throws {Error} - Throws an error if there is an issue fetching data.
 */
exports.settingBetsDataAtLogin = async (user, matchGametype) => {
  if (user.roleName == userRoleConstant.user) {
    const bets = await getUserDistinctBets(user.id, { eventType: (matchGametype || In([gameType.cricket, gameType.politics, gameType.football, gameType.tennis])) });
    let sessionResult = {};
    let sessionExp = {};

    let matchResult = {};
    let matchExposure = {};

    const matchDetails = (await getMatchList({ id: In(Array.from(new Set(bets?.map((item) => item.matchId)))) }, ["id", "teamC"]))?.reduce((acc, key) => {
      acc[key?.id] = key;
      return acc;
    }, {});

    for (let currBets of bets) {
      if (currBets.marketBetType == marketBetType.SESSION) {
        let result = await this.calculateProfitLossForSessionToResult(currBets.betId, user.id, matchDetails?.[currBets.matchId]);
        if ([sessionBettingType.ballByBall, sessionBettingType.overByOver, sessionBettingType.session, sessionBettingType.khado, sessionBettingType.meter].includes(currBets?.marketType)) {
          sessionResult[`session:${user.id}:${currBets.matchId}:${currBets.betId}:profitLoss`] = result.betData?.reduce((acc, key) => {
            acc[key.odds] = key.profitLoss;
            return acc;
          }, {});
        }
        else {
          sessionResult[`session:${user.id}:${currBets.matchId}:${currBets.betId}:profitLoss`] = result.betData
        }

        sessionResult[`session:${user.id}:${currBets.matchId}:${currBets.betId}:maxLoss`] = result.maxLoss;
        sessionResult[`session:${user.id}:${currBets.matchId}:${currBets.betId}:totalBet`] = result.total_bet;

        if (result.upperLimitOdds) {
          sessionResult[`session:${user.id}:${currBets.matchId}:${currBets.betId}:upperLimitOdds`] = result.upperLimitOdds;
        }
        if (result.lowerLimitOdds) {
          sessionResult[`session:${user.id}:${currBets.matchId}:${currBets.betId}:lowerLimitOdds`] = result.lowerLimitOdds;
        }
        sessionExp[`${redisKeys.userSessionExposure}${currBets.matchId}`] = parseFloat((parseFloat(sessionExp[`${redisKeys.userSessionExposure}${currBets.matchId}`] || 0) + result.maxLoss).toFixed(2));
      }
      else if (currBets.marketBetType == marketBetType.MATCHBETTING) {
        let apiResponse;
        try {
          apiResponse = await getTournamentBettingHandler({ matchId: currBets?.matchId, id: currBets?.betId });
        } catch (error) {
          logger.info({
            info: `Error at get match details in login.`
          });
          return;
        }

        let redisData = await this.calculateProfitLossForRacingMatchToResult([currBets.betId], user.id, apiResponse?.data);
        let maxLoss = 0;
        Object.keys(redisData)?.forEach((key) => {
          maxLoss += Math.abs(Math.min(...Object.values(redisData[key] || {}), 0));
          const [currBetId, , currMatchId] = key.split("_");
          const baseKey = `match:${user.id}:${currMatchId}:${currBetId}:profitLoss`
          redisData[baseKey] = redisData[key];
          delete redisData[key];
        });

        matchResult = {
          ...matchResult,
          ...redisData
        }

        matchExposure[`${redisKeys.userMatchExposure}${currBets.matchId}`] = parseFloat((parseFloat(matchExposure[`${redisKeys.userMatchExposure}${currBets.matchId}`] || 0) + maxLoss).toFixed(2));
      }
    }

    return { plResult: { ...sessionResult, ...matchResult }, expResult: { ...sessionExp, ...matchExposure } }

  }
  else {
    const users = await getChildsWithOnlyUserRole(user.id);
    let sessionResult = {};
    let sessionExp = {};

    let matchResult = {};
    let matchExposure = {};

    let betResult = {
      session: {},
      match: {}
    };

    const bets = await getBetsWithUserRole(users?.map((item) => item.id), { eventType: (matchGametype || In([gameType.cricket, gameType.politics, gameType.football, gameType.tennis])) });

    const matchIdDetail = (await getMatchList({ id: In(Array.from(new Set(bets?.map((item) => item.matchId)))) }, ["id", "teamC"]))?.reduce((acc, key) => {
      acc[key?.id] = key;
      return acc;
    }, {});

    for (let item of bets) {

      let itemData = {
        ...item,
        winAmount: -parseFloat((parseFloat(item.winAmount) * parseFloat(item?.user?.[`${partnershipPrefixByRole[user.roleName]}Partnership`]) / 100).toFixed(2)),
        lossAmount: -parseFloat((parseFloat(item.lossAmount) * parseFloat(item?.user?.[`${partnershipPrefixByRole[user.roleName]}Partnership`]) / 100).toFixed(2)),
        ...(item.marketType == sessionBettingType.meter ? { amount: -parseFloat((parseFloat(item.amount) * parseFloat(item?.user?.[`${partnershipPrefixByRole[user.roleName]}Partnership`]) / 100).toFixed(2)) } : {})
      };
      if (betResult.session[item.betId] || betResult.match[item.betId]) {
        if (item.marketBetType == marketBetType.SESSION) {
          betResult.session[item.betId].push(itemData);
        }
        else if (item.marketBetType == marketBetType.MATCHBETTING) {
          betResult.match[item.betId].push(itemData);
        }
      }
      else {
        if (item.marketBetType == marketBetType.SESSION) {
          betResult.session[item.betId] = [itemData];
        }
        else if (item.marketBetType == marketBetType.MATCHBETTING) {
          betResult.match[item.betId] = [itemData];
        }
      }
    }
    for (const placedBet of Object.keys(betResult.session)) {
      const betPlaceProfitLoss = await this.calculatePLAllBet(betResult.session[placedBet], betResult?.session?.[placedBet]?.[0]?.marketType, 100, null, null, matchIdDetail[betResult?.session?.[placedBet]?.[0]?.matchId]);

      const matchId = betResult.session[placedBet]?.[0]?.matchId;
      const betData = betPlaceProfitLoss?.betData;
      const sessionKeyPrefix = `session:${user.id}:${matchId}:${placedBet}`;

      if (sessionKeyPrefix && betData) {
        if ([sessionBettingType.ballByBall, sessionBettingType.overByOver, sessionBettingType.session, sessionBettingType.khado, sessionBettingType.meter].includes(betResult?.session?.[placedBet]?.[0]?.marketType)) {
          sessionResult[`${sessionKeyPrefix}:profitLoss`] = betData?.reduce((acc, key) => {
            acc[key.odds] = key.profitLoss;
            return acc;
          }, {});
        }
        else {
          sessionResult[`${sessionKeyPrefix}:profitLoss`] = betData
        }
        sessionResult[`${sessionKeyPrefix}:maxLoss`] = betPlaceProfitLoss?.maxLoss;
        sessionResult[`${sessionKeyPrefix}:totalBet`] = betPlaceProfitLoss?.total_bet;
        sessionResult[`${sessionKeyPrefix}:upperLimitOdds`] = betData?.[betData.length - 1]?.odds;
        sessionResult[`${sessionKeyPrefix}:lowerLimitOdds`] = betData?.[0]?.odds;
      }

      sessionExp[`${redisKeys.userSessionExposure}${betResult.session[placedBet]?.[0]?.matchId}`] = parseFloat((parseFloat(sessionExp[`${redisKeys.userSessionExposure}${betResult.session[placedBet]?.[0]?.matchId}`] || 0) + betPlaceProfitLoss?.maxLoss).toFixed(2));
    }

    for (const placedBet of Object.keys(betResult.match)) {
      const matchId = betResult.match[placedBet]?.[0]?.matchId;

      let apiResponse;
      try {
        apiResponse = await getTournamentBettingHandler({ matchId: matchId, id: placedBet });
      } catch (error) {
        logger.info({
          info: `Error at get match details in login.`
        });
        return;
      }
      let redisData = await this.calculateRatesRacingMatch(betResult.match[placedBet], 100, apiResponse?.data);
      let maxLoss = 0;

      Object.keys(redisData)?.forEach((items) => {
        maxLoss += Math.abs(Math.min(...Object.values(redisData[items] || {}), 0));
        if (matchResult[items]) {
          Object.keys(redisData[items])?.forEach((matchResultData) => {
            matchResult[items][matchResultData] += parseFloat(parseFloat(redisData[items]?.[matchResultData]).toFixed(2));
          });
        }
        else {
          matchResult[items] = redisData[items];
        }
      });

      matchExposure[`${redisKeys.userMatchExposure}${matchId}`] = parseFloat((parseFloat(matchExposure[`${redisKeys.userMatchExposure}${matchId}`] || 0) + maxLoss).toFixed(2));
    }
    Object.keys(matchResult)?.forEach((key) => {
      const [currBetId, , currMatchId] = key.split("_");
      const baseKey = `match:${user.id}:${currMatchId}:${currBetId}:profitLoss`
      matchResult[baseKey] = matchResult[key];
      delete matchResult[key];
    });
    return { plResult: { ...sessionResult, ...matchResult }, expResult: { ...sessionExp, ...matchExposure } }
  }
}

exports.settingCasinoMatchBetsDataAtLogin = async (user) => {
  let bets = [];

  if (user.roleName == userRoleConstant.user) {
    bets = await findAllPlacedBet({ marketBetType: marketBetType.CARD, result: In([betResultStatus.PENDING]), deleteReason: IsNull(), createBy: user.id });
  }
  else {
    const users = await getChildsWithOnlyUserRole(user.id);
    bets = await getBetsWithUserRole(users?.map((item) => item.id), { marketBetType: marketBetType.CARD });
    bets = bets?.map((item) => {
      return {
        ...item,
        winAmount: -parseFloat((parseFloat(item.winAmount) * parseFloat(item?.user?.[`${partnershipPrefixByRole[user.roleName]}Partnership`]) / 100).toFixed(2)),
        lossAmount: -parseFloat((parseFloat(item.lossAmount) * parseFloat(item?.user?.[`${partnershipPrefixByRole[user.roleName]}Partnership`]) / 100).toFixed(2))
      }
    });
  }

  let matchResult = {};
  let matchExposure = {};

  for (let currBets of bets) {

    const newProfitLossAndExp = new CardProfitLoss(currBets.eventType, matchResult[`${currBets.runnerId}_${currBets?.browserDetail?.split("|")?.[1]}${redisKeys.card}`], { bettingType: currBets?.betType, winAmount: currBets?.winAmount, lossAmount: currBets?.lossAmount, playerName: currBets?.teamName, partnership: 100 }, matchExposure[`${redisKeys.userMatchExposure}${currBets.runnerId}`]).getCardGameProfitLoss()
    matchResult[`${currBets.runnerId}_${currBets?.browserDetail?.split("|")?.[1]}${redisKeys.card}`] = newProfitLossAndExp.profitLoss;
    matchExposure[`${redisKeys.userMatchExposure}${currBets.runnerId}`] = parseFloat((newProfitLossAndExp.exposure).toFixed(2));

  }
  return {
    ...matchExposure, ...matchResult
  }
}

exports.getUserProfitLossForUpperLevel = async (user, matchId) => {
  let users = [];
  if (user.roleName == userRoleConstant.fairGameAdmin) {
    users = await getAllUsers({ superParentId: user.id });
  }
  else {
    users = await getChildsWithOnlyUserRole(user.id);
  }
  let betResult = { match: {} };

  let matchResult = {};

  const bets = await getBetsWithUserRole(users?.map((item) => item.id), { matchId: matchId, marketType: matchBettingType.tournament });
  bets?.forEach((item) => {
    let itemData = {
      ...item,
      winAmount: -parseFloat((parseFloat(item.winAmount)).toFixed(2)),
      lossAmount: -parseFloat((parseFloat(item.lossAmount)).toFixed(2))
    };
    if (betResult.match[item.betId]) {
      betResult.match[item.betId].push(itemData);
    }
    else {
      betResult.match[item.betId] = [itemData];
    }
  });

  for (const placedBet of Object.keys(betResult.match)) {
    const matchId = betResult.match[placedBet]?.[0]?.matchId;

    let apiResponse;
    try {
      apiResponse = await getTournamentBettingHandler({ matchId: matchId, id: placedBet });
    } catch (error) {
      logger.info({
        info: `Error at get match details in login.`
      });
      continue;
    }
    let redisData = await this.calculateRatesRacingMatch(betResult.match[placedBet], 100, apiResponse?.data);
    const runners = apiResponse?.data?.runners?.sort((a, b) => a.sortPriority - b.sortPriority);
    matchResult[placedBet] = {
      name: apiResponse?.data?.matchBetting?.name,
      teams: runners?.reduce((prev, curr) => {
        prev[curr.id] = { pl: (Object.values(redisData)?.[0]?.[curr.id] || 0) + (matchResult[curr.id]?.pl || 0), name: curr.runnerName }
        return prev
      }, {})
    }
    // let teamARate = Object.values(redisData)?.[0]?.[runners?.[0]?.id] ?? Number.MAX_VALUE;
    // let teamBRate = Object.values(redisData)?.[0]?.[runners?.[1]?.id]  ?? Number.MAX_VALUE;
    // let teamCRate = Object.values(redisData)?.[0]?.[runners?.[2]?.id]  ?? Number.MAX_VALUE;
    // matchResult = {
    //   ...matchResult,
    //   ...(teamARate != Number.MAX_VALUE && teamARate != null && teamARate != undefined ? { [redisKeys.userTeamARate + matchId]: teamARate + (matchResult[redisKeys.userTeamARate + matchId] || 0) } : {}),
    //   ...(teamBRate != Number.MAX_VALUE && teamBRate != null && teamBRate != undefined ? { [redisKeys.userTeamBRate + matchId]: teamBRate + (matchResult[redisKeys.userTeamBRate + matchId] || 0) } : {}),
    //   ...(teamCRate != Number.MAX_VALUE && teamCRate != null && teamCRate != undefined ? { [redisKeys.userTeamCRate + matchId]: teamCRate + (matchResult[redisKeys.userTeamCRate + matchId] || 0) } : {}),
    // }

  }
  return matchResult;
}

exports.profitLossPercentCol = (body, queryColumns) => {
  switch (body.roleName) {
    case (userRoleConstant.fairGameWallet):
    case (userRoleConstant.expert): {
      queryColumns = `(user.${partnershipPrefixByRole[userRoleConstant.fairGameWallet]}Partnership)`;
      break;
    }
    case (userRoleConstant.fairGameAdmin): {
      queryColumns = `(user.${partnershipPrefixByRole[userRoleConstant.fairGameWallet]}Partnership + user.${partnershipPrefixByRole[userRoleConstant.fairGameAdmin]}Partnership)`;
      break;
    }
    case (userRoleConstant.superAdmin): {
      queryColumns = `(user.${partnershipPrefixByRole[userRoleConstant.fairGameWallet]}Partnership + user.${partnershipPrefixByRole[userRoleConstant.fairGameAdmin]}Partnership + user.${partnershipPrefixByRole[userRoleConstant.superAdmin]}Partnership)`;
      break;
    }
    case (userRoleConstant.admin): {
      queryColumns = `(user.${partnershipPrefixByRole[userRoleConstant.fairGameWallet]}Partnership + user.${partnershipPrefixByRole[userRoleConstant.fairGameAdmin]}Partnership + user.${partnershipPrefixByRole[userRoleConstant.superAdmin]}Partnership + user.${partnershipPrefixByRole[userRoleConstant.admin]}Partnership)`;
      break;
    }
    case (userRoleConstant.superMaster): {
      queryColumns = `(user.${partnershipPrefixByRole[userRoleConstant.fairGameWallet]}Partnership + user.${partnershipPrefixByRole[userRoleConstant.fairGameAdmin]}Partnership + user.${partnershipPrefixByRole[userRoleConstant.superAdmin]}Partnership + user.${partnershipPrefixByRole[userRoleConstant.admin]}Partnership + user.${partnershipPrefixByRole[userRoleConstant.superMaster]}Partnership)`;

      break;
    }
    case (userRoleConstant.master): {
      queryColumns = `(user.${partnershipPrefixByRole[userRoleConstant.fairGameWallet]}Partnership + user.${partnershipPrefixByRole[userRoleConstant.fairGameAdmin]}Partnership + user.${partnershipPrefixByRole[userRoleConstant.superAdmin]}Partnership + user.${partnershipPrefixByRole[userRoleConstant.admin]}Partnership + user.${partnershipPrefixByRole[userRoleConstant.superMaster]}Partnership + user.${partnershipPrefixByRole[userRoleConstant.master]}Partnership)`;
      break;
    }
    case (userRoleConstant.agent): {
      queryColumns = `(user.${partnershipPrefixByRole[userRoleConstant.fairGameWallet]}Partnership + user.${partnershipPrefixByRole[userRoleConstant.fairGameAdmin]}Partnership + user.${partnershipPrefixByRole[userRoleConstant.superAdmin]}Partnership + user.${partnershipPrefixByRole[userRoleConstant.admin]}Partnership + user.${partnershipPrefixByRole[userRoleConstant.superMaster]}Partnership + user.${partnershipPrefixByRole[userRoleConstant.master]}Partnership + user.${partnershipPrefixByRole[userRoleConstant.agent]}Partnership)`;
      break;
    }
    default:
      queryColumns = '100';
      break;
  }
  return queryColumns;
}

exports.transactionPasswordAttempts = async (user, isAccessUser) => {
  if (user?.transactionPasswordAttempts + 1 >= 11) {
    if (isAccessUser) {
      await updateAccessUser({ id: user.id }, { userBlock: true, userBlockedBy: user.mainParentId })
    }
    else {
      await userBlockUnblock(user.id, user.createBy == user.id ? user.superParentId : user.createBy, true);
    }
    if (user?.createBy == user.id) {
      await lockUnlockUserByUserPanelHandler(
        {
          userId: user.id, userBlock: true, parentId: user?.superParentId, autoBlock: false
        }
      ).catch(error => {
        logger.error({
          error: `Error at block user in tp.`,
          stack: error.stack,
          message: error.message,
        });
        throw error
      });
    }
    this.forceLogoutUser(user.id, false, isAccessUser, isAccessUser ? user?.mainParentId : null);

    if (isAccessUser) {
      await updateAccessUser({ id: user.id }, { transactionPasswordAttempts: 0 })
    }
    else {
      await updateUser(user.id, { transactionPasswordAttempts: 0 });
    }
  }
  else {
    if (isAccessUser) {
      await accessUserPasswordAttempts(user.id);
    }
    else {
      await userPasswordAttempts(user.id);
    }
  }
}
exports.insertBulkTransactions = async (bulkWalletRecord) => {
  const chunkSize = 5000;
  const totalRecords = bulkWalletRecord.length;
  for (let i = 0; i < totalRecords; i += chunkSize) {
    const chunk = bulkWalletRecord.slice(i, i + chunkSize);
    await insertTransactions(chunk);
  }
}

exports.insertBulkCommissions = async (bulkWalletRecord) => {
  const chunkSize = 5000;
  const totalRecords = bulkWalletRecord.length;
  for (let i = 0; i < totalRecords; i += chunkSize) {
    const chunk = bulkWalletRecord.slice(i, i + chunkSize);
    await insertCommissions(chunk);
  }
}

exports.parseRedisData = (redisKey, userRedisData) => {
  return parseFloat((Number(userRedisData[redisKey]) || 0.0).toFixed(2));
};
exports.childIdquery = async (user, searchId) => {
  let subquery;
  if (user.roleName === userRoleConstant.user) {
    subquery = `'${user.id}'`
  }
  else if (user.roleName === userRoleConstant.fairGameWallet && !searchId) {
    subquery = `(SELECT id FROM "users" WHERE "roleName" = '${userRoleConstant.user}' and "isDemo" = false)`;

  } else {
    let userId = searchId || user.id;

    if (user.roleName === userRoleConstant.fairGameAdmin && !searchId) {
      subquery = `(SELECT id FROM "users" WHERE "superParentId" = '${user.id}' AND "roleName" = '${userRoleConstant.user}')`;

    } else {
      const recursiveSubquery = `
      WITH RECURSIVE p AS (
        SELECT * FROM "users" WHERE "users"."id" = '${userId}'
        UNION
        SELECT "lowerU".* FROM "users" AS "lowerU" JOIN p ON "lowerU"."createBy" = p."id"
      )
      SELECT "id" FROM p WHERE "deletedAt" IS NULL AND "roleName" = '${userRoleConstant.user}'
    `;
      subquery = `(${recursiveSubquery})`;

    }
  }
  return subquery;
}

exports.checkBetLimit = async (betLimit, betId, userId) => {
  if (betLimit != 0) {
    const currBetCount = await getBetCountData({ betId: betId, deleteReason: IsNull(), createBy: userId });
    if (currBetCount >= betLimit) {
      throw { message: { msg: "bet.limitExceed", keys: { limit: betLimit } } }
    }
  }
}

exports.loginDemoUser = async (user) => {
  try {
    logger.info({ message: "Setting exposure at demo login time.", data: user });

    const token = jwt.sign(
      { id: user.id, roleName: user.roleName, userName: user.userName, isDemo: true },
      jwtSecret
    );

    // Set user details and partnerships in Redis
    await updateUserDataRedis(user.id, {
      exposure: user?.userBal?.exposure || 0,
      profitLoss: user?.userBal?.profitLoss || 0,
      myProfitLoss: user?.userBal?.myProfitLoss || 0,
      userName: user.userName,
      currentBalance: user?.userBal?.currentBalance || 0,
      roleName: user.roleName,
      userRole: user.roleName,
      token: token,
      isDemo: true
    });

    // Expire user data in Redis
    await internalRedis.expire(user.id, demoRedisTimeOut);
    return token;
  }
  catch (err) {
    throw err;
  }
};

exports.deleteDemoUser = async (id) => {
  await deleteButton({ createBy: id });
  await deleteTransactions({ userId: id });
  await deleteBet({ createBy: id });
  await deleteUserBalance({ userId: id });
  await deleteUser({ id: id });
}

exports.deleteMultipleDemoUser = async () => {
  const deleteTime = new Date(Date.now() - demoRedisTimeOut * 1000);

  const userIds = (await getAllUsers({ isDemo: true, createdAt: LessThanOrEqual(deleteTime) })).map((item) => item.id);
  await deleteButton({ createBy: In(userIds) });
  await deleteTransactions({ userId: In(userIds) });
  await deleteBet({ createBy: In(userIds) });
  await deleteUserBalance({ userId: In(userIds) });
  await deleteUser({ isDemo: true, createdAt: LessThanOrEqual(deleteTime) });
}

exports.connectAppWithToken = async (authToken, deviceId, user) => {
  try {
    const isDeviceExist = await getAuthenticator({ userId: user.id }, ["id"]);

    if (isDeviceExist) {
      throw {
        statusCode: 403,
        message: {
          msg: "auth.deviceTokenExist",
        },
      }
    }


    const userAuthToken = await getUserRedisSingleKey(user.id, redisKeys.authenticatorToken);
    const isTokenMatch = await verifyAuthToken(authToken, userAuthToken);

    if (!isTokenMatch) {
      throw {
        statusCode: 403,
        message: {
          msg: "auth.authenticatorCodeNotMatch",
        },
      };
    }
    await addAuthenticator({ userId: user.id, deviceId: deviceId, type: authenticatorType.app });
    await updateUser(user.id, { isAuthenticatorEnable: true });
    await this.forceLogoutIfLogin(user.id);
  } catch (error) {
    throw error;
  }

}

exports.getUserExposuresGameWise = async (user, matchData) => {
  if (user.roleName == userRoleConstant.user) {
    const bets = await getUserDistinctBets(user.id, { eventType: (In([gameType.cricket, gameType.politics, gameType.tennis, gameType.football])) });
    let exposures = {};

    let betPlace = (await findAllPlacedBet({ result: In([betResultStatus.PENDING]), createBy: user.id, eventType: (In([gameType.cricket, gameType.politics, gameType.tennis, gameType.football])), deleteReason: IsNull() })).reduce((prev, curr) => {
      prev[curr.betId] = prev[curr.betId] || [];
      prev[curr.betId].push(curr);
      return prev;
    }, {});

    for (let currBets of bets) {
      let currBetPlace = betPlace[currBets?.betId] || [];

      if (currBets.marketBetType == marketBetType.SESSION) {
        let matchDetail = matchData?.[currBetPlace?.[0]?.matchId] || {};
        let result = await this.calculatePLAllBet(currBetPlace, currBetPlace?.[0]?.marketType, 100, null, null, matchDetail);

        exposures[currBets.matchId] = parseFloat((parseFloat(exposures[currBets.matchId] || 0) + result.maxLoss).toFixed(2));
      }
      else if (currBets.marketBetType == marketBetType.MATCHBETTING) {
        let apiResponse;
        try {
          apiResponse = await getTournamentBettingHandler({ matchId: currBets.matchId, id: currBets.betId });
        } catch (error) {
          logger.info({
            info: `Error at get match details in login.`
          });
          return;
        }

        let redisData = await this.calculateRatesRacingMatch(currBetPlace, 100, apiResponse?.data);

        let maxLoss = Object.values(redisData).reduce((prev, curr) => {
          prev += Math.abs(Math.min(...Object.values(curr || {}), 0));
          return prev
        }, 0);

        exposures[currBets.matchId] = parseFloat((parseFloat(exposures[currBets.matchId] || 0) + maxLoss).toFixed(2));

      }
    }
    return exposures;
  }
  else {
    const users = await getChildsWithOnlyUserRole(user.id);
    let exposures = {};
    let betResult = {
      session: {},
      match: {}
    };

    const bets = await getBetsWithUserRole(users?.map((item) => item.id), { eventType: (In([gameType.cricket, gameType.politics, gameType.tennis, gameType.football])) });

    for (let item of bets) {
      let itemData = {
        ...item,
        winAmount: parseFloat((parseFloat(item.winAmount)).toFixed(2)),
        lossAmount: parseFloat((parseFloat(item.lossAmount)).toFixed(2))
      };
      if (betResult.session[item.betId + '_' + item?.user?.id] || betResult.match[item.betId + '_' + item?.user?.id]) {
        if (item.marketBetType == marketBetType.SESSION) {
          betResult.session[item.betId + '_' + item?.user?.id].push(itemData);
        }
        else if (item.marketBetType == marketBetType.MATCHBETTING) {
          betResult.match[item.betId + '_' + item?.user?.id].push(itemData);
        }
      }
      else {

        if (item.marketBetType == marketBetType.SESSION) {
          betResult.session[item.betId + '_' + item?.user?.id] = [itemData];
        }
        else if (item.marketBetType == marketBetType.MATCHBETTING) {
          betResult.match[item.betId + '_' + item?.user?.id] = [itemData];
        }
      }
    }
    for (const placedBet of Object.keys(betResult.session)) {
      const betPlaceProfitLoss = await this.calculatePLAllBet(betResult.session[placedBet], betResult?.session?.[placedBet]?.[0]?.marketType, 100, null, null, matchData[betResult?.session?.[placedBet]?.[0]?.matchId]);
      exposures[betResult.session[placedBet]?.[0]?.matchId] = parseFloat((parseFloat(exposures[betResult.session[placedBet]?.[0]?.matchId] || 0) + betPlaceProfitLoss.maxLoss).toFixed(2));
    }
    for (const placedBet of Object.keys(betResult.match)) {
      const matchId = betResult.match[placedBet]?.[0]?.matchId;

      let apiResponse;
      try {
        apiResponse = await getTournamentBettingHandler({ matchId: matchId, id: placedBet.split("_")?.[0] });
      } catch (error) {
        logger.info({
          info: `Error at get match details in login.`
        });
        return;
      }
      let redisData = await this.calculateRatesRacingMatch(betResult.match[placedBet], 100, apiResponse?.data);
      let maxLoss = Object.values(redisData).reduce((prev, curr) => {
        prev += Math.abs(Math.min(...Object.values(curr || {}), 0));
        return prev
      }, 0);

      exposures[matchId] = parseFloat((parseFloat(exposures[matchId] || 0) + maxLoss).toFixed(2));
    }
    return exposures;
  }
}

exports.getCasinoMatchDetailsExposure = async (user) => {
  let bets = [];
  if (user.roleName == userRoleConstant.user) {
    bets = await findAllPlacedBet({ createBy: user.id, marketBetType: marketBetType.CARD, result: betResultStatus.PENDING, deleteReason: IsNull() });
  }
  else {
    const users = await getChildsWithOnlyUserRole(user.id);
    bets = await findAllPlacedBet({ createBy: In(users.map((item) => item.id)), marketBetType: marketBetType.CARD, result: betResultStatus.PENDING, deleteReason: IsNull() });

  }
  const betsData = {};
  let resultExposure = 0;
  for (let item of bets) {
    betsData[`${item.runnerId}_${item.createBy}_${item.eventType}`] = [...(betsData[`${item.runnerId}_${item.createBy}_${item.eventType}`] || []), item];
  }
  let cardWiseExposure = {};
  if (bets.length) {
    for (let items of Object.keys(betsData)) {
      const type = items.split("_")?.[2];
      const runnerId = items.split("_")?.[0];

      let oldPl = {
        profitLoss: {},
        exposure: 0
      };
      for (let bets of betsData[items]) {
        let sid = bets?.browserDetail?.split("|")?.[1];
        switch (type) {
          case cardGameType.card32:
          case cardGameType.teen:
          case cardGameType.cricketv3:
          case cardGameType.superover:
          case cardGameType.cmatch20:
            sid = 1;
            break;
          case cardGameType.poker:
          case cardGameType.dt6:
            if (parseInt(sid) <= 2) {
              sid = 1;
            }
            break;
          case cardGameType.card32eu:
          case cardGameType.race20:
          case cardGameType.queen:
            if (parseInt(sid) <= 4) {
              sid = 1;
            }
            break;
          case cardGameType.aaa:
            if (parseInt(sid) <= 3) {
              sid = 1;
            }
            break;
          case cardGameType.btable:
            if (parseInt(sid) <= 6) {
              sid = 1;
            }
            break;
          default:
            break;
        }

        const data = new CardProfitLoss(type, oldPl.profitLoss[`${runnerId}_${sid}`], { bettingType: bets?.betType, winAmount: bets.winAmount, lossAmount: bets.lossAmount, playerName: bets?.teamName, partnership: 100, sid: sid }, (oldPl?.exposure || 0)).getCardGameProfitLoss();
        oldPl.profitLoss[`${runnerId}_${sid}`] = data.profitLoss;
        oldPl.exposure = data.exposure;
      }
      resultExposure += oldPl.exposure;
      cardWiseExposure[`${type}`] = (cardWiseExposure[`${type}`] || 0) + oldPl.exposure;
    }

  }
  return { totalExposure: resultExposure, cardWiseExposure: cardWiseExposure };
}

exports.getVirtualCasinoExposure = async (user) => {
  let bets = [];
  if (user.roleName == userRoleConstant.user) {
    bets = await getVirtualCasinoExposureSum({ userId: user.id, settled: false });
  }
  else {
    const users = await getChildsWithOnlyUserRole(user.id);
    bets = await getVirtualCasinoExposureSum({ userId: In(users.map((item) => item.id)), settled: false, });
  }

  return bets;
}

exports.getUserProfitLossMatch = async (user, matchId) => {
  let sessionResult = {};
  let matchResult = {};

  if (user.roleName == userRoleConstant.user) {
    const bets = await getUserDistinctBets(user.id, { matchId: matchId });

    const matchDetails = (await getMatchList({ id: In(Array.from(new Set(bets?.map((item) => item.matchId)))) }, ["id", "teamC"]))?.reduce((acc, key) => {
      acc[key?.id] = key;
      return acc;
    }, {})

    for (let currBets of bets) {
      if (currBets.marketBetType == marketBetType.SESSION) {
        let result = await this.calculateProfitLossForSessionToResult(currBets.betId, user.id, matchDetails?.[currBets?.matchId]);

        sessionResult[`${currBets.betId}`] = {
          maxLoss: result.maxLoss,
          betPlaced: result.betData,
          totalBet: result.total_bet,
          betDetails: currBets
        };
        if (result.upperLimitOdds) {
          sessionResult[`${currBets.betId}`].upperLimitOdds = result.upperLimitOdds;
        }
        if (result.lowerLimitOdds) {
          sessionResult[`${currBets.betId}`].lowerLimitOdds = result.lowerLimitOdds;
        }

      }
      if (currBets.marketBetType == marketBetType.MATCHBETTING) {

        let apiResponse;
        try {
          apiResponse = await getTournamentBettingHandler({ matchId: currBets.matchId, id: currBets.betId });
        } catch (error) {
          logger.info({
            info: `Error at get match details in login.`
          });
          return;
        }

        let redisData = await this.calculateProfitLossForRacingMatchToResult([currBets.betId], user.id, apiResponse?.data);
        matchResult[currBets.betId] = { data: redisData, betDetails: currBets };

      }

    }
    return { session: sessionResult, match: matchResult };
  }
  else {
    const users = await getChildsWithOnlyUserRole(user.id);
    let betResult = {
      session: {},
      match: {}
    };

    let tempData = {};

    const bets = await getBetsWithUserRole(users?.map((item) => item.id), { matchId: matchId });

    const matchIdDetail = (await getMatchList({ id: In(Array.from(new Set(bets?.map((item) => item.matchId)))) }, ["id", "teamC"]))?.reduce((acc, key) => {
      acc[key?.id] = key;
      return acc;
    }, {})

    for (let item of bets) {
      let itemData = {
        ...item,
        winAmount: parseFloat((parseFloat(item.winAmount)).toFixed(2)),
        lossAmount: parseFloat((parseFloat(item.lossAmount)).toFixed(2))
      };
      if (betResult.session[item.betId + '_' + item?.user?.id] || betResult.match[item.betId + '_' + item?.user?.id]) {
        if (item.marketBetType == marketBetType.SESSION) {
          betResult.session[item.betId + '_' + item?.user?.id].push(itemData);
        }
        else if (item.marketBetType == marketBetType.MATCHBETTING) {
          betResult.match[item.betId + '_' + item?.user?.id].push(itemData);
        }

      }
      else {

        if (item.marketBetType == marketBetType.SESSION) {
          betResult.session[item.betId + '_' + item?.user?.id] = [itemData];
        }
        else if (item.marketBetType == marketBetType.MATCHBETTING) {
          betResult.match[item.betId + '_' + item?.user?.id] = [itemData];
        }
      }
    }
    for (const placedBet of Object.keys(betResult.session)) {
      const betPlaceProfitLoss = await this.calculatePLAllBet(betResult.session[placedBet], betResult?.session?.[placedBet]?.[0]?.marketType, 100, null, null, matchIdDetail[betResult?.session?.[placedBet]?.[0]?.matchId]);
      sessionResult[`${placedBet}`] = {
        upperLimitOdds: betPlaceProfitLoss?.betData?.[betPlaceProfitLoss?.betData?.length - 1]?.odds,
        lowerLimitOdds: betPlaceProfitLoss?.betData?.[0]?.odds,
        betPlaced: betPlaceProfitLoss?.betData,
        maxLoss: betPlaceProfitLoss?.maxLoss,
        totalBet: betPlaceProfitLoss?.total_bet,
        betDetails: betResult?.session?.[placedBet]?.[0]
      };
    }
    for (const placedBet of Object.keys(betResult.match)) {
      const matchId = betResult.match[placedBet]?.[0]?.matchId;

      let apiResponse;
      try {
        apiResponse = await getTournamentBettingHandler({ matchId: matchId, id: placedBet.split("_")?.[0] });
      } catch (error) {
        logger.info({
          info: `Error at get match details in login.`
        });
        return;
      }
      let redisData = await this.calculateRatesRacingMatch(betResult.match[placedBet], 100, apiResponse?.data);
      Object.keys(redisData)?.forEach((items) => {
        if (tempData[items]) {
          Object.keys(redisData[items])?.forEach((matchResultData) => {
            tempData[items][matchResultData] += parseFloat(parseFloat(redisData[items]?.[matchResultData]).toFixed(2));
          });
        }
        else {
          tempData[items] = redisData[items];
        }
      });

      matchResult[placedBet] = { data: tempData, betDetails: betResult?.match?.[placedBet]?.[0] };
    }
    return { session: sessionResult, match: matchResult };
  }
}

exports.getQueryColumns = async (user, partnerShipRoleName) => {
  return partnerShipRoleName ? await this.profitLossPercentCol({ roleName: partnerShipRoleName }) : await this.profitLossPercentCol(user);
}


exports.getUpLinePartnerShipCalc = (roleName, user) => {
  return uplinePartnerShipForAllUsers[roleName]?.reduce((sum, field) => sum + (user[`${field}Partnership`] || 0), 0) ?? null;

}

exports.convertToBatches = (n, obj) => Array.from(
  { length: Math.ceil(Object.keys(obj).length / n) },
  (_, i) => Object.fromEntries(Object.entries(obj).slice(i * n, i * n + n))
);