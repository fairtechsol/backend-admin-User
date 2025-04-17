const grpc = require("@grpc/grpc-js");
const { __mf } = require("i18n");
const { logger } = require("../../../config/logger");
const { addMatchData, getMatchList } = require("../../../services/matchService");
const { addRaceData } = require("../../../services/racingServices");
const { userRoleConstant, matchWiseBlockType, expertDomain, marketBetType, redisKeys, matchBettingType } = require("../../../config/contants");
const { getAllUsers, getChildUser, isAllChildDeactive, getUserMatchLock, addUserMatchLock, deleteUserMatchLock, getUser, getChildsWithOnlyMultiUserRole } = require("../../../services/userService");
const { getUserExposuresGameWise, getUserExposuresTournament, getCasinoMatchDetailsExposure, getVirtualCasinoExposure, getUserProfitLossMatch, getUserProfitLossTournament } = require("../../../services/commonService");
const { getUserRedisData } = require("../../../services/redis/commonfunction");
const { getChildUsersPlaceBets } = require("../../../services/betPlacedService");
const { apiCall, allApiRoutes, apiMethod } = require("../../../utils/apiService");
const { getVirtualCasinoExposureSum } = require("../../../services/virtualCasinoBetPlacedsService");
const { In, IsNull } = require("typeorm");
const { getMatchDetailsHandler } = require("../../grpcClient/handlers/expert/matchHandler");


exports.addMatch = async (call) => {
  try {
    const data = call.request;

    await addMatchData(data);

    return {}
  }
  catch (err) {
    logger.error({
      error: `Error at get match for the user.`,
      stack: err.stack,
      message: err.message,
    });
    // Handle any errors and return an error response
    throw {
      code: grpc.status.INTERNAL,
      message: err?.message || __mf("internalServerError"),
    };
  }
}

exports.raceAdd = async (call) => {
  try {
    const data = call.request;

    await addRaceData(data);

    return {}
  }
  catch (err) {
    logger.error({
      error: `Error at get match for the user.`,
      stack: err.stack,
      message: err.message,
    });
    // Handle any errors and return an error response
    throw {
      code: grpc.status.INTERNAL,
      message: err?.message || __mf("internalServerError"),
    };
  }
}

exports.userMatchLock = async (call) => {
  try {
    const { userId, matchId, type, block, operationToAll, roleName } = call.request;
    let reqUser = { id: userId, roleName: roleName };

    const childUsers = roleName == userRoleConstant.fairGameWallet ? await getAllUsers({}, ["id", "userName"]) : roleName == userRoleConstant.fairGameAdmin ? await getAllUsers({ superParentId: userId }, ["id", "userName"]) : await getChildUser(userId);
    const allChildUserIds = [...childUsers.map(obj => obj.id), ...(operationToAll ? [] : [userId])];

    let returnData;
    for (const blockUserId of allChildUserIds) {
      returnData = await userBlockUnlockMatch(blockUserId, matchId, reqUser, block, type);
    }

    let allChildMatchDeactive = true;
    let allChildSessionDeactive = true;

    const allDeactive = await isAllChildDeactive({ createBy: reqUser.id, id: Not(reqUser.id) }, ['userMatchLock.id'], matchId);
    allDeactive.forEach(ob => {
      if (!ob.userMatchLock_id || !ob.userMatchLock_matchLock) {
        allChildMatchDeactive = false;
      }
      if (!ob.userMatchLock_id || !ob.userMatchLock_sessionLock) {
        allChildSessionDeactive = false;
      }
    });

    return {};
  } catch (error) {
    throw {
      code: grpc.status.INTERNAL,
      message: error?.message || __mf("internalServerError"),
    };
  }
  async function userBlockUnlockMatch(userId, matchId, reqUser, block, type) {
    let userAlreadyBlockExit = await getUserMatchLock({ userId, matchId, blockBy: reqUser.id });

    if (!userAlreadyBlockExit) {
      if (!block) {
        throw { message: __mf("notUnblockFirst") };
      }

      const object = {
        userId,
        matchId,
        blockBy: reqUser.id,
        matchLock: type == matchWiseBlockType.match && block,
        sessionLock: type != matchWiseBlockType.match && block
      };

      addUserMatchLock(object);
      return object;
    }

    if (type == matchWiseBlockType.match) {
      userAlreadyBlockExit.matchLock = block;
    } else {
      userAlreadyBlockExit.sessionLock = block;
    }

    if (!block && !(userAlreadyBlockExit.matchLock || userAlreadyBlockExit.sessionLock)) {
      deleteUserMatchLock({ id: userAlreadyBlockExit.id });
      return userAlreadyBlockExit;
    }

    addUserMatchLock(userAlreadyBlockExit);
    return userAlreadyBlockExit;
  }

}


exports.userEventWiseExposure = async (call) => {
  try {
    const { userId } = call.request;
    const user = await getUser({ id: userId });

    const eventNameByMatchId = {};
    const matchList = await getMatchList({ stopAt: IsNull() }, ["id", "matchType", "title"]);

    for (let item of matchList) {
      eventNameByMatchId[item.id] = { type: item.matchType, name: item.title };
    }

    const result = {};
    let gamesExposure = await getUserExposuresGameWise(user);
    let tournamentExposure = await getUserExposuresTournament(user);

    const allMatchBetData = { ...(gamesExposure || {}) };
    Object.keys(tournamentExposure).forEach((item) => {
      if (allMatchBetData[item]) {
        allMatchBetData[item] += tournamentExposure[item];
      }
      else {
        allMatchBetData[item] = tournamentExposure[item];
      }
    });
    if (Object.keys(allMatchBetData || {}).length) {
      for (let item of Object.keys(allMatchBetData)) {
        if (eventNameByMatchId[item]) {
          if (!result[eventNameByMatchId[item].type]) {
            result[eventNameByMatchId[item].type] = { exposure: 0, match: {} };
          }
          result[eventNameByMatchId[item].type].exposure = (result[eventNameByMatchId[item].type].exposure || 0) + allMatchBetData[item];
          if (!result[eventNameByMatchId[item].type].match[item]) {
            result[eventNameByMatchId[item].type].match[item] = { name: eventNameByMatchId[item].name, exposure: allMatchBetData[item] };
          }
          else {
            result[eventNameByMatchId[item].type].match[item] = { name: eventNameByMatchId[item].name, exposure: (result[eventNameByMatchId[item].type].match[item]?.exposure || 0) + allMatchBetData[item] };
          }
        }
      }
    }
    const cardData = await getCasinoMatchDetailsExposure(user);
    result.card = {
      exposure: cardData.totalExposure,
      match: Object.keys(cardData.cardWiseExposure || {}).map((item) => {
        return { name: cardGames.find((items) => items.type == item)?.name, type: item, exposure: cardData.cardWiseExposure[item] }
      })
    };

    const virtualCasinoData = await getVirtualCasinoExposure(user);
    result.virtual = {
      exposure: Math.abs(virtualCasinoData?.count?.totalAmount),
      match: virtualCasinoData?.list?.map((item) => {
        return { name: item.gameName, type: item.providerName, exposure: Math.abs(item.totalAmount) }
      })
    }
    return { data: JSON.stringify(result) }

  } catch (err) {
    throw {
      code: grpc.status.INTERNAL,
      message: err?.message || __mf("internalServerError"),
    };
  }
};


exports.marketAnalysis = async (call) => {
  try {
    const { matchId, userId } = call.request;
    let redisData = await getUserRedisData(userId);
    const result = [];

    if (redisData) {
      const matchesBetsByUsers = await getChildUsersPlaceBets(userId, matchId);

      let matchIds = new Set();

      for (let item of matchesBetsByUsers) {
        matchIds.add(item.matchId);
      }
      let matchDetails;

      if (matchesBetsByUsers?.length) {
        try {
          matchDetails = await getMatchDetailsHandler({matchId:Array.from(matchIds).join(",")})
        
          if (!Array.isArray(matchDetails?.data)) {
            matchDetails.data = [matchDetails?.data];
          }
        } catch (error) {
          throw {
            code: grpc.status.INTERNAL,
            message: error?.response?.data?.message || __mf("internalServerError"),
          };
        }
        for (let item of matchesBetsByUsers) {
          const currMatchDetail = result.findIndex((items) => items?.matchId == item?.matchId);
          if (item?.marketBetType == marketBetType.SESSION) {
            const currRedisData = JSON.parse(redisData?.[item?.betId + redisKeys.profitLoss]);
            if (currMatchDetail == -1) {
              result.push({
                title: item?.title,
                matchId: item?.matchId,
                startAt: item?.startAt,
                eventType: item?.eventType,
                betType: {
                  session: [{
                    betId: item?.betId,
                    type: item?.marketType,
                    eventName: item?.eventName,
                    profitLoss: currRedisData
                  }]
                }
              })
            }
            else {
              if (!result[currMatchDetail].betType["session"]) {
                result[currMatchDetail].betType["session"] = [];
              }
              result[currMatchDetail].betType["session"].push({
                betId: item?.betId,
                eventName: item?.eventName,
                profitLoss: currRedisData,
                type: item?.marketType,
              });
            }
          }
          else {
            const currMatchData = matchDetails?.data?.find((items) => items?.id == item?.matchId);
            let teams, currRedisData;

            if (item?.marketType == matchBettingType.tournament) {
              currRedisData = {};
              let currBetPL = JSON.parse(redisData[item?.betId + redisKeys.profitLoss + "_" + item?.matchId]);
              teams = currMatchData?.tournament?.find((items) => items?.id == item?.betId)?.runners?.sort((a, b) => a.sortPriority - b.sortPriority)?.map((items, i) => {
                currRedisData[String.fromCharCode(97 + i)] = currBetPL[items?.id];
                return items?.runnerName
              });
            }

            if (currMatchDetail == -1) {
              result.push({
                title: item?.title,
                matchId: item?.matchId,
                startAt: item?.startAt,
                eventType: item?.eventType,
                betType: {
                  match: [{
                    marketName: item?.bettingName,
                    betId: item?.betId,
                    eventName: item?.eventName,
                    profitLoss: currRedisData,
                    marketType: item?.marketType,
                    teams: teams
                  }]
                }
              })
            }
            else {
              if (!result[currMatchDetail].betType.match) {
                result[currMatchDetail].betType.match = [];
              }
              result[currMatchDetail].betType.match.push({
                marketName: item?.bettingName,
                betId: item?.betId,
                eventName: item?.eventName,
                profitLoss: currRedisData,
                marketType: item?.marketType,
                teams: teams
              });
            }
          }
        }

      }
    }
    else {
      const user = await getUser({ id: userId });
      const [matchData, tournamentData] = await Promise.all([getUserProfitLossMatch(user, matchId), getUserProfitLossTournament(user, matchId)]);
      let matchDetails;

      try {
        matchDetails = await getMatchDetailsHandler({ matchId: matchId });
      } catch (error) {
        throw {
          code: grpc.status.INTERNAL,
          message: error?.response?.data?.message || __mf("internalServerError"),
        };
      }

      result.push({
        title: matchDetails?.data?.title,
        matchId: matchDetails?.data?.id,
        startAt: matchDetails?.data?.startAt,
        eventType: matchDetails?.data?.matchType,
        betType: {}
      });
      for (let item of Object.values(matchData.session)) {
        let { betDetails, ...profitLoss } = item;
        if (!result[0].betType["session"]) {
          result[0].betType["session"] = [];
        }
        result[0].betType = {
          session: [...result[0].betType["session"], {
            betId: betDetails?.betId,
            type: betDetails?.marketType,
            eventName: betDetails?.eventName,
            profitLoss: profitLoss
          }]
        }
      }

      for (let item of Object.values(tournamentData)) {
        let { betDetails, data } = item;
        let currRedisData = {}, teams;
        let currBetPL = data[betDetails?.betId + redisKeys.profitLoss + "_" + betDetails?.matchId];
        teams = matchDetails.data?.tournament?.find((items) => items?.id == betDetails?.betId)?.runners?.sort((a, b) => a.sortPriority - b.sortPriority)?.map((items, i) => {
          currRedisData[String.fromCharCode(97 + i)] = currBetPL[items?.id];
          return items?.runnerName
        });

        if (!result[0].betType.match) {
          result[0].betType.match = [];
        }
        result[0].betType.match.push({
          marketName: betDetails?.bettingName,
          betId: betDetails?.betId,
          eventName: betDetails?.eventName,
          profitLoss: currRedisData,
          marketType: betDetails?.marketType,
          teams: teams
        });
      }
    }
    return { data: JSON.stringify(result) }



  } catch (err) {
    throw {
      code: grpc.status.INTERNAL,
      message: err?.message || __mf("internalServerError"),
    };
  };
}

exports.getVirtualBetExposures = async (call) => {
  try {
    let { roleName, userId } = call.request;
    let bets = [];
    if (roleName == userRoleConstant.user) {
      bets = await getVirtualCasinoExposureSum({ userId: userId, settled: false });
    }
    else {
      const users = await getChildsWithOnlyMultiUserRole((await getAllUsers(roleName == userRoleConstant.fairGameAdmin ? { superParentId: userId } : {})).map((item) => item.id));
      bets = await getVirtualCasinoExposureSum({ userId: In(users.map((item) => item.id)), settled: false, });
    }

    let result = {
      exposure: Math.abs(bets?.count?.totalAmount || 0),
      match: bets?.list?.reduce((prev, curr) => {
        prev[curr.gameName] = { ...curr, totalAmount: Math.abs(curr.totalAmount) };
        return prev;
      }, {})
    }
    return { data: JSON.stringify(result) }
  } catch (err) {
    logger.error({
      error: "Error in get bet for wallet",
      stack: err.stack,
      message: err.message,
    })
    throw {
      code: grpc.status.INTERNAL,
      message: err?.message || __mf("internalServerError"),
    };

  }

};