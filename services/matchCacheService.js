const { matchBettingType } = require("../config/contants");
const grpcReq = require("../grpc/grpcClient");
const { getMatchFromCache, getSessionFromRedis, hasMatchInCache, getMultipleMatchKey, getAllSessionRedis } = require("./redis/commonfunction");

exports.getTournamentBettingDetailsFromCache = async (id, matchId) => {
    const matchDetails = await getMatchFromCache(matchId);
    if (!matchDetails) return null;

    const {
        id: matchIdOnly,
        eventId,
        startAt,
        title,
        matchType,
        stopAt,
        betPlaceStartBefore,
        rateThan100,
        tournament: allTournamentBettings
    } = matchDetails;

    const match = {
        id: matchIdOnly,
        eventId,
        startAt,
        title,
        matchType,
        stopAt,
        betPlaceStartBefore,
        rateThan100
    };

    if (id) {
        const matchBetting = allTournamentBettings?.find(item => item?.id == id);
        const runners = matchBetting?.runners?.sort((a, b) => a.sortPriority - b.sortPriority);

        return {
            data: {
                match,
                matchBetting,
                runners
            }
        };
    }

    return {
        data: {
            match,
            matchBetting: allTournamentBettings
        }
    };
};

exports.getSessionsFromCache = async (sessionId, matchId) => {
    const session = await getSessionFromRedis(matchId, sessionId);
    if (!session) return null;

    const isMatch = await hasMatchInCache(matchId);
    if (!isMatch) return null;

    const rawMatch = await getMultipleMatchKey(matchId);
    const match = {
        apiSessionActive: JSON.parse(rawMatch?.apiSessionActive || "false"),
        manualSessionActive: JSON.parse(rawMatch?.manualSessionActive || "false"),
        marketId: rawMatch?.marketId,
        stopAt: rawMatch?.stopAt,
    };

    return { data: { ...session, ...match } };
};



exports.commonGetMatchDetailsFromRedis = async (matchId) => {
    if (!matchId) return null;
  
    const ids = matchId.split(",");
    const isMultiple = ids.length > 1;
  
    const result = [];
    const matchNotPresent = [];
  
    for (const id of ids) {
      const match = await getMatchFromCache(id);
      if (!match) {
        matchNotPresent.push(id);
        continue;
      }
  
      const sessions = Object.values(await getAllSessionRedis(id) || {});
      match.sessionBettings = sessions;
  
      if (match.tournament) {
        match[matchBettingType.tournament] = match.tournament;
      }
  
      result.push(match);
    }
  
    if (matchNotPresent.length) {
      try {
        let apiResponse = await grpcReq.expert.callMethod(
            "MatchProvider",
            "MatchDetail",
            { matchId: matchNotPresent?.join(",") }
        );
        apiResponse= { data: JSON.parse(apiResponse?.data || "{}") };
        result.push(...((Array.isArray(apiResponse?.data) ? apiResponse?.data : [apiResponse?.data]) || []));
      } catch (err) {
        throw err;
      }
    }
  
    return { data: isMultiple ? result : result[0] || null };
  };
  