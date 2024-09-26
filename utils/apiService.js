const axios = require('axios');
const { gameType } = require('../config/contants');

// create common api call function using axios to call external server http call for whole project GET <POST< PUT< DELETE
exports.apiMethod = {
  get: "get",
  post: "post",
  put: "put",
  delete: "delete"
};

exports.apiCall = async (method, url, data, headers, ReqQuery) => {
  try {
    let query = ''
    if (ReqQuery && Object.keys(ReqQuery).length) {
      query = Object.keys(ReqQuery)
        .map(key => `${key}=${ReqQuery[key]}`)
        .join('&');
      url = url + '?' + query
    }
    let response = await axios({
      method: method,
      url: url,
      data: data,
      headers: headers
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

exports.allApiRoutes = {
  notification: "/general/notification",
  blinkingTabs: "/superAdmin/blinkingTabs",
  getCompetitionList:"/match/competitionList",
  getDatesByCompetition:"/match/competition/dates",
  getMatchByCompetitionAndDate:"/match/competition/getMatch",
  MATCHES: {
    matchDetails: "/superAdmin/match/",
    raceDetails: "/superAdmin/match/racing/",
    matchDetailsForFootball:"/superadmin/otherMatch/",
    matchList: "/superAdmin/match/list",
    racingMatchList: "/superAdmin/match/racing/list",
    racingMatchCountryCodeList: "/superAdmin/match/racing/countryCode",
    MatchBettingDetail : "/superAdmin/matchBetting/",
    raceBettingDetail : "/superAdmin/raceBetting/",
    tournamentBettingDetail : "/superAdmin/tournamentBetting/",
    sessionDetail: "/superAdmin/session/"
  },
  WALLET:{
    updateBalance:"/superAdmin/update/balance/SA",
    autoLockUnlockUser:"/superAdmin/auto/lockUnlockUser",
    cardResultList:"/superadmin/cards/result/",
    cardResultDetail:"/superadmin/cards/result/detail/"
  },
  EXPERT:{
    partnershipId:"/superAdmin/partnershipId/"
  },
  MICROSERVICE : {
    matchOdd : "/matchOdds/",
    bookmaker : "/bookmaker/",
    session : "/session/",
    casinoData: "/getdata/",
    cardResultDetail: "/getdetailresult/",
    cardTopTenResultDetail: "/getresult/",
    getAllRateCricket: "/getAllRateCricket/",
    getAllRates:{
      [gameType.cricket]: "/getAllRateCricket/",
      [gameType.football]:"/getAllRateFootBallTennis/",
      [gameType.tennis]: "/getAllRateFootBallTennis/"
    }
  }
}
