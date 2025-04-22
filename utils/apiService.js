const axios = require('axios');
const { gameType, expertDomain } = require('../config/contants');
const { getTournamentBettingDetailsFromCache, getSessionsFromCache } = require('../services/matchCacheService');
// create common api call function using axios to call external server http call for whole project GET <POST< PUT< DELETE
exports.apiMethod = {
  get: "get",
  post: "post",
  put: "put",
  delete: "delete"
};

exports.apiCall = async (method, url, data, headers, ReqQuery) => {
  try {

    if (url?.startsWith(`${expertDomain}${this.allApiRoutes.MATCHES.tournamentBettingDetail}`)) {
      const parsedUrl = new URL(url);
      const queryParams = Object.fromEntries(parsedUrl.searchParams.entries());
      const data = await getTournamentBettingDetailsFromCache(queryParams?.id, url?.split("/")?.pop()?.split("?")?.[0]);
      if (data) {
        return data;
      }
    }

    else if (url?.startsWith(`${expertDomain}${this.allApiRoutes.MATCHES.sessionDetail}`)) {
      const data = await getSessionsFromCache(ReqQuery?.id, url?.split("/")?.pop()?.split("?")?.[0]);
      if (data) {
        return data;
      }
    }

    let response = await axios({
      method: method,
      url: url,
      data: data,
      headers: headers,
      params: ReqQuery
    });
    let resData = response.data;

    return resData;
  } catch (error) {
    throw error;
  }
};

exports.allApiRoutes = {
  notification: "/general/notification",
  blinkingTabs: "/superAdmin/blinkingTabs",
  getCompetitionList: "/match/competitionList",
  getDatesByCompetition: "/match/competition/dates",
  getMatchByCompetitionAndDate: "/match/competition/getMatch",
  MATCHES: {
    matchDetails: "/superAdmin/match/",
    raceDetails: "/superAdmin/match/racing/",
    matchDetailsForFootball: "/superadmin/otherMatch/",
    matchList: "/superAdmin/match/list",
    racingMatchList: "/superAdmin/match/racing/list",
    racingMatchCountryCodeList: "/superAdmin/match/racing/countryCode",
    MatchBettingDetail: "/superAdmin/matchBetting/",
    raceBettingDetail: "/superAdmin/raceBetting/",
    tournamentBettingDetail: "/superAdmin/tournamentBetting/",
    sessionDetail: "/superAdmin/session/"
  },
  WALLET: {
    updateBalance: "/superAdmin/update/balance/SA",
    autoLockUnlockUser: "/superAdmin/auto/lockUnlockUser",
    cardResultList: "/superadmin/cards/result/",
    cardResultDetail: "/superadmin/cards/result/detail/",
    virtualCasinoResult: "/superadmin/virtual/casino/result"
  },
  EXPERT: {
    partnershipId: "/superAdmin/partnershipId/"
  },
  MICROSERVICE: {
    matchOdd: "/matchOdds/",
    bookmaker: "/bookmaker/",
    session: "/session/",
    casinoData: "/getdata/",
    cardResultDetail: "/getdetailresult/",
    cardTopTenResultDetail: "/getresult/",
    getAllRateCricket: "/getAllRateCricket/",
    getAllRates: {
      [gameType.cricket]: "/getAllRateCricket/",
      [gameType.politics]: "/getAllRateCricket/",
      [gameType.football]: "/getAllRateFootBallTennis/",
      [gameType.tennis]: "/getAllRateFootBallTennis/"
    }
  },
  MAC88: {
    login: "/operator/login",
    gameList: "/operator/get-games-list"
  }
}
