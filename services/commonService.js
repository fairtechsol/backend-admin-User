const { socketData, betType } = require("../config/contants");
const internalRedis = require("../config/internalRedisConnection");
const { sendMessageToUser } = require("../sockets/socketManager");

exports.forceLogoutIfLogin = async (userId) => {
    let token = await internalRedis.hget(userId,"token");
  
    if (token) {
      // function to force logout
      sendMessageToUser(userId,socketData.logoutUserForceEvent,null)
    }
  };


  exports.forceLogoutUser = async (userId, stopForceLogout) => {

    if (!stopForceLogout) {
      await this.forceLogoutIfLogin(userId);
    }
    await internalRedis.hdel(userId, "token");
  
  };

exports.calculateRate =async  (teamRates, data, partnership = 100) => {
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
      newTeamRates.teamA = teamRates.teamA - ((winAmount * partnership) / 100);
      newTeamRates.teamB = teamRates.teamB + ((lossAmount * partnership) / 100);
      newTeamRates.teamC = teamRates.teamC + (teamC ? ((lossAmount * partnership) / 100) : 0);
    }
    else if (betOnTeam == teamB && bettingType == betType.BACK) {
      newTeamRates.teamB = teamRates.teamB + ((winAmount * partnership) / 100);
      newTeamRates.teamA = teamRates.teamA - ((lossAmount * partnership) / 100);
      newTeamRates.teamC = teamRates.teamC - (teamC ? ((lossAmount * partnership) / 100) : 0);
    }
    else if (betOnTeam == teamB && bettingType == betType.LAY) {
      newTeamRates.teamB = teamRates.teamB - ((winAmount * partnership) / 100);
      newTeamRates.teamA = teamRates.teamA + ((lossAmount * partnership) / 100);
      newTeamRates.teamC = teamRates.teamC + (teamC ? ((lossAmount * partnership) / 100) : 0);
    }
    else if (teamC && betOnTeam == teamC && bettingType == betType.BACK) {
      newTeamRates.teamA = teamRates.teamA - ((winAmount * partnership) / 100);
      newTeamRates.teamB = teamRates.teamB - ((lossAmount * partnership) / 100);
      newTeamRates.teamC = teamRates.teamC + ((lossAmount * partnership) / 100);
    }
    else if (teamC && betOnTeam == teamC && bettingType == betType.LAY) {
      newTeamRates.teamA = teamRates.teamA - ((winAmount * partnership) / 100);
      newTeamRates.teamB = teamRates.teamB + ((lossAmount * partnership) / 100);
      newTeamRates.teamC = teamRates.teamC - ((lossAmount * partnership) / 100);
    }
  
    newTeamRates = {
      teamA: Number(newTeamRates.teamA.toFixed(2)),
      teamB: Number(newTeamRates.teamB.toFixed(2)),
      teamC: Number(newTeamRates.teamC.toFixed(2))
    }
    return newTeamRates;
  }
exports.calculateExpertRate =async  (teamRates, data, partnership = 100) => {
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
      newTeamRates.teamA = teamRates.teamA + ((winAmount * partnership) / 100);
      newTeamRates.teamB = teamRates.teamB - ((lossAmount * partnership) / 100);
      newTeamRates.teamC = teamRates.teamC - (teamC ? ((lossAmount * partnership) / 100) : 0);
    }
    else if (betOnTeam == teamB && bettingType == betType.BACK) {
      newTeamRates.teamB = teamRates.teamB - ((winAmount * partnership) / 100);
      newTeamRates.teamA = teamRates.teamA + ((lossAmount * partnership) / 100);
      newTeamRates.teamC = teamRates.teamC + (teamC ? ((lossAmount * partnership) / 100) : 0);
    }
    else if (betOnTeam == teamB && bettingType == betType.LAY) {
      newTeamRates.teamB = teamRates.teamB + ((winAmount * partnership) / 100);
      newTeamRates.teamA = teamRates.teamA - ((lossAmount * partnership) / 100);
      newTeamRates.teamC = teamRates.teamC - (teamC ? ((lossAmount * partnership) / 100) : 0);
    }
    else if (teamC && betOnTeam == teamC && bettingType == betType.BACK) {
      newTeamRates.teamA = teamRates.teamA + ((winAmount * partnership) / 100);
      newTeamRates.teamB = teamRates.teamB + ((lossAmount * partnership) / 100);
      newTeamRates.teamC = teamRates.teamC - ((lossAmount * partnership) / 100);
    }
    else if (teamC && betOnTeam == teamC && bettingType == betType.LAY) {
      newTeamRates.teamA = teamRates.teamA + ((winAmount * partnership) / 100);
      newTeamRates.teamB = teamRates.teamB - ((lossAmount * partnership) / 100);
      newTeamRates.teamC = teamRates.teamC + ((lossAmount * partnership) / 100);
    }
  
    newTeamRates = {
      teamA: Number(newTeamRates.teamA.toFixed(2)),
      teamB: Number(newTeamRates.teamB.toFixed(2)),
      teamC: Number(newTeamRates.teamC.toFixed(2))
    }
    return newTeamRates;
  }

  
  const calculateProfitLoss = (betData, odds,partnership) => {
    if (
      (betData?.betPlacedData?.betType === betType.NO &&
        odds < betData?.betPlacedData?.odds) ||
      (betData?.betPlacedData?.betType === betType.YES &&
        odds >= betData?.betPlacedData?.odds)
    ) {
      return partnership
        ? -parseFloat(
            (parseFloat(betData?.winAmount) * partnership) / 100
          ).toFixed(2)
        : parseFloat(parseFloat(betData?.winAmount).toFixed(2));
    } else if (
      (betData?.betPlacedData?.betType === betType.NO &&
        odds >= betData?.betPlacedData?.odds) ||
      (betData?.betPlacedData?.betType === betType.YES &&
        odds < betData?.betPlacedData?.odds)
    ) {
      return partnership
        ? parseFloat(
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
        let profitLoss = calculateProfitLoss(betData, lowerLimit + index,partnership);
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
      let profitLossVal=calculateProfitLoss(betData, item?.odds,partnership);
      profitLossVal=(parseFloat(item?.profitLoss) + parseFloat(profitLossVal)).toFixed(2)
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
  };
};