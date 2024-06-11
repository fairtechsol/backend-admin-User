const { In, Not, IsNull } = require("typeorm");
const { socketData, betType, userRoleConstant, partnershipPrefixByRole, walletDomain, tiedManualTeamName, matchBettingType, redisKeys, marketBetType, expertDomain, matchBettingTeamRatesKey, matchesTeamName, profitLossKeys, otherEventMatchBettingRedisKey, gameType, racingBettingType } = require("../config/contants");
const internalRedis = require("../config/internalRedisConnection");
const { sendMessageToUser } = require("../sockets/socketManager");
const { apiCall, apiMethod, allApiRoutes } = require("../utils/apiService");
const { getBetByUserId, findAllPlacedBetWithUserIdAndBetId, getUserDistinctBets, getBetsWithUserRole, findAllPlacedBet } = require("./betPlacedService");
const { getUserById, getChildsWithOnlyUserRole, getAllUsers, userBlockUnblock, updateUser, userPasswordAttempts } = require("./userService");
const { logger } = require("../config/logger");
const { __mf } = require("i18n");
const { insertTransactions } = require("./transactionService");
const { insertCommissions } = require("./commissionService");
const { CardProfitLoss } = require("./cardService/cardProfitLossCalc");

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
        (parseFloat(betData?.loseAmount) * partnership) / 100
      ).toFixed(2)
      : -parseFloat(betData.loseAmount);
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

exports.calculatePLAllBet = async (betPlace, userPartnerShip, oldLowerLimitOdds, oldUpperLimitOdds) => {
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
    let isTiedOrCompMatch = [matchBettingType.tiedMatch1, matchBettingType.tiedMatch2, matchBettingType.completeMatch].includes(placedBets?.marketType);
    let isTiedMatch = [matchBettingType.tiedMatch1, matchBettingType.tiedMatch2].includes(placedBets?.marketType);
    let isCompleteMatch = [matchBettingType.completeMatch, matchBettingType.completeManual].includes(placedBets?.marketType);

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

exports.calculateRatesOtherMatch = async (betPlace, partnerShip = 100, matchData) => {
  let teamRates = {};

  for (let placedBets of betPlace) {
    const betType = placedBets?.marketType;
    const profitLossKey = profitLossKeys[betType];
    const teamRate = teamRates[profitLossKey] || { rates: {} };

    let calculatedRates = await this.calculateRate(
      {
        teamA: teamRate?.rates?.a || 0,
        teamB: teamRate?.rates?.b || 0,
        teamC: matchData?.teamC && !matchesTeamName[betType] ? (teamRate?.rates?.c || 0) : 0,
      },
      {
        teamA: matchesTeamName[betType]?.a ?? matchData?.teamA,
        teamB: matchesTeamName[betType]?.b ?? matchData?.teamB,
        teamC: !matchesTeamName[betType] ? matchData?.teamC : matchesTeamName[betType]?.c,
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
      type: betType
    };
  }

  return teamRates;
}

exports.calculateRatesRacingMatch = async (betPlace, partnerShip = 100, matchData) => {
  let teamRates = {};
  const { runners } = matchData;

  for (let placedBets of betPlace) {
    const matchId=placedBets?.matchId;
    const teamRate = teamRates[`${matchId}${redisKeys.profitLoss}`] || runners.reduce((acc, key) => {
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

    teamRates[`${matchId}${redisKeys.profitLoss}`] = calculatedRates;
  }

  return teamRates;
}

exports.calculateProfitLossForSessionToResult = async (betId, userId) => {
  let betPlace = await findAllPlacedBetWithUserIdAndBetId(userId, betId);
  let redisData = await this.calculatePLAllBet(betPlace, 100);
  return redisData;
}

exports.calculateProfitLossForMatchToResult = async (betId, userId, matchData) => {
  let betPlace = await findAllPlacedBetWithUserIdAndBetId(userId, In(betId));
  let redisData = await this.calculateRatesMatch(betPlace, 100, matchData);
  return redisData;
}

exports.calculateProfitLossForOtherMatchToResult = async (betId, userId, matchData) => {
  let betPlace = await findAllPlacedBetWithUserIdAndBetId(userId, In(betId), { eventType: In([gameType.football, gameType.tennis]) });
  let redisData = await this.calculateRatesOtherMatch(betPlace, 100, matchData);
  return redisData;
}

exports.calculateProfitLossForRacingMatchToResult = async (betId, userId, matchData) => {
  let betPlace = await findAllPlacedBetWithUserIdAndBetId(userId, In(betId), { eventType: In([gameType.horseRacing, gameType.greyHound]) });
  let redisData = await this.calculateRatesRacingMatch(betPlace, 100, matchData);
  return redisData;
}

exports.calculateProfitLossForCardMatchToResult = async (userId, runnerId, type) => {
  let betPlace = await findAllPlacedBet({
    createBy: userId,
    deleteReason: IsNull(),
    runnerId: runnerId
  });
  let oldPl = null;
  for (let bets of betPlace) {
    oldPl = new CardProfitLoss(type, oldPl, { bettingType: bets?.betType, winAmount: bets.winAmount, lossAmount: bets.lossAmount, playerName: bets?.teamName, partnership: 100 }, (oldPl?.exposure || 0)).getCardGameProfitLoss();
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
    const bets = await getUserDistinctBets(user.id, { eventType: "cricket" });
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

        let redisData = await this.calculateProfitLossForMatchToResult([currBets.betId], user.id, apiResponse?.data?.match);
        let teamARate = redisData?.teamARate ?? Number.MAX_VALUE;
        let teamBRate = redisData?.teamBRate ?? Number.MAX_VALUE;
        let teamCRate = redisData?.teamCRate ?? Number.MAX_VALUE;

        let teamNoRateTie = redisData?.teamNoRateTie ?? Number.MAX_VALUE;
        let teamYesRateTie = redisData?.teamYesRateTie ?? Number.MAX_VALUE;

        let teamNoRateComplete = redisData?.teamNoRateComplete ?? Number.MAX_VALUE;
        let teamYesRateComplete = redisData?.teamYesRateComplete ?? Number.MAX_VALUE;
        const matchId = currBets.matchId;
        maxLoss = (Math.abs(Math.min(teamARate, teamBRate, isNaN(teamCRate) ? 0 : teamCRate, 0)) + Math.abs(Math.min(teamNoRateTie, teamYesRateTie, 0)) + Math.abs(Math.min(teamNoRateComplete, teamYesRateComplete, 0))) || 0;
        matchResult = {
          ...matchResult,
          ...(teamARate != Number.MAX_VALUE && teamARate != null && teamARate != undefined ? { [redisKeys.userTeamARate + matchId]: parseFloat(parseFloat((matchResult[redisKeys.userTeamARate + matchId] || 0) + teamARate).toFixed(2)) } : {}),
          ...(teamBRate != Number.MAX_VALUE && teamBRate != null && teamBRate != undefined ? { [redisKeys.userTeamBRate + matchId]: parseFloat(parseFloat((matchResult[redisKeys.userTeamBRate + matchId] || 0) + teamBRate).toFixed(2)) } : {}),
          ...(teamCRate != Number.MAX_VALUE && teamCRate != null && teamCRate != undefined ? { [redisKeys.userTeamCRate + matchId]: parseFloat(parseFloat((matchResult[redisKeys.userTeamCRate + matchId] || 0) + teamCRate).toFixed(2)) } : {}),
          ...(teamYesRateTie != Number.MAX_VALUE && teamYesRateTie != null && teamYesRateTie != undefined ? { [redisKeys.yesRateTie + matchId]: parseFloat(parseFloat((matchResult[redisKeys.yesRateTie + matchId] || 0) + teamYesRateTie).toFixed(2)) } : {}),
          ...(teamNoRateTie != Number.MAX_VALUE && teamNoRateTie != null && teamNoRateTie != undefined ? { [redisKeys.noRateTie + matchId]: parseFloat(parseFloat((matchResult[redisKeys.noRateTie + matchId] || 0) + teamNoRateTie).toFixed(2)) } : {}),
          ...(teamYesRateComplete != Number.MAX_VALUE && teamYesRateComplete != null && teamYesRateComplete != undefined ? { [redisKeys.yesRateComplete + matchId]: parseFloat(parseFloat((matchResult[redisKeys.yesRateComplete + matchId] || 0) + teamYesRateComplete).toFixed(2)) } : {}),
          ...(teamNoRateComplete != Number.MAX_VALUE && teamNoRateComplete != null && teamNoRateComplete != undefined ? { [redisKeys.noRateComplete + matchId]: parseFloat(parseFloat((matchResult[redisKeys.noRateComplete + matchId] || 0) + teamNoRateComplete).toFixed(2)) } : {})
        }
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
      session: { },
      match: { }
    };

    let matchResult = {};
    let matchExposure = {};

    const bets = await getBetsWithUserRole(users?.map((item) => item.id), { eventType: "cricket" });
    bets?.forEach((item) => {
      let itemData = {
        ...item,
        winAmount: -parseFloat((parseFloat(item.winAmount) * parseFloat(item?.user?.[`${partnershipPrefixByRole[user.roleName]}Partnership`]) / 100).toFixed(2)),
        lossAmount: -parseFloat((parseFloat(item.lossAmount) * parseFloat(item?.user?.[`${partnershipPrefixByRole[user.roleName]}Partnership`]) / 100).toFixed(2))
      };
      if (betResult.session[item.betId] || betResult.match[item.betId]) {
        if (item.marketBetType == marketBetType.SESSION) {
          betResult.session[item.betId].push(itemData);
        }
        else {
          betResult.match[item.betId].push(itemData);

        }
      }
      else {

        if (item.marketBetType == marketBetType.SESSION) {
          betResult.session[item.betId] = [itemData];
        }
        else {
          betResult.match[item.betId] = [itemData];

        }
      }
    });

    for (const placedBet of Object.keys(betResult.session)) {

      const betPlaceProfitLoss = await this.calculatePLAllBet(betResult.session[placedBet], 100);
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
      let redisData = await this.calculateRatesMatch(betResult.match[placedBet], 100, apiResponse?.data?.match);

      let teamARate = redisData?.teamARate ?? Number.MAX_VALUE;
      let teamBRate = redisData?.teamBRate ?? Number.MAX_VALUE;
      let teamCRate = redisData?.teamCRate ?? Number.MAX_VALUE;

      let teamNoRateTie = redisData?.teamNoRateTie ?? Number.MAX_VALUE;
      let teamYesRateTie = redisData?.teamYesRateTie ?? Number.MAX_VALUE;

      let teamNoRateComplete = redisData?.teamNoRateComplete ?? Number.MAX_VALUE;
      let teamYesRateComplete = redisData?.teamYesRateComplete ?? Number.MAX_VALUE;
      maxLoss = (Math.abs(Math.min(teamARate, teamBRate, isNaN(teamCRate) ? 0 : teamCRate, 0)) + Math.abs(Math.min(teamNoRateTie, teamYesRateTie, 0)) + Math.abs(Math.min(teamNoRateComplete, teamYesRateComplete, 0))) || 0;
      matchResult = {
        ...matchResult,
        ...(teamARate != Number.MAX_VALUE && teamARate != null && teamARate != undefined ? { [redisKeys.userTeamARate + matchId]: teamARate + (matchResult[redisKeys.userTeamARate + matchId] || 0) } : {}),
        ...(teamBRate != Number.MAX_VALUE && teamBRate != null && teamBRate != undefined ? { [redisKeys.userTeamBRate + matchId]: teamBRate + (matchResult[redisKeys.userTeamBRate + matchId] || 0) } : {}),
        ...(teamCRate != Number.MAX_VALUE && teamCRate != null && teamCRate != undefined ? { [redisKeys.userTeamCRate + matchId]: teamCRate + (matchResult[redisKeys.userTeamCRate + matchId] || 0) } : {}),
        ...(teamYesRateTie != Number.MAX_VALUE && teamYesRateTie != null && teamYesRateTie != undefined ? { [redisKeys.yesRateTie + matchId]: teamYesRateTie + (matchResult[redisKeys.yesRateTie + matchId] || 0) } : {}),
        ...(teamNoRateTie != Number.MAX_VALUE && teamNoRateTie != null && teamNoRateTie != undefined ? { [redisKeys.noRateTie + matchId]: teamNoRateTie + (matchResult[redisKeys.noRateTie + matchId] || 0) } : {}),
        ...(teamYesRateComplete != Number.MAX_VALUE && teamYesRateComplete != null && teamYesRateComplete != undefined ? { [redisKeys.yesRateComplete + matchId]: teamYesRateComplete + (matchResult[redisKeys.yesRateComplete + matchId] || 0) } : {}),
        ...(teamNoRateComplete != Number.MAX_VALUE && teamNoRateComplete != null && teamNoRateComplete != undefined ? { [redisKeys.noRateComplete + matchId]: teamNoRateComplete + (matchResult[redisKeys.noRateComplete + matchId] || 0) } : {})
      }
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

exports.settingOtherMatchBetsDataAtLogin = async (user) => {
  if (user.roleName == userRoleConstant.user) {
    const bets = await getUserDistinctBets(user.id, { eventType: In([gameType.tennis, gameType.football]) });
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
            [otherEventMatchBettingRedisKey[plData?.type].a + currBets.matchId]: plData?.rates?.a,
            [otherEventMatchBettingRedisKey[plData?.type].b + currBets.matchId]: plData?.rates?.b,
            ...(plData?.rates?.c ? { [otherEventMatchBettingRedisKey[plData?.type].c + currBets.matchId]: plData?.rates?.c } : {}),
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

    const bets = await getBetsWithUserRole(users?.map((item) => item.id), { eventType: In([gameType.tennis, gameType.football]) });
    bets?.forEach((item) => {
      let itemData = {
        ...item,
        winAmount: -parseFloat((parseFloat(item.winAmount) * parseFloat(item?.user?.[`${partnershipPrefixByRole[user.roleName]}Partnership`]) / 100).toFixed(2)),
        lossAmount: -parseFloat((parseFloat(item.lossAmount) * parseFloat(item?.user?.[`${partnershipPrefixByRole[user.roleName]}Partnership`]) / 100).toFixed(2))
      };
      if (betResult.session[item.betId] || betResult.match[item.betId]) {
        if (item.marketBetType == marketBetType.SESSION) {
          betResult.session[item.betId].push(itemData);
        }
        else {
          betResult.match[item.betId].push(itemData);

        }
      }
      else {

        if (item.marketBetType == marketBetType.SESSION) {
          betResult.session[item.betId] = [itemData];
        }
        else {
          betResult.match[item.betId] = [itemData];

        }
      }
    });

    for (const placedBet of Object.keys(betResult.session)) {

      const betPlaceProfitLoss = await this.calculatePLAllBet(betResult.session[placedBet], 100);
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
          [otherEventMatchBettingRedisKey[plData?.type].a + matchId]: plData?.rates?.a,
          [otherEventMatchBettingRedisKey[plData?.type].b + matchId]: plData?.rates?.b,
          ...(plData?.rates?.c ? { [otherEventMatchBettingRedisKey[plData?.type].c + matchId]: plData?.rates?.c } : {}),
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
      let maxLoss=0;
      Object.keys(redisData)?.forEach((key) => {
        maxLoss += Math.abs(Math.min(...Object.values(redisData[key] || {}), 0));
        redisData[key]=JSON.stringify(redisData[key]);
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
    bets?.forEach((item) => {
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
      let maxLoss = 0;

      Object.keys(redisData)?.forEach((items)=>{
        maxLoss += Math.abs(Math.min(...Object.values(redisData[items] || {}), 0));
        if(matchResult[items]){
          Object.keys(redisData[items])?.forEach((matchResultData)=>{
            matchResult[items][matchResultData] += parseFloat(parseFloat(redisData[items]?.[matchResultData]).toFixed(2));
          });
        }
        else{
          matchResult[items]=redisData[items];
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

exports.getUserProfitLossForUpperLevel = async (user,matchId) => {
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
    else{
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

exports.getUserProfitLossRacingForUpperLevel = async (user,matchId) => {
  let users = [];
  if (user.roleName == userRoleConstant.fairGameAdmin) {
    users = await getAllUsers({ superParentId: user.id });
  }
  else {
    users = await getChildsWithOnlyUserRole(user.id);
  }
  let betResult = { match: {} };

  let matchResult = {};

  const bets = await getBetsWithUserRole(users?.map((item) => item.id), { matchId: matchId, marketType: In([ racingBettingType.matchOdd]) });
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
      let url = expertDomain + allApiRoutes.MATCHES.raceBettingDetail + matchId + "?type=" +  racingBettingType.matchOdd;
      apiResponse = await apiCall(apiMethod.get, url);
    } catch (error) {
      logger.info({
        info: `Error at get match details in login.`
      });
      return;
    }
    let redisData = await this.calculateRatesRacingMatch(betResult.match[placedBet], 100, apiResponse?.data);

     Object.keys(redisData)?.forEach((items)=>{
      if(matchResult[items]){
        Object.keys(redisData[items])?.forEach((matchResultData)=>{
          matchResult[items][matchResultData] += parseFloat(parseFloat(redisData[items]?.[matchResultData]).toFixed(2));
        });
      }
      else{
        matchResult[items]=redisData[items];
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


exports.transactionPasswordAttempts=async (user)=>{
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
  else{
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
exports.getRedisKeys = (matchBetType, matchId, redisKeys) => {
  let teamArateRedisKey, teamBrateRedisKey, teamCrateRedisKey;

  if (matchBetType === matchBettingType.tiedMatch1 || matchBetType === matchBettingType.tiedMatch2) {
    teamArateRedisKey = redisKeys.yesRateTie + matchId;
    teamBrateRedisKey = redisKeys.noRateTie + matchId;
    teamCrateRedisKey = null;
  } else if (matchBetType === matchBettingType.completeMatch || matchBetType === matchBettingType.completeManual) {
    teamArateRedisKey = redisKeys.yesRateComplete + matchId;
    teamBrateRedisKey = redisKeys.noRateComplete + matchId;
    teamCrateRedisKey = null;
  } else {
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
    subquery = `(SELECT id FROM "users" WHERE "roleName" = '${userRoleConstant.user}')`;

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
