const { getMatchFromCache, getSessionFromRedis, hasMatchInCache, getMultipleMatchKey } = require("./redis/commonfunction");

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
