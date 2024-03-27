const { In, Not } = require("typeorm");
const { socketData, betType, userRoleConstant, partnershipPrefixByRole, walletDomain, tiedManualTeamName, matchBettingType, redisKeys, marketBetType, expertDomain, matchBettingTeamRatesKey, matchesTeamName, profitLossKeys, otherEventMatchBettingRedisKey } = require("../config/contants");
const internalRedis = require("../config/internalRedisConnection");
const { sendMessageToUser } = require("../sockets/socketManager");
const { apiCall, apiMethod, allApiRoutes } = require("../utils/apiService");
const { getBetByUserId, findAllPlacedBetWithUserIdAndBetId, getUserDistinctBets, getBetsWithUserRole } = require("./betPlacedService");
const { getUserById, getChildsWithOnlyUserRole, getAllUsers } = require("./userService");
const { logger } = require("../config/logger");
const { __mf } = require("i18n");

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
  let betData = [];
  let line = 1;
  let maxLoss = 0.0;
  let first = 0;
  let last = 0;
  if (betPlace && betPlace.length) {
    // let latest_bet = betPlace[betPlace.length - 1].odds;
    let oddsValues = betPlace.map(({ odds }) => odds)
    if (oldLowerLimitOdds) {
      first = oldLowerLimitOdds + 5;
    } else {
      first = Math.min(...oddsValues);
    }
    if (oldUpperLimitOdds) {
      last = oldUpperLimitOdds - 5;
    } else {
      last = Math.max(...oddsValues);
    }

    let i = 0;
    for (var j = first - 5 > 0 ? first - 5 : 0; j <= last + 5; j++) {
      let profitLoss = 0.0;
      for (var key in betPlace) {
        let partnership = 100;
        if (userPartnerShip) {
          partnership = userPartnerShip;
        }
        if (betPlace[key]['betType'] == betType.NO && j < betPlace[key]['odds']) {
          profitLoss = profitLoss + (betPlace[key]['winAmount'] * partnership / 100);
        } else if (betPlace[key]['betType'] == betType.NO && j >= betPlace[key]['odds']) {
          profitLoss = profitLoss - (betPlace[key]['lossAmount'] * partnership / 100);
        } else if (betPlace[key]['betType'] == betType.YES && j < betPlace[key]['odds']) {
          profitLoss = profitLoss - (betPlace[key]['lossAmount'] * partnership / 100);
        } else if (betPlace[key]['betType'] == betType.YES && j >= betPlace[key]['odds']) {
          profitLoss = profitLoss + (betPlace[key]['winAmount'] * partnership / 100);
        }
      }
      if (maxLoss < Math.abs(profitLoss) && profitLoss < 0) {
        maxLoss = Math.abs(profitLoss);
      }
      if (j == last) {
        line = i;
      }
      profitLoss = Number(profitLoss.toFixed(2));
      betData.push({
        'odds': j,
        'profitLoss': profitLoss
      });
      i++;
    }
  }
  maxLoss = Number(maxLoss.toFixed(2));
  return { betData: betData, line: line, maxLoss: maxLoss, total_bet: betPlace.length, lowerLimitOdds: betData[0]?.odds, upperLimitOdds: betData[betData.length - 1]?.odds }
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
        teamC: matchData?.teamC ? (teamRate?.rates?.c || 0) : 0,
      },
      {
        teamA: matchesTeamName[betType]?.a ?? matchData?.teamA,
        teamB: matchesTeamName[betType]?.b ?? matchData?.teamB,
        teamC: matchesTeamName[betType]?.c ?? matchData?.teamC,
        winAmount: placedBets?.winAmount,
        lossAmount: placedBets?.lossAmount,
        bettingType: betType,
        betOnTeam: placedBets?.teamName
      },
      partnerShip
    );

    teamRates[profitLossKey] = {
      rates: {
        ...teamRate.rates,
        a: calculatedRates.teamA,
        b: calculatedRates.teamB,
        ...(matchData?.teamC && { c: calculatedRates.teamC }),
      },
      type: betType
    };
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
  let betPlace = await findAllPlacedBetWithUserIdAndBetId(userId, In(betId), { eventType: Not("cricket") });
  let redisData = await this.calculateRatesOtherMatch(betPlace, 100, matchData);
  return redisData;
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
            console.log(err);
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
          ...(teamARate != Number.MAX_VALUE && teamARate != null && teamARate != undefined ? { [redisKeys.userTeamARate + matchId]:parseFloat(parseFloat((matchResult[redisKeys.userTeamARate + matchId]||0)+ teamARate).toFixed(2)) } : {}),
          ...(teamBRate != Number.MAX_VALUE && teamBRate != null && teamBRate != undefined ? { [redisKeys.userTeamBRate + matchId]:parseFloat(parseFloat((matchResult[redisKeys.userTeamBRate + matchId]||0)+ teamBRate).toFixed(2)) } : {}),
          ...(teamCRate != Number.MAX_VALUE && teamCRate != null && teamCRate != undefined ? { [redisKeys.userTeamCRate + matchId]:parseFloat(parseFloat((matchResult[redisKeys.userTeamCRate + matchId]||0)+ teamCRate).toFixed(2)) } : {}),
          ...(teamYesRateTie != Number.MAX_VALUE && teamYesRateTie != null && teamYesRateTie != undefined ? { [redisKeys.yesRateTie + matchId]:parseFloat(parseFloat((matchResult[redisKeys.yesRateTie + matchId]||0)+ teamYesRateTie).toFixed(2)) } : {}),
          ...(teamNoRateTie != Number.MAX_VALUE && teamNoRateTie != null && teamNoRateTie != undefined ? { [redisKeys.noRateTie + matchId]:parseFloat(parseFloat((matchResult[redisKeys.noRateTie + matchId]||0)+ teamNoRateTie).toFixed(2)) } : {}),
          ...(teamYesRateComplete != Number.MAX_VALUE && teamYesRateComplete != null && teamYesRateComplete != undefined ? { [redisKeys.yesRateComplete + matchId]:parseFloat(parseFloat((matchResult[redisKeys.yesRateComplete + matchId]||0)+ teamYesRateComplete).toFixed(2)) } : {}),
          ...(teamNoRateComplete != Number.MAX_VALUE && teamNoRateComplete != null && teamNoRateComplete != undefined ? { [redisKeys.noRateComplete + matchId]:parseFloat(parseFloat((matchResult[redisKeys.noRateComplete + matchId]||0)+ teamNoRateComplete).toFixed(2)) } : {})
        }
        matchExposure[`${redisKeys.userMatchExposure}${currBets.matchId}`] = parseFloat((parseFloat(matchExposure[`${redisKeys.userMatchExposure}${currBets.matchId}`] || 0) + maxLoss).toFixed(2));
      }

    }
    Object.keys(sessionResult)?.forEach((item)=>{
      sessionResult[item]=JSON.stringify(sessionResult[item]);
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

    const bets = await getBetsWithUserRole(users?.map((item) => item.id), { eventType: "cricket" });
    bets?.forEach((item) => {
      let itemData = {
        ...item,
        winAmount: -parseFloat((parseFloat(item.winAmount) * parseFloat(item?.user?.[`${partnershipPrefixByRole[user.roleName]}Partnership`]) / 100).toFixed(2)),
        lossAmount: -parseFloat((parseFloat(item.lossAmount) * parseFloat(item?.user?.[`${partnershipPrefixByRole[user.roleName]}Partnership`]) / 100).toFixed(2))
      };
      if (betResult.session[item.betId]||betResult.match[item.betId]) {
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
    Object.keys(sessionResult)?.forEach((item)=>{
      sessionResult[item]=JSON.stringify(sessionResult[item]);
    });
    return {
      ...matchExposure, ...matchResult, ...sessionExp, ...sessionResult
    }
  }
}

exports.settingOtherMatchBetsDataAtLogin = async (user) => {
  if (user.roleName == userRoleConstant.user) {
    const bets = await getUserDistinctBets(user.id, { eventType: Not("cricket") });
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

        Object.values(redisData)?.forEach((plData) => {
          maxLoss += Math.abs(Math.min(...Object.values(plData?.rates), 0));

          matchResult = {
            ...matchResult,
            [otherEventMatchBettingRedisKey[plData?.type].a+ currBets.matchId]: plData?.rates?.a,
            [otherEventMatchBettingRedisKey[plData?.type].b+ currBets.matchId]: plData?.rates?.b,
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

    const bets = await getBetsWithUserRole(users?.map((item) => item.id), { eventType: "cricket" });
    bets?.forEach((item) => {
      let itemData = {
        ...item,
        winAmount: -parseFloat((parseFloat(item.winAmount) * parseFloat(item?.user?.[`${partnershipPrefixByRole[user.roleName]}Partnership`]) / 100).toFixed(2)),
        lossAmount: -parseFloat((parseFloat(item.lossAmount) * parseFloat(item?.user?.[`${partnershipPrefixByRole[user.roleName]}Partnership`]) / 100).toFixed(2))
      };
      if (betResult.session[item.betId]||betResult.match[item.betId]) {
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
    Object.keys(sessionResult)?.forEach((item)=>{
      sessionResult[item]=JSON.stringify(sessionResult[item]);
    });
    return {
      ...matchExposure, ...matchResult, ...sessionExp, ...sessionResult
    }
  }
}

exports.getUserProfitLossForUpperLevel = async (user)=>{
  let users=[];
  if (user.roleName == userRoleConstant.fairGameAdmin) {
    users = await getAllUsers({ superParentId: user.id });
  }
  else{
    users = await getChildsWithOnlyUserRole(user.id);
  }
  let betResult = { match: {} };

  let matchResult = {};

  const bets = await getBetsWithUserRole(users?.map((item) => item.id));
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