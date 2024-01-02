const { socketData } = require("../config/contants");
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