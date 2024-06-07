const axios = require('axios');

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
    sessionDetail: "/superAdmin/session/"
  },
  WALLET:{
    updateBalance:"/superAdmin/update/balance/SA",
    autoLockUnlockUser:"/superAdmin/auto/lockUnlockUser"
  },
  EXPERT:{
    partnershipId:"/superAdmin/partnershipId/"
  },
  MICROSERVICE : {
    matchOdd : "/matchOdds/",
    bookmaker : "/bookmaker/",
    session : "/session/",
    casinoData:"/casino/rates/"
  }
}
