const { In, Not, IsNull, LessThanOrEqual } = require("typeorm");
const { socketData, betType, userRoleConstant, partnershipPrefixByRole, walletDomain, tiedManualTeamName, matchBettingType, redisKeys, marketBetType, expertDomain, matchesTeamName, profitLossKeys, otherEventMatchBettingRedisKey, gameType, racingBettingType, betResultStatus, cardGameType, sessionBettingType, redisTimeOut, jwtSecret, demoRedisTimeOut } = require("../config/contants");
const internalRedis = require("../config/internalRedisConnection");
const { sendMessageToUser } = require("../sockets/socketManager");
const { apiCall, apiMethod, allApiRoutes } = require("../utils/apiService");
const { getBetByUserId, findAllPlacedBetWithUserIdAndBetId, getUserDistinctBets, getBetsWithUserRole, findAllPlacedBet, getMatchBetPlaceWithUserCard, getBetCountData, deleteBet } = require("./betPlacedService");
const { getUserById, getChildsWithOnlyUserRole, getAllUsers, userBlockUnblock, updateUser, userPasswordAttempts, deleteUser, getUser } = require("./userService");
const { logger } = require("../config/logger");
const { __mf } = require("i18n");
const { insertTransactions, deleteTransactions } = require("./transactionService");
const { insertCommissions } = require("./commissionService");
const { CardProfitLoss } = require("./cardService/cardProfitLossCalc");
const { getMatchData } = require("./matchService");
const { updateUserDataRedis } = require("./redis/commonfunction");
const jwt = require("jsonwebtoken");
const { deleteButton } = require("./buttonService");
const { deleteUserBalance } = require("./userBalanceService");

exports.forceLogoutIfLogin = async (userId) => {
  let token = await internalRedis.hget(userId, "token");

  if (token) {
    // function to force logout
    sendMessageToUser(userId, socketData.logoutUserForceEvent, { message: __mf("auth.forceLogout") })
  }
};


exports.forceLogoutUser = async (userId, stopForceLogout) => {

  if (!stopForceLogout) {
    await this.forceLogoutIfLogin(userId);
  }
  await internalRedis.hdel(userId, "token");

};

exports.calculateRate = async (teamRates, data, partnership = 100) => {
  let { teamA, teamB, teamC, winAmount, lossAmount, bettingType, betOnTeam } = data;
  let newTeamRates = {
    teamA: 0,
    teamB: 0,
    teamC: 0,
  }
  if (betOnTeam == teamA && bettingType == betType.BACK) {
    newTeamRates.teamA = teamRates.teamA + ((winAmount * partnership) / 100);
    newTeamRates.teamB = teamRates.teamB - ((lossAmount * partnership) / 100);
    newTeamRates.teamC = teamRates.teamC - (teamC ? ((lossAmount * partnership) / 100) : 0);
  }
  else if (betOnTeam == teamA && bettingType == betType.LAY) {
    newTeamRates.teamA = teamRates.teamA - ((lossAmount * partnership) / 100);
    newTeamRates.teamB = teamRates.teamB + ((winAmount * partnership) / 100);
    newTeamRates.teamC = teamRates.teamC + (teamC ? ((winAmount * partnership) / 100) : 0);
  }
  else if (betOnTeam == teamB && bettingType == betType.BACK) {
    newTeamRates.teamB = teamRates.teamB + ((winAmount * partnership) / 100);
    newTeamRates.teamA = teamRates.teamA - ((lossAmount * partnership) / 100);
    newTeamRates.teamC = teamRates.teamC - (teamC ? ((lossAmount * partnership) / 100) : 0);
  }
  else if (betOnTeam == teamB && bettingType == betType.LAY) {
    newTeamRates.teamB = teamRates.teamB - ((lossAmount * partnership) / 100);
    newTeamRates.teamA = teamRates.teamA + ((winAmount * partnership) / 100);
    newTeamRates.teamC = teamRates.teamC + (teamC ? ((winAmount * partnership) / 100) : 0);
  }
  else if (teamC && betOnTeam == teamC && bettingType == betType.BACK) {
    newTeamRates.teamA = teamRates.teamA - ((lossAmount * partnership) / 100);
    newTeamRates.teamB = teamRates.teamB - ((lossAmount * partnership) / 100);
    newTeamRates.teamC = teamRates.teamC + ((winAmount * partnership) / 100);
  }
  else if (teamC && betOnTeam == teamC && bettingType == betType.LAY) {
    newTeamRates.teamA = teamRates.teamA + ((winAmount * partnership) / 100);
    newTeamRates.teamB = teamRates.teamB + ((winAmount * partnership) / 100);
    newTeamRates.teamC = teamRates.teamC - ((lossAmount * partnership) / 100);
  }

  newTeamRates = {
    teamA: Number(newTeamRates.teamA.toFixed(2)),
    teamB: Number(newTeamRates.teamB.toFixed(2)),
    teamC: Number(newTeamRates.teamC.toFixed(2))
  }
  return newTeamRates;
}

exports.calculateExpertRate = async (teamRates, data, partnership = 100) => {
  let { teamA, teamB, teamC, winAmount, lossAmount, bettingType, betOnTeam } = data;
  let newTeamRates = {
    teamA: 0,
    teamB: 0,
    teamC: 0,
  }
  if (betOnTeam == teamA && bettingType == betType.BACK) {
    newTeamRates.teamA = teamRates.teamA - ((winAmount * partnership) / 100);
    newTeamRates.teamB = teamRates.teamB + ((lossAmount * partnership) / 100);
    newTeamRates.teamC = teamRates.teamC + (teamC ? ((lossAmount * partnership) / 100) : 0);
  }
  else if (betOnTeam == teamA && bettingType == betType.LAY) {
    newTeamRates.teamA = teamRates.teamA + ((lossAmount * partnership) / 100);
    newTeamRates.teamB = teamRates.teamB - ((winAmount * partnership) / 100);
    newTeamRates.teamC = teamRates.teamC - (teamC ? ((winAmount * partnership) / 100) : 0);
  }
  else if (betOnTeam == teamB && bettingType == betType.BACK) {
    newTeamRates.teamB = teamRates.teamB - ((winAmount * partnership) / 100);
    newTeamRates.teamA = teamRates.teamA + ((lossAmount * partnership) / 100);
    newTeamRates.teamC = teamRates.teamC + (teamC ? ((lossAmount * partnership) / 100) : 0);
  }
  else if (betOnTeam == teamB && bettingType == betType.LAY) {
    newTeamRates.teamB = teamRates.teamB + ((lossAmount * partnership) / 100);
    newTeamRates.teamA = teamRates.teamA - ((winAmount * partnership) / 100);
    newTeamRates.teamC = teamRates.teamC - (teamC ? ((winAmount * partnership) / 100) : 0);
  }
  else if (teamC && betOnTeam == teamC && bettingType == betType.BACK) {
    newTeamRates.teamA = teamRates.teamA + ((lossAmount * partnership) / 100);
    newTeamRates.teamB = teamRates.teamB + ((lossAmount * partnership) / 100);
    newTeamRates.teamC = teamRates.teamC - ((winAmount * partnership) / 100);
  }
  else if (teamC && betOnTeam == teamC && bettingType == betType.LAY) {
    newTeamRates.teamA = teamRates.teamA - ((winAmount * partnership) / 100);
    newTeamRates.teamB = teamRates.teamB - ((winAmount * partnership) / 100);
    newTeamRates.teamC = teamRates.teamC + ((lossAmount * partnership) / 100);
  }

  newTeamRates = {
    teamA: Number(newTeamRates.teamA.toFixed(2)),
    teamB: Number(newTeamRates.teamB.toFixed(2)),
    teamC: Number(newTeamRates.teamC.toFixed(2))
  }
  return newTeamRates;
}

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

  let betProfitloss = redisProfitLoss?.betPlaced ?? [];

  // Adjust betPlaced based on lower limit changes
  if (redisProfitLoss?.lowerLimitOdds > lowerLimit) {
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
  if (upperLimit > redisProfitLoss?.upperLimitOdds) {
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
  maxLoss = Number(maxLoss.toFixed(2));
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
  /**
   * Calculates the profit or loss for a specific bet at given odds.
   * @param {object} betData - Data for the current bet.
   * @param {number} odds - Odds for the current bet.
   * @returns {number} - Profit or loss amount.
   */
  let maxLoss = 0;


  // Calculate lower and upper limits
  const lowerLimit = 1;

  const upperLimit = parseFloat(
    betData?.betPlacedData?.odds + parseInt(betData?.betPlacedData?.eventName?.split("-").pop()) + 9 >
      (redisProfitLoss?.upperLimitOdds ?? betData?.betPlacedData?.odds + parseInt(betData?.betPlacedData?.eventName?.split("-").pop()) + 9)
      ? betData?.betPlacedData?.odds + parseInt(betData?.betPlacedData?.eventName?.split("-").pop()) + 9
      : redisProfitLoss?.upperLimitOdds ?? betData?.betPlacedData?.odds + parseInt(betData?.betPlacedData?.eventName?.split("-").pop()) + 9
  );

  let betProfitloss = redisProfitLoss?.betPlaced ?? [];

  // Adjust betPlaced based on lower limit changes
  if (redisProfitLoss?.lowerLimitOdds > lowerLimit) {
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
  if (upperLimit > redisProfitLoss?.upperLimitOdds) {
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
  maxLoss = Number(maxLoss.toFixed(2));
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

  let betProfitloss = redisProfitLoss?.betPlaced ?? [];

  // Adjust betPlaced based on upper limit changes
  if (upperLimit > redisProfitLoss?.upperLimitOdds) {
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
  maxLoss = Number(maxLoss.toFixed(2));
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
      betProfitloss[item] = (betProfitloss[item] || 0) + (betData?.winAmount * partnership / 100);
    }
    else {
      betProfitloss[item] = (betProfitloss[item] || 0) - (betData?.lossAmount * partnership / 100);
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
  let isPartnership = userPartnerShip != 100;
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
          profitLoss += isWinningBet ? (((parseFloat(bet.amount)*parseFloat(bet.rate)/100) * Math.abs(j - parseInt(bet.odds))) * partnership / 100) : (-((parseFloat(bet.amount)*parseFloat(bet.rate)/100) * Math.abs(j - parseInt(bet.odds))) * partnership / 100);
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


exports.calculateRatesMatch = async (betPlace, partnerShip = 100, matchData) => {
  let teamARate = 0;
  let teamBRate = 0;
  let teamCRate = 0;

  let teamNoRateTie = 0;
  let teamYesRateTie = 0;

  let teamNoRateComplete = 0;
  let teamYesRateComplete = 0;

  for (let placedBets of betPlace) {
    let isTiedOrCompMatch = [matchBettingType.tiedMatch1, matchBettingType.tiedMatch2, matchBettingType.completeMatch, matchBettingType.completeManual, matchBettingType.tiedMatch3, matchBettingType.completeMatch1].includes(placedBets?.marketType);
    let isTiedMatch = [matchBettingType.tiedMatch1, matchBettingType.tiedMatch2, matchBettingType.tiedMatch3].includes(placedBets?.marketType);
    let isCompleteMatch = [matchBettingType.completeMatch, matchBettingType.completeMatch1, matchBettingType.completeManual].includes(placedBets?.marketType);

    let calculatedRates = await this.calculateRate({
      teamA: isTiedMatch ? teamYesRateTie : isCompleteMatch ? teamYesRateComplete : teamARate,
      teamB: isTiedMatch ? teamNoRateTie : isCompleteMatch ? teamNoRateComplete : teamBRate,
      ...(matchData?.teamC && !isTiedOrCompMatch ? { teamC: teamCRate } : { teamC: 0 }),
    },
      {
        teamA: isTiedOrCompMatch ? tiedManualTeamName.yes : matchData?.teamA,
        teamB: isTiedOrCompMatch ? tiedManualTeamName.no : matchData?.teamB,
        teamC: isTiedOrCompMatch ? null : matchData?.teamC,
        winAmount: placedBets?.winAmount,
        lossAmount: placedBets?.lossAmount,
        bettingType: placedBets?.betType,
        betOnTeam: placedBets?.teamName
      },
      partnerShip);

    if (isTiedMatch) {
      teamYesRateTie = calculatedRates.teamA;
      teamNoRateTie = calculatedRates.teamB;
    }
    else if (isCompleteMatch) {
      teamYesRateComplete = calculatedRates.teamA;
      teamNoRateComplete = calculatedRates.teamB;
    }
    else {
      teamARate = calculatedRates.teamA;
      teamBRate = calculatedRates.teamB;
      teamCRate = calculatedRates.teamC;
    }
  }

  return { teamARate, teamBRate, teamCRate, teamNoRateTie, teamYesRateTie, teamNoRateComplete, teamYesRateComplete };
}

exports.calculateRatesOtherMatch = async (betPlace, partnerShip = 100, matchData, matchBetting) => {
  let teamRates = {};

  for (let placedBets of betPlace) {
    const betType = placedBets?.marketType;
    let profitLossKey;
    if (betType == matchBettingType.other) {
      profitLossKey = profitLossKeys[betType] + placedBets?.betId;
    }
    else{
      profitLossKey = profitLossKeys[betType];
    }
    const teamRate = teamRates[profitLossKey] || { rates: {} };

    let calculatedRates = await this.calculateRate(
      {
        teamA: teamRate?.rates?.a || 0,
        teamB: teamRate?.rates?.b || 0,
        teamC: matchData?.teamC && !matchesTeamName[betType] ? (teamRate?.rates?.c || 0) : 0,
      },
      {
        teamA: matchesTeamName[betType]?.a ?? matchBetting?.metaData?.teamA ?? matchData?.teamA,
        teamB: matchesTeamName[betType]?.b ?? matchBetting?.metaData?.teamB ?? matchData?.teamB,
        teamC: matchBetting?.metaData?.teamC ? matchBetting?.metaData?.teamC : !matchesTeamName[betType] ? matchData?.teamC : matchesTeamName[betType]?.c,
        winAmount: placedBets?.winAmount,
        lossAmount: placedBets?.lossAmount,
        bettingType: placedBets?.betType,
        betOnTeam: placedBets?.teamName
      },
      partnerShip
    );

    teamRates[profitLossKey] = {
      rates: {
        ...teamRate.rates,
        a: calculatedRates.teamA,
        b: calculatedRates.teamB,
        ...(matchData?.teamC && !matchesTeamName[betType] ? { c: calculatedRates.teamC } : {}),
      },
      type: betType,
      betId: placedBets?.betId
    };
  }

  return teamRates;
}

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

exports.calculateProfitLossForSessionToResult = async (betId, userId) => {
  let betPlace = await findAllPlacedBetWithUserIdAndBetId(userId, betId);
  const matchDetail = await getMatchData({ id: betPlace?.[0]?.matchId }, ["id", "teamC"]);
  let redisData = await this.calculatePLAllBet(betPlace, betPlace?.[0]?.marketType, 100, null, null, matchDetail);
  return redisData;
}

exports.calculateProfitLossForMatchToResult = async (betId, userId, matchData) => {
  let betPlace = await findAllPlacedBetWithUserIdAndBetId(userId, In(betId));
  let redisData = await this.calculateRatesMatch(betPlace, 100, matchData);
  return redisData;
}

exports.calculateProfitLossForOtherMatchToResult = async (betId, userId, matchData, matchBetting) => {
  let betPlace = await findAllPlacedBetWithUserIdAndBetId(userId, In(betId));
  let redisData = await this.calculateRatesOtherMatch(betPlace, 100, matchData, matchBetting);
  return redisData;
}

exports.calculateProfitLossForRacingMatchToResult = async (betId, userId, matchData) => {
  let betPlace = await findAllPlacedBetWithUserIdAndBetId(userId, In(betId));
  let redisData = await this.calculateRatesRacingMatch(betPlace, 100, matchData);
  return redisData;
}

exports.calculateProfitLossForCardMatchToResult = async (userId, runnerId, type, partnership, isPending) => {
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

    const data = new CardProfitLoss(type, oldPl.profitLoss[`${runnerId}_${sid}${redisKeys.card}`], { bettingType: bets?.betType, winAmount: bets.winAmount, lossAmount: bets.lossAmount, playerName: bets?.teamName, partnership: bets?.user?.[partnership] || 100, sid: sid }, (oldPl?.exposure || 0)).getCardGameProfitLoss();
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
            profitLoss: newbetPlaced[0].profitLoss,
          };
          newbetPlaced.unshift(newEntry);
        }
      }
      if (newbetPlaced[0].odds < oldbetPlaced[0].odds) {
        while (newbetPlaced[0].odds != oldbetPlaced[0].odds) {
          const newEntry = {
            odds: oldbetPlaced[0].odds - 1,
            profitLoss: oldbetPlaced[0].profitLoss,
          };
          oldbetPlaced.unshift(newEntry);
        }
      }

      if (newbetPlaced[newbetPlaced.length - 1].odds > oldbetPlaced[oldbetPlaced.length - 1].odds) {
        while (newbetPlaced[newbetPlaced.length - 1].odds != oldbetPlaced[oldbetPlaced.length - 1].odds) {
          const newEntry = {
            odds: oldbetPlaced[oldbetPlaced.length - 1].odds + 1,
            profitLoss: oldbetPlaced[oldbetPlaced.length - 1].profitLoss,
          };
          oldbetPlaced.push(newEntry);
        }
      }
      if (newbetPlaced[newbetPlaced.length - 1].odds < oldbetPlaced[oldbetPlaced.length - 1].odds) {
        while (newbetPlaced[newbetPlaced.length - 1].odds != oldbetPlaced[oldbetPlaced.length - 1].odds) {
          const newEntry = {
            odds: newbetPlaced[newbetPlaced.length - 1].odds + 1,
            profitLoss: newbetPlaced[newbetPlaced.length - 1].profitLoss,
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
            let response = await apiCall(
              apiMethod.get,
              walletDomain + allApiRoutes.EXPERT.partnershipId + currentUser.id
            ).catch((err) => {
              throw err?.response?.data;
            });
            await traverseHierarchy(
              response?.data?.find(
                (item) => (item?.roleName == userRoleConstant.fairGameAdmin && response?.data?.length == 2) || (item?.roleName == userRoleConstant.fairGameWallet && response?.data?.length == 1)
              ),
              response?.data
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
exports.settingBetsDataAtLogin = async (user) => {
  if (user.roleName == userRoleConstant.user) {
    const bets = await getUserDistinctBets(user.id, { eventType: In([gameType.cricket, gameType.politics]), marketType: Not(matchBettingType.tournament) });
    let sessionResult = {};
    let sessionExp = {};
    let matchResult = {};
    let matchExposure = {};
    for (let currBets of bets) {
      if (currBets.marketBetType == marketBetType.SESSION) {
        let result = await this.calculateProfitLossForSessionToResult(currBets.betId, user.id);
        sessionResult[`${currBets.betId}${redisKeys.profitLoss}`] = {
          maxLoss: result.maxLoss,
          betPlaced: result.betData,
          totalBet: result.total_bet
        };
        if(result.upperLimitOdds){
          sessionResult[`${currBets.betId}${redisKeys.profitLoss}`].upperLimitOdds = result.upperLimitOdds;
        }
        if(result.lowerLimitOdds){
          sessionResult[`${currBets.betId}${redisKeys.profitLoss}`].lowerLimitOdds = result.lowerLimitOdds;
        }
        sessionExp[`${redisKeys.userSessionExposure}${currBets.matchId}`] = parseFloat((parseFloat(sessionExp[`${redisKeys.userSessionExposure}${currBets.matchId}`] || 0) + result.maxLoss).toFixed(2));
      }
      else {
        let apiResponse;
        try {
          let url = expertDomain + allApiRoutes.MATCHES.MatchBettingDetail + currBets.matchId + "?type=" + currBets?.marketType + "&id=" + currBets?.betId;
          apiResponse = await apiCall(apiMethod.get, url);
        } catch (error) {
          logger.info({
            info: `Error at get match details in login.`
          });
          return;
        }

        let redisData = await this.calculateProfitLossForOtherMatchToResult([currBets.betId], user.id, apiResponse?.data?.match, apiResponse?.data?.matchBetting);
        let maxLoss;
        Object.values(redisData)?.forEach((plData) => {
          maxLoss += Math.abs(Math.min(...Object.values(plData?.rates), 0));

          matchResult = {
            ...matchResult,
            [`${otherEventMatchBettingRedisKey[plData?.type].a}${plData?.type == matchBettingType?.other ? plData?.betId + "_" : ""}${currBets.matchId}`]: plData?.rates?.a + (matchResult?.[`${otherEventMatchBettingRedisKey[plData?.type].a}${plData?.type == matchBettingType?.other ? plData?.betId + "_"  : ""}${currBets.matchId}`] || 0),
            [`${otherEventMatchBettingRedisKey[plData?.type].b}${plData?.type == matchBettingType?.other ? plData?.betId + "_" : ""}${currBets.matchId}`]: plData?.rates?.b + (matchResult?.[`${otherEventMatchBettingRedisKey[plData?.type].b}${plData?.type == matchBettingType?.other ? plData?.betId + "_" : ""}${currBets.matchId}`] || 0),
            ...(plData?.rates?.c ? { [`${otherEventMatchBettingRedisKey[plData?.type].c}${plData?.type == matchBettingType?.other ? plData?.betId+ "_"  : ""}${currBets.matchId}`]: plData?.rates?.c + (matchResult?.[`${otherEventMatchBettingRedisKey[plData?.type].c}${plData?.type == matchBettingType?.other ? plData?.betId+ "_" : ""}${currBets.matchId}`] || 0) } : {}),
          }
        });

        matchExposure[`${redisKeys.userMatchExposure}${currBets.matchId}`] = parseFloat((parseFloat(matchExposure[`${redisKeys.userMatchExposure}${currBets.matchId}`] || 0) + maxLoss).toFixed(2));  
      }

    }
    Object.keys(sessionResult)?.forEach((item) => {
      sessionResult[item] = JSON.stringify(sessionResult[item]);
    });
    return {
      ...matchExposure, ...matchResult, ...sessionExp, ...sessionResult
    }
  }
  else {
    const users = await getChildsWithOnlyUserRole(user.id);
    let sessionResult = {};
    let sessionExp = {};
    let betResult = {
      session: {},
      match: {}
    };

    let matchResult = {};
    let matchExposure = {};
    const matchIdDetail = {};
    const bets = await getBetsWithUserRole(users?.map((item) => item.id), { eventType: In([gameType.cricket, gameType.politics]), marketType: Not(matchBettingType.tournament) });
    for (let item of bets) {

      let itemData = {
        ...item,
        winAmount: -parseFloat((parseFloat(item.winAmount) * parseFloat(item?.user?.[`${partnershipPrefixByRole[user.roleName]}Partnership`]) / 100).toFixed(2)),
        lossAmount: -parseFloat((parseFloat(item.lossAmount) * parseFloat(item?.user?.[`${partnershipPrefixByRole[user.roleName]}Partnership`]) / 100).toFixed(2))
      };
      if (betResult.session[item.betId] || betResult.match[item.betId]) {
        if (item.marketBetType == marketBetType.SESSION) {
          if (!matchIdDetail[item?.matchId]) {
            matchIdDetail[item?.matchId] = await getMatchData({ id: item?.matchId }, ["id", "teamC"]);
          }
          betResult.session[item.betId].push(itemData);
        }
        else {
          betResult.match[item.betId].push(itemData);

        }
      }
      else {

        if (item.marketBetType == marketBetType.SESSION) {
          if (!matchIdDetail[item?.matchId]) {
            matchIdDetail[item?.matchId] = await getMatchData({ id: item?.matchId }, ["id", "teamC"]);
          }
          betResult.session[item.betId] = [itemData];
        }
        else {
          betResult.match[item.betId] = [itemData];

        }
      }
    }
    for (const placedBet of Object.keys(betResult.session)) {

      const betPlaceProfitLoss = await this.calculatePLAllBet(betResult.session[placedBet], betResult?.session?.[placedBet]?.[0]?.marketType, 100, null, null, matchIdDetail[betResult?.session?.[placedBet]?.[0]?.matchId]);
      sessionResult[`${placedBet}${redisKeys.profitLoss}`] = {
        upperLimitOdds: betPlaceProfitLoss?.betData?.[betPlaceProfitLoss?.betData?.length - 1]?.odds,
        lowerLimitOdds: betPlaceProfitLoss?.betData?.[0]?.odds,
        betPlaced: betPlaceProfitLoss?.betData,
        maxLoss: betPlaceProfitLoss?.maxLoss,
        totalBet: betPlaceProfitLoss?.total_bet
      };
      sessionExp[`${redisKeys.userSessionExposure}${betResult.session[placedBet]?.[0]?.matchId}`] = parseFloat((parseFloat(sessionExp[`${redisKeys.userSessionExposure}${betResult.session[placedBet]?.[0]?.matchId}`] || 0) + sessionResult?.[`${placedBet}${redisKeys.profitLoss}`].maxLoss).toFixed(2));

    }

    for (const placedBet of Object.keys(betResult.match)) {
      const matchId = betResult.match[placedBet]?.[0]?.matchId;

      let apiResponse;
      try {
        let url = expertDomain + allApiRoutes.MATCHES.MatchBettingDetail + matchId + "?type=" + betResult?.match[placedBet]?.[0]?.marketType + "&id=" + placedBet;
        apiResponse = await apiCall(apiMethod.get, url);
      } catch (error) {
        logger.info({
          info: `Error at get match details in login.`
        });
        return;
      }
      let redisData = await this.calculateRatesOtherMatch(betResult.match[placedBet], 100, apiResponse?.data?.match, apiResponse?.data?.matchBetting);
      let maxLoss;
      Object.values(redisData)?.forEach((plData) => {
        maxLoss += Math.abs(Math.min(...Object.values(plData?.rates), 0));

        matchResult = {
          ...matchResult,
          [`${otherEventMatchBettingRedisKey[plData?.type].a}${plData?.type == matchBettingType?.other ? plData?.betId + "_"  : ""}${matchId}`]: plData?.rates?.a + (matchResult?.[`${otherEventMatchBettingRedisKey[plData?.type].a}${plData?.type == matchBettingType?.other ? plData?.betId + "_"  : ""}${matchId}`] || 0),
          [`${otherEventMatchBettingRedisKey[plData?.type].b}${plData?.type == matchBettingType?.other ? plData?.betId + "_" : ""}${matchId}`]: plData?.rates?.b + (matchResult?.[`${otherEventMatchBettingRedisKey[plData?.type].b}${plData?.type == matchBettingType?.other ? plData?.betId + "_"  : ""}${matchId}`] || 0),
          ...(plData?.rates?.c ? { [`${otherEventMatchBettingRedisKey[plData?.type].c}${plData?.type == matchBettingType?.other ? plData?.betId + "_"  : ""}${matchId}`]: plData?.rates?.c + (matchResult?.[`${otherEventMatchBettingRedisKey[plData?.type].c}${plData?.type == matchBettingType?.other ? plData?.betId + "_" : ""}${matchId}`] || 0) } : {}),
        }
      });

      matchExposure[`${redisKeys.userMatchExposure}${matchId}`] = parseFloat((parseFloat(matchExposure[`${redisKeys.userMatchExposure}${matchId}`] || 0) + maxLoss).toFixed(2));  
    }
    Object.keys(sessionResult)?.forEach((item) => {
      sessionResult[item] = JSON.stringify(sessionResult[item]);
    });
    return {
      ...matchExposure, ...matchResult, ...sessionExp, ...sessionResult
    }
  }
}

exports.settingTournamentMatchBetsDataAtLogin = async (user) => {
  if (user.roleName == userRoleConstant.user) {
    const bets = await getUserDistinctBets(user.id, { marketType: matchBettingType.tournament });

    let matchResult = {};
    let matchExposure = {};
    for (let currBets of bets) {

      let apiResponse;
      try {
        let url = expertDomain + allApiRoutes.MATCHES.tournamentBettingDetail + currBets.matchId + "?type=" + matchBettingType.tournament + "&id=" + currBets?.betId;
        apiResponse = await apiCall(apiMethod.get, url);
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
        redisData[key] = JSON.stringify(redisData[key]);
      });

      matchResult = {
        ...matchResult,
        ...redisData
      }

      matchExposure[`${redisKeys.userMatchExposure}${currBets.matchId}`] = parseFloat((parseFloat(matchExposure[`${redisKeys.userMatchExposure}${currBets.matchId}`] || 0) + maxLoss).toFixed(2));

    }
    return {
      ...matchExposure, ...matchResult
    }
  }
  else {
    const users = await getChildsWithOnlyUserRole(user.id);

    let betResult = { match: {} };

    let matchResult = {};
    let matchExposure = {};

    const bets = await getBetsWithUserRole(users?.map((item) => item.id), {  marketType: matchBettingType.tournament });
    for(let item of bets){
      let itemData = {
        ...item,
        winAmount: -parseFloat((parseFloat(item.winAmount) * parseFloat(item?.user?.[`${partnershipPrefixByRole[user.roleName]}Partnership`]) / 100).toFixed(2)),
        lossAmount: -parseFloat((parseFloat(item.lossAmount) * parseFloat(item?.user?.[`${partnershipPrefixByRole[user.roleName]}Partnership`]) / 100).toFixed(2))
      };
      if (betResult.match[item.betId]) {
        betResult.match[item.betId].push(itemData);
      }
      else {
        betResult.match[item.betId] = [itemData];
      }
    }

    for (const placedBet of Object.keys(betResult.match)) {
      const matchId = betResult.match[placedBet]?.[0]?.matchId;

      let apiResponse;
      try {
        let url = expertDomain + allApiRoutes.MATCHES.tournamentBettingDetail + matchId + "?type=" + matchBettingType.tournament + "&id=" + placedBet;
        apiResponse = await apiCall(apiMethod.get, url);
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
      matchResult[key] = JSON.stringify(matchResult[key]);
    });
    return {
      ...matchExposure, ...matchResult
    }
  }
}

exports.settingOtherMatchBetsDataAtLogin = async (user) => {
  if (user.roleName == userRoleConstant.user) {
    const bets = await getUserDistinctBets(user.id, { eventType: In([gameType.tennis, gameType.football]), marketType: Not(matchBettingType.tournament) });
    let sessionResult = {};
    let sessionExp = {};
    let matchResult = {};
    let matchExposure = {};
    for (let currBets of bets) {
      if (currBets.marketBetType == marketBetType.SESSION) {
        let result = await this.calculateProfitLossForSessionToResult(currBets.betId, user.id);
        sessionResult[`${currBets.betId}${redisKeys.profitLoss}`] = {
          maxLoss: result.maxLoss,
          upperLimitOdds: result.upperLimitOdds,
          lowerLimitOdds: result.lowerLimitOdds,
          betPlaced: result.betData,
          totalBet: result.total_bet
        };
        sessionExp[`${redisKeys.userSessionExposure}${currBets.matchId}`] = parseFloat((parseFloat(sessionExp[`${redisKeys.userSessionExposure}${currBets.matchId}`] || 0) + result.maxLoss).toFixed(2));
      }
      else {
        let apiResponse;
        try {
          let url = expertDomain + allApiRoutes.MATCHES.MatchBettingDetail + currBets.matchId + "?type=" + matchBettingType.quickbookmaker1;
          apiResponse = await apiCall(apiMethod.get, url);
        } catch (error) {
          logger.info({
            info: `Error at get match details in login.`
          });
          return;
        }

        let redisData = await this.calculateProfitLossForOtherMatchToResult([currBets.betId], user.id, apiResponse?.data?.match);
        let maxLoss;
        Object.values(redisData)?.forEach((plData) => {
          maxLoss += Math.abs(Math.min(...Object.values(plData?.rates), 0));

          matchResult = {
            ...matchResult,
            [otherEventMatchBettingRedisKey[plData?.type].a + currBets.matchId]: plData?.rates?.a + (matchResult?.[otherEventMatchBettingRedisKey[plData?.type]?.a + currBets.matchId] || 0),
            [otherEventMatchBettingRedisKey[plData?.type].b + currBets.matchId]: plData?.rates?.b + (matchResult?.[otherEventMatchBettingRedisKey[plData?.type]?.b + currBets.matchId] || 0),
            ...(plData?.rates?.c ? { [otherEventMatchBettingRedisKey[plData?.type].c + currBets.matchId]: plData?.rates?.c + (matchResult?.[otherEventMatchBettingRedisKey[plData?.type]?.c + currBets.matchId] || 0) } : {}),
          }
        });


        matchExposure[`${redisKeys.userMatchExposure}${currBets.matchId}`] = parseFloat((parseFloat(matchExposure[`${redisKeys.userMatchExposure}${currBets.matchId}`] || 0) + maxLoss).toFixed(2));
      }

    }
    Object.keys(sessionResult)?.forEach((item) => {
      sessionResult[item] = JSON.stringify(sessionResult[item]);
    });
    return {
      ...matchExposure, ...matchResult, ...sessionExp, ...sessionResult
    }
  }
  else {
    const users = await getChildsWithOnlyUserRole(user.id);
    let sessionResult = {};
    let sessionExp = {};
    let betResult = {
      session: {

      },
      match: {

      }
    };

    let matchResult = {};
    let matchExposure = {};

    const bets = await getBetsWithUserRole(users?.map((item) => item.id), { eventType: In([gameType.tennis, gameType.football]), marketType: Not(matchBettingType.tournament) });
    for (let item of bets) {

      let itemData = {
        ...item,
        winAmount: -parseFloat((parseFloat(item.winAmount) * parseFloat(item?.user?.[`${partnershipPrefixByRole[user.roleName]}Partnership`]) / 100).toFixed(2)),
        lossAmount: -parseFloat((parseFloat(item.lossAmount) * parseFloat(item?.user?.[`${partnershipPrefixByRole[user.roleName]}Partnership`]) / 100).toFixed(2))
      };
      if (betResult.session[item.betId] || betResult.match[item.betId]) {
        if (item.marketBetType == marketBetType.SESSION) {
          if (!matchIdDetail[item?.matchId]) {
            matchIdDetail[item?.matchId] = await getMatchData({ id: item?.matchId }, ["id", "teamC"]);
          }
          betResult.session[item.betId].push(itemData);
        }
        else {
          betResult.match[item.betId].push(itemData);

        }
      }
      else {

        if (item.marketBetType == marketBetType.SESSION) {
          if (!matchIdDetail[item?.matchId]) {
            matchIdDetail[item?.matchId] = await getMatchData({ id: item?.matchId }, ["id", "teamC"]);
          }
          betResult.session[item.betId] = [itemData];
        }
        else {
          betResult.match[item.betId] = [itemData];

        }
      }
    }

    for (const placedBet of Object.keys(betResult.session)) {

      const betPlaceProfitLoss = await this.calculatePLAllBet(betResult.session[placedBet], betResult?.session?.[placedBet]?.[0]?.marketType, 100, null, null, matchIdDetail[betResult?.session?.[placedBet]?.[0]?.matchId]);
      sessionResult[`${placedBet}${redisKeys.profitLoss}`] = {
        upperLimitOdds: betPlaceProfitLoss?.betData?.[betPlaceProfitLoss?.betData?.length - 1]?.odds,
        lowerLimitOdds: betPlaceProfitLoss?.betData?.[0]?.odds,
        betPlaced: betPlaceProfitLoss?.betData,
        maxLoss: betPlaceProfitLoss?.maxLoss,
        totalBet: betPlaceProfitLoss?.total_bet
      };
      sessionExp[`${redisKeys.userSessionExposure}${betResult.session[placedBet]?.[0]?.matchId}`] = parseFloat((parseFloat(sessionExp[`${redisKeys.userSessionExposure}${betResult.session[placedBet]?.[0]?.matchId}`] || 0) + sessionResult?.[`${placedBet}${redisKeys.profitLoss}`].maxLoss).toFixed(2));

    }

    for (const placedBet of Object.keys(betResult.match)) {
      const matchId = betResult.match[placedBet]?.[0]?.matchId;

      let apiResponse;
      try {
        let url = expertDomain + allApiRoutes.MATCHES.MatchBettingDetail + matchId + "?type=" + matchBettingType.quickbookmaker1;
        apiResponse = await apiCall(apiMethod.get, url);
      } catch (error) {
        logger.info({
          info: `Error at get match details in login.`
        });
        return;
      }
      let redisData = await this.calculateRatesOtherMatch(betResult.match[placedBet], 100, apiResponse?.data?.match);
      let maxLoss;
      Object.values(redisData)?.forEach((plData) => {
        maxLoss += Math.abs(Math.min(...Object.values(plData?.rates), 0));

        matchResult = {
          ...matchResult,
          [otherEventMatchBettingRedisKey[plData?.type]?.a + matchId]: plData?.rates?.a + (matchResult?.[otherEventMatchBettingRedisKey[plData?.type]?.a + matchId] || 0),
          [otherEventMatchBettingRedisKey[plData?.type]?.b + matchId]: plData?.rates?.b + (matchResult?.[otherEventMatchBettingRedisKey[plData?.type]?.b + matchId] || 0),
          ...(plData?.rates?.c ? { [otherEventMatchBettingRedisKey[plData?.type].c + matchId]: plData?.rates?.c + (matchResult?.[otherEventMatchBettingRedisKey[plData?.type]?.c + matchId] || 0) } : {}),
        }
      });
      matchExposure[`${redisKeys.userMatchExposure}${matchId}`] = parseFloat((parseFloat(matchExposure[`${redisKeys.userMatchExposure}${matchId}`] || 0) + maxLoss).toFixed(2));

    }
    Object.keys(sessionResult)?.forEach((item) => {
      sessionResult[item] = JSON.stringify(sessionResult[item]);
    });
    return {
      ...matchExposure, ...matchResult, ...sessionExp, ...sessionResult
    }
  }
}

exports.settingRacingMatchBetsDataAtLogin = async (user) => {
  if (user.roleName == userRoleConstant.user) {
    const bets = await getUserDistinctBets(user.id, { eventType: In([gameType.horseRacing, gameType.greyHound]) });

    let matchResult = {};
    let matchExposure = {};
    for (let currBets of bets) {

      let apiResponse;
      try {
        let url = expertDomain + allApiRoutes.MATCHES.raceBettingDetail + currBets.matchId + "?type=" + racingBettingType.matchOdd;
        apiResponse = await apiCall(apiMethod.get, url);
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
        redisData[key] = JSON.stringify(redisData[key]);
      });

      matchResult = {
        ...matchResult,
        ...redisData
      }

      matchExposure[`${redisKeys.userMatchExposure}${currBets.matchId}`] = parseFloat((parseFloat(matchExposure[`${redisKeys.userMatchExposure}${currBets.matchId}`] || 0) + maxLoss).toFixed(2));

    }
    return {
      ...matchExposure, ...matchResult
    }
  }
  else {
    const users = await getChildsWithOnlyUserRole(user.id);

    let betResult = { match: {} };

    let matchResult = {};
    let matchExposure = {};

    const bets = await getBetsWithUserRole(users?.map((item) => item.id), { eventType: In([gameType.horseRacing, gameType.greyHound]) });
    for (let item of bets) {
      let itemData = {
        ...item,
        winAmount: -parseFloat((parseFloat(item.winAmount) * parseFloat(item?.user?.[`${partnershipPrefixByRole[user.roleName]}Partnership`]) / 100).toFixed(2)),
        lossAmount: -parseFloat((parseFloat(item.lossAmount) * parseFloat(item?.user?.[`${partnershipPrefixByRole[user.roleName]}Partnership`]) / 100).toFixed(2))
      };
      if (betResult.match[item.betId]) {
        betResult.match[item.betId].push(itemData);
      }
      else {
        betResult.match[item.betId] = [itemData];
      }
    }

    for (const placedBet of Object.keys(betResult.match)) {
      const matchId = betResult.match[placedBet]?.[0]?.matchId;

      let apiResponse;
      try {
        let url = expertDomain + allApiRoutes.MATCHES.raceBettingDetail + matchId + "?type=" + racingBettingType.matchOdd;
        apiResponse = await apiCall(apiMethod.get, url);
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
      matchResult[key] = JSON.stringify(matchResult[key]);
    });
    return {
      ...matchExposure, ...matchResult
    }
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

  const bets = await getBetsWithUserRole(users?.map((item) => item.id), { matchId: matchId, marketType: In([matchBettingType.bookmaker, matchBettingType.quickbookmaker1, matchBettingType.quickbookmaker2, matchBettingType.quickbookmaker3, matchBettingType.matchOdd]) });
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
      let url = expertDomain + allApiRoutes.MATCHES.MatchBettingDetail + matchId + "?type=" + matchBettingType.quickbookmaker1;
      apiResponse = await apiCall(apiMethod.get, url);
    } catch (error) {
      logger.info({
        info: `Error at get match details in login.`
      });
      return;
    }
    if (apiResponse?.data?.match?.matchType == gameType.cricket) {
      let redisData = await this.calculateRatesMatch(betResult.match[placedBet], 100, apiResponse?.data?.match);

      let teamARate = redisData?.teamARate ?? Number.MAX_VALUE;
      let teamBRate = redisData?.teamBRate ?? Number.MAX_VALUE;
      let teamCRate = redisData?.teamCRate ?? Number.MAX_VALUE;
      matchResult = {
        ...matchResult,
        ...(teamARate != Number.MAX_VALUE && teamARate != null && teamARate != undefined ? { [redisKeys.userTeamARate + matchId]: teamARate + (matchResult[redisKeys.userTeamARate + matchId] || 0) } : {}),
        ...(teamBRate != Number.MAX_VALUE && teamBRate != null && teamBRate != undefined ? { [redisKeys.userTeamBRate + matchId]: teamBRate + (matchResult[redisKeys.userTeamBRate + matchId] || 0) } : {}),
        ...(teamCRate != Number.MAX_VALUE && teamCRate != null && teamCRate != undefined ? { [redisKeys.userTeamCRate + matchId]: teamCRate + (matchResult[redisKeys.userTeamCRate + matchId] || 0) } : {}),
      }
    }
    else {
      let redisData = await this.calculateRatesOtherMatch(betResult.match[placedBet], 100, apiResponse?.data?.match);

      Object.values(redisData)?.forEach((plData) => {

        matchResult = {
          ...matchResult,
          [otherEventMatchBettingRedisKey[plData?.type].a + matchId]: plData?.rates?.a,
          [otherEventMatchBettingRedisKey[plData?.type].b + matchId]: plData?.rates?.b,
          ...(plData?.rates?.c ? { [otherEventMatchBettingRedisKey[plData?.type].c + matchId]: plData?.rates?.c } : {}),
        }
      });
    }
  }
  return {
    ...matchResult
  }
}

exports.getUserProfitLossRacingForUpperLevel = async (user, matchId) => {
  let users = [];
  if (user.roleName == userRoleConstant.fairGameAdmin) {
    users = await getAllUsers({ superParentId: user.id });
  }
  else {
    users = await getChildsWithOnlyUserRole(user.id);
  }
  let betResult = { match: {} };

  let matchResult = {};

  const bets = await getBetsWithUserRole(users?.map((item) => item.id), { matchId: matchId, marketType: In([racingBettingType.matchOdd]) });
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
      let url = expertDomain + allApiRoutes.MATCHES.raceBettingDetail + matchId + "?type=" + racingBettingType.matchOdd;
      apiResponse = await apiCall(apiMethod.get, url);
    } catch (error) {
      logger.info({
        info: `Error at get match details in login.`
      });
      return;
    }
    let redisData = await this.calculateRatesRacingMatch(betResult.match[placedBet], 100, apiResponse?.data);

    Object.keys(redisData)?.forEach((items) => {
      if (matchResult[items]) {
        Object.keys(redisData[items])?.forEach((matchResultData) => {
          matchResult[items][matchResultData] += parseFloat(parseFloat(redisData[items]?.[matchResultData]).toFixed(2));
        });
      }
      else {
        matchResult[items] = redisData[items];
      }
    });
  }
  return {
    ...matchResult
  }
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


exports.transactionPasswordAttempts = async (user) => {
  if (user?.transactionPasswordAttempts + 1 >= 11) {
    await userBlockUnblock(user.id, user.createBy == user.id ? user.superParentId : user.createBy, true);

    if (user?.createBy == user.id) {
      await apiCall(
        apiMethod.post,
        walletDomain + allApiRoutes.WALLET.autoLockUnlockUser,
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
    this.forceLogoutUser(user.id);
    await updateUser(user.id, { transactionPasswordAttempts: 0 });
  }
  else {
    await userPasswordAttempts(user.id);
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
exports.getRedisKeys = (matchBetType, matchId, redisKeys, betId) => {
  let teamArateRedisKey, teamBrateRedisKey, teamCrateRedisKey;

  if (matchBetType === matchBettingType.tiedMatch1 || matchBetType === matchBettingType.tiedMatch3 || matchBetType === matchBettingType.tiedMatch2) {
    teamArateRedisKey = redisKeys.yesRateTie + matchId;
    teamBrateRedisKey = redisKeys.noRateTie + matchId;
    teamCrateRedisKey = null;
  } else if (matchBetType === matchBettingType.completeMatch || matchBetType === matchBettingType.completeMatch1 || matchBetType === matchBettingType.completeManual) {
    teamArateRedisKey = redisKeys.yesRateComplete + matchId;
    teamBrateRedisKey = redisKeys.noRateComplete + matchId;
    teamCrateRedisKey = null;
  }
  else if(matchBetType == matchBettingType.other){
    teamArateRedisKey = redisKeys.userTeamARateOther + betId + "_" + matchId;
    teamBrateRedisKey = redisKeys.userTeamBRateOther + betId + "_" + matchId;
    teamCrateRedisKey = redisKeys.userTeamCRateOther + betId + "_" + matchId;
  }
  else {
    teamArateRedisKey = redisKeys.userTeamARate + matchId;
    teamBrateRedisKey = redisKeys.userTeamBRate + matchId;
    teamCrateRedisKey = redisKeys.userTeamCRate + matchId;
  }

  return { teamArateRedisKey, teamBrateRedisKey, teamCrateRedisKey };
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

exports.extractNumbersFromString = (str) => {
  const matches = str.match(/\d+(\.\d+)?/);
  return matches ? parseFloat(matches[0]) : null;
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
  try{
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
  catch(err){
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
  await deleteUser({ id: In(userIds) });
}