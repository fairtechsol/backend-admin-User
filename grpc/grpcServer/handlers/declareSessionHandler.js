const grpc = require("@grpc/grpc-js");
const { __mf } = require("i18n");
const {
  transType,
  userRoleConstant,
  socketData,
  betType,
  betResultStatus,
  redisKeys,
  marketBetType,
  sessionBettingType,
  transactionType,
  partnershipPrefixByRole,
  resultType,
} = require("../../../config/contants");
const { logger } = require("../../../config/logger");
const { getMatchBetPlaceWithUser, addNewBet, getMultipleAccountProfitLoss, getDistinctUserBetPlaced, updatePlaceBet, findAllPlacedBetWithUserIdAndBetId } = require("../../../services/betPlacedService");
const {
  calculateProfitLossForSessionToResult,
  insertBulkTransactions,
  insertBulkCommissions,
  calculatePLAllBet,
  calculateProfitLossSession,
  calculateProfitLossKhado,
  calculateProfitLossMeter,
  calculateProfitLossSessionOddEven,
  calculateProfitLossSessionCasinoCricket,
  calculateProfitLossSessionFancy1,
} = require("../../../services/commonService");

const { getUserRedisData, deleteKeyFromUserRedis, incrementValuesRedis } = require("../../../services/redis/commonfunction");
const {
  getUserBalanceDataByUserId,
  updateUserBalanceData,
  updateUserExposure,
  updateUserDeclareBalanceData,
} = require("../../../services/userBalanceService");
const {
  getParentsWithBalance,
} = require("../../../services/userService");
const { sendMessageToUser } = require("../../../sockets/socketManager");
const { getCombinedCommission, deleteCommission } = require("../../../services/commissionService");
const { getMatchData } = require("../../../services/matchService");
const { IsNull, In } = require("typeorm");


exports.declareSessionResult = async (call) => {
  try {
    const { betId, score, matchId, sessionDetails, userId, match } = call.request;

    const betPlaced = await getMatchBetPlaceWithUser([betId]);

    logger.info({
      message: "Session result declared.",
      data: {
        betId, score
      }
    });

    let updateRecords = [];
    let commissions = {};
    let bulkCommission = {};

    for (let item of betPlaced) {

      switch (item?.marketType) {
        case sessionBettingType.ballByBall:
        case sessionBettingType.overByOver:
        case sessionBettingType.session:

          if ((item.betType == betType.YES && item.odds <= score) || (item.betType == betType.NO && item.odds > score)) {
            item.result = betResultStatus.WIN;
          } else if ((item.betType == betType.YES && item.odds > score) || (item.betType == betType.NO && item.odds <= score)) {
            item.result = betResultStatus.LOSS;
          }
          break;
        case sessionBettingType.oddEven:
          let currBetType = item?.teamName?.split("-")?.pop()?.trim()?.toLowerCase();
          if ((currBetType == "odd" && parseInt(score) % 2 == 1) || (currBetType == "even" && parseInt(score) % 2 == 0)) {
            item.result = betResultStatus.WIN;
          } else if ((currBetType == "odd" && parseInt(score) % 2 != 1) || (currBetType == "even" && parseInt(score) % 2 != 0)) {
            item.result = betResultStatus.LOSS;
          }
          break;
        case sessionBettingType.fancy1:
          if ((item.betType == betType.BACK && score == "yes") || (item.betType == betType.LAY && score == "no")) {
            item.result = betResultStatus.WIN;
          } else if ((item.betType == betType.BACK && score != "yes") || (item.betType == betType.LAY && score != "no")) {
            item.result = betResultStatus.LOSS;
          }
          break;
        case sessionBettingType.cricketCasino:
          let currBet = parseInt(item?.teamName?.split("-")?.pop()?.trim()?.split(" ")?.[0]);
          if ((currBet == parseInt(score) % 10)) {
            item.result = betResultStatus.WIN;
          } else {
            item.result = betResultStatus.LOSS;
          }
          break;
        case sessionBettingType.meter:
          if ((item.betType == betType.YES && item.odds <= score) || (item.betType == betType.NO && item.odds > score)) {
            item.result = betResultStatus.WIN;
            item.winAmount = ((parseFloat(item.amount) * parseFloat(item.rate) / 100) * Math.abs(parseInt(score) - parseInt(item.odds)));
          } else if ((item.betType == betType.YES && item.odds > score) || (item.betType == betType.NO && item.odds <= score)) {
            item.result = betResultStatus.LOSS;
            item.lossAmount = ((parseFloat(item.amount) * parseFloat(item.rate) / 100) * Math.abs(parseInt(score) - parseInt(item.odds)));
          }
          break;
        case sessionBettingType.khado:
          if ((item.betType === betType.BACK && (parseInt(score) >= item.odds && parseInt(score) < item.odds + parseInt(item.eventName.split("-").pop())))) {
            item.result = betResultStatus.WIN;
          } else {
            item.result = betResultStatus.LOSS;
          }
          break;
      }
      if (item.isCommissionActive) {
        if (item.user['sessionCommission'] != 0 && item.user['sessionCommission'] != null) {
          let commissionAmount = Number((parseFloat(item.amount) * (parseFloat(item.user['sessionCommission']) / 100)).toFixed(2));
          commissionAmount = Math.abs(commissionAmount);
          if (commissions[item?.user?.id]) {
            commissions[item?.user?.id] = parseFloat(commissions[item?.user?.id]) + parseFloat(commissionAmount);
          } else {

            commissions[item?.user?.id] = commissionAmount;
          }
        }
        bulkCommission[item?.user?.id] = [...(bulkCommission[item?.user?.id] || []),
        {
          matchId: matchId,
          betId: betId,
          betPlaceId: item?.id,
          amount: item?.amount,
          sessionName: item?.eventName,
          betPlaceDate: item?.createdAt,
          odds: item?.odds,
          betType: item?.betType,
          stake: item?.amount,
          superParent: item?.user?.superParentId,
          userName: item?.user.userName,
          matchType: marketBetType.SESSION
        }
        ];

      }
      updateRecords.push(item);
    }

    await addNewBet(updateRecords);

    let users = await getDistinctUserBetPlaced(betId);

    let upperUserObj = {};
    let bulkWalletRecord = [];
    let commissionReport = [];
    const profitLossData = await calculateProfitLossSessionForUserDeclare(
      users,
      betId,
      matchId,
      0,
      sessionDetails,
      socketData.sessionResult,
      userId,
      bulkWalletRecord,
      upperUserObj,
      score,
      commissions,
      bulkCommission,
      commissionReport,
      match
    );

    insertBulkTransactions(bulkWalletRecord);
    logger.info({
      message: "Upper user for this bet.",
      data: { upperUserObj, betId }
    });

    const userEntries = Object.entries(upperUserObj);
    if (!userEntries.length) return;

    // 1️⃣ Fetch all current balances in one Redis pipeline
    const balanceResponses = await internalRedis.pipeline(
      userEntries.map(([userId]) =>
        ['hmget', userId, 'profitLoss', 'myProfitLoss', 'exposure', 'totalCommission']
      )
    ).exec();

    // 2️⃣ Compute deltas, queue Redis updates, and send socket messages
    const updatePipeline = internalRedis.pipeline();
    const redisSessionExposureName = redisKeys.userSessionExposure + matchId;

    userEntries.forEach(([userId, updateData], idx) => {
      upperUserObj[userId].exposure = -upperUserObj[userId].exposure;
      upperUserObj[userId].myProfitLoss = -upperUserObj[userId].myProfitLoss;

      if (balanceResponses[idx][1]?.filter((items) => items != null).length) {
        const [plStr, mplStr, expStr, comStr] = balanceResponses[idx][1];
        const currentProfitLoss = +plStr || 0;
        const currentMyProfitLoss = +mplStr || 0;
        const currentExposure = +expStr || 0;
        const currentTotalCommission = +comStr || 0;


        const profitLossDelta = +updateData.profitLoss || 0;
        const myProfitLossDelta = -(+updateData.myProfitLoss) || 0;
        const rawExposureDelta = -(+updateData.exposure) || 0;
        const commissionDelta = +updateData.totalCommission || 0;

        // clamp exposure and adjust leftover
        let newExposure = currentExposure + rawExposureDelta;
        let adjustedExposure = rawExposureDelta;
        if (newExposure < 0) {
          logger.info({
            message: 'Exposure went negative',
            data: {
              betId: betId,
              matchId, userId, before: currentExposure, delta: rawExposureDelta
            }
          });
          adjustedExposure += newExposure;  // fold leftover back
          newExposure = 0;
        }

        // queue Redis increments & key deletion
        updatePipeline
          .hincrbyfloat(userId, 'profitLoss', profitLossDelta)
          .hincrbyfloat(userId, 'myProfitLoss', myProfitLossDelta)
          .hincrbyfloat(userId, 'exposure', adjustedExposure)
          .hincrbyfloat(userId, [redisSessionExposureName], adjustedExposure)
          .hdel(userId, `${betId}${redisKeys.profitLoss}`);

        logger.info({
          message: "Declare result session db update for parent ",
          data: {
            parentUser: {
              profitLoss: currentProfitLoss + profitLossDelta,
              myProfitLoss: currentMyProfitLoss + myProfitLossDelta,
              exposure: newExposure,
              totalCommission: currentTotalCommission + commissionDelta,
            },
            betId: marketDetail?.id
          },
        });

        // fire-and-forget socket notification
        sendMessageToUser(userId, socketData.matchResult, {
          profitLoss: currentProfitLoss + profitLossDelta,
          myProfitLoss: currentMyProfitLoss + myProfitLossDelta,
          exposure: newExposure,
          totalCommission: currentTotalCommission + commissionDelta,
          betId: betId,
          matchId
        });
      }
    });

    await Promise.all([updatePipeline.exec(), updateUserDeclareBalanceData(upperUserObj)]);

    insertBulkCommissions(commissionReport);
    return { data: profitLossData }

  } catch (error) {
    logger.error({
      error: `Error at declare session result for the user.`,
      stack: error.stack,
      message: error.message,
    });
    // Handle any errors and return an error response
    throw {
      code: grpc.status.INTERNAL,
      message: error?.message || __mf("internalServerError"),
    };
  }
}

const calculateProfitLossSessionForUserDeclare = async (users, betId, matchId, fwProfitLoss, resultDeclare, redisEventName, userId, bulkWalletRecord, upperUserObj, score, commission, bulkCommission, commissionReport, match) => {

  let faAdminCal = {
    commission: [],
    userData: {}
  };
  let superAdminData = {};

  for (const user of users) {
    let description = '';
    let getWinAmount = 0;
    let getLossAmount = 0;
    let profitLoss = 0;
    let transTypes;
    let userRedisData = await getUserRedisData(user.user.id);
    let getMultipleAmount = await getMultipleAccountProfitLoss(betId, user.user.id);
    let maxLoss = 0;
    let redisSesionExposureValue = 0;
    let redisSesionExposureName = redisKeys.userSessionExposure + matchId;
    redisSesionExposureValue = parseFloat(userRedisData?.[redisSesionExposureName] || 0);
    logger.info({ message: "Updated users", data: user.user });
    logger.info({
      redisSessionExposureValue: redisSesionExposureValue,
      sessionBet: true,
    });

    // check if data is already present in the redis or not
    if (userRedisData?.[betId + '_profitLoss']) {
      let redisData = JSON.parse(userRedisData[betId + '_profitLoss']);
      maxLoss = redisData.maxLoss || 0;
    } else {
      // if data is not available in the redis then get data from redis and find max loss amount for all placed bet by user
      let redisData = await calculateProfitLossForSessionToResult(betId, user.user?.id);
      maxLoss = redisData.maxLoss || 0;
    }
    redisSesionExposureValue = redisSesionExposureValue - maxLoss;

    logger.info({
      maxLoss: maxLoss,
      userSessionExposure: redisSesionExposureValue
    });
    user.user.userBalance.exposure = user.user.userBalance.exposure - maxLoss;

    logger.info({
      message: "Update user exposure.",
      data: user.user.exposure
    });

    getWinAmount = getMultipleAmount[0].winamount;
    getLossAmount = getMultipleAmount[0].lossamount;
    profitLoss = parseFloat(getWinAmount.toString()) - parseFloat(getLossAmount.toString());

    fwProfitLoss = parseFloat(fwProfitLoss.toString()) + parseFloat(((-profitLoss * user.user.fwPartnership) / 100).toString());

    if (profitLoss > 0) {
      transTypes = transType.win;
      description = `${user?.eventType}/${user?.eventName}/${resultDeclare?.type}-${score}`;
    } else {
      transTypes = transType.loss;
      description = `${user?.eventType}/${user?.eventName}/${resultDeclare?.type}-${score}`;
    }

    const userCurrBalance = Number(user.user.userBalance.currentBalance + profitLoss).toFixed(2);
    let userBalanceData = {
      profitLoss: profitLoss,
      myProfitLoss: profitLoss,
      exposure: -maxLoss
    };

    if (commission[user.user.id]) {
      userBalanceData.totalCommission = Number((parseFloat(commission[user.user.id])).toFixed(2));
    }

    await updateUserBalanceData(user.user.id, userBalanceData);

    if (userRedisData?.exposure) {
      let { totalCommission, ...userBalance } = userBalanceData;
      await incrementValuesRedis(user.user.id, {
        ...userBalance,
        currentBalance: profitLoss,
        [redisSesionExposureName]: -maxLoss,
      });
      await deleteKeyFromUserRedis(user.user.id, betId + "_profitLoss");
    }

    if (user?.user?.sessionCommission) {

      bulkCommission[user?.user?.id]?.forEach((item) => {
        commissionReport.push({
          createBy: user.user.id,
          matchId: item.matchId,
          betId: item?.betId,
          betPlaceId: item?.betPlaceId,
          commissionAmount: parseFloat((parseFloat(item?.amount) * parseFloat(user?.user?.sessionCommission) / 100).toFixed(2)),
          parentId: user.user.id,
          matchType: marketBetType.SESSION
        });
      });

      if (user?.user?.id == user?.user?.createBy) {
        bulkCommission[user?.user?.id]?.forEach((item) => {
          faAdminCal.commission.push({
            createBy: user.user.id,
            matchId: item.matchId,
            betId: item?.betId,
            betPlaceId: item?.betPlaceId,
            parentId: user.user.id,
            teamName: item?.sessionName,
            betPlaceDate: new Date(item?.betPlaceDate),
            odds: item?.odds,
            betType: item?.betType,
            stake: item?.stake,
            commissionAmount: parseFloat((parseFloat(item?.amount) * parseFloat(user?.user?.sessionCommission) / 100).toFixed(2)),
            partnerShip: 100,
            matchName: match?.title,
            matchStartDate: new Date(match?.startAt),
            userName: user.user.userName,
            matchType: marketBetType.SESSION
          });
        });
      }
    }


    sendMessageToUser(user.user.id, redisEventName, {
      ...user.user, betId, matchId, sessionExposure: redisSesionExposureValue, userBalanceData: {
        profitLoss: parseFloat(parseFloat(parseFloat(user.user.userBalance.profitLoss) + parseFloat(profitLoss)).toFixed(2)),
        myProfitLoss: parseFloat(parseFloat(parseFloat(user.user.userBalance.myProfitLoss) + parseFloat(profitLoss)).toFixed(2)),
        exposure: parseFloat(parseFloat(parseFloat(user.user.userBalance.exposure))),
        currentBalance: parseFloat(parseFloat(parseFloat(user.user.userBalance.currentBalance) + parseFloat(profitLoss)).toFixed(2))
      }
    });

    bulkWalletRecord.push(
      {
        matchId: matchId,
        actionBy: userId,
        searchId: user.user.id,
        userId: user.user.id,
        amount: profitLoss,
        transType: transTypes,
        closingBalance: userCurrBalance,
        description: description,
        betId: [betId],
        type: transactionType.sports
      }
    );

    if (user.user.createBy === user.user.id && !user.user.isDemo) {
      superAdminData[user.user.id] = {
        role: user.user.roleName,
        profitLoss: profitLoss,
        myProfitLoss: profitLoss,
        exposure: maxLoss,
        totalCommission: (commission[user.user.id] || 0)
      };
    }


    if (!user.user.isDemo) {
      let parentUsers = await getParentsWithBalance(user.user.id);
      for (const patentUser of parentUsers) {
        let upLinePartnership = 100;
        if (patentUser.roleName === userRoleConstant.superAdmin) {
          upLinePartnership = user.user.fwPartnership + user.user.faPartnership;
        } else if (patentUser.roleName === userRoleConstant.admin) {
          upLinePartnership = user.user.fwPartnership + user.user.faPartnership + user.user.saPartnership;
        } else if (patentUser.roleName === userRoleConstant.superMaster) {
          upLinePartnership = user.user.fwPartnership + user.user.faPartnership + user.user.saPartnership + user.user.aPartnership;
        } else if (patentUser.roleName === userRoleConstant.master) {
          upLinePartnership = user.user.fwPartnership + user.user.faPartnership + user.user.saPartnership + user.user.aPartnership + user.user.smPartnership;
        }
        else if (patentUser.roleName === userRoleConstant.agent) {
          upLinePartnership = user.user.fwPartnership + user.user.faPartnership + user.user.saPartnership + user.user.aPartnership + user.user.smPartnership + user.user.mPartnership;
        }
        let myProfitLoss = parseFloat(
          ((profitLoss * upLinePartnership) / 100).toString()
        );

        let parentCommission = parseFloat((((parseFloat(patentUser?.sessionCommission) * parseFloat(bulkCommission?.[user.user.id]?.reduce((prev, curr) => prev + curr.amount, 0) || 0)) / 10000) * parseFloat(upLinePartnership)).toFixed(2));

        if (upperUserObj[patentUser.id]) {
          upperUserObj[patentUser.id].profitLoss = upperUserObj[patentUser.id].profitLoss + profitLoss;
          upperUserObj[patentUser.id].myProfitLoss = upperUserObj[patentUser.id].myProfitLoss + myProfitLoss;
          upperUserObj[patentUser.id].exposure = upperUserObj[patentUser.id].exposure + maxLoss;

          if (patentUser?.sessionCommission && parseFloat(patentUser?.sessionCommission) != 0) {
            upperUserObj[patentUser.id].totalCommission += parentCommission;
          }
        } else {
          upperUserObj[patentUser.id] = { profitLoss: profitLoss, balance: 0, myProfitLoss: myProfitLoss, exposure: maxLoss, ...(patentUser?.sessionCommission && parseFloat(patentUser?.sessionCommission) != 0 ? { totalCommission: parentCommission } : {}) };
        }

        if (patentUser.createBy === patentUser.id) {
          superAdminData[patentUser.id] = {
            ...upperUserObj[patentUser.id],
            role: patentUser.roleName,
          };
        }

        if (patentUser?.sessionCommission) {

          bulkCommission[user?.user?.id]?.forEach((item) => {
            commissionReport.push({
              createBy: user.user.id,
              matchId: item.matchId,
              betId: item?.betId,
              betPlaceId: item?.betPlaceId,
              commissionAmount: parseFloat((parseFloat(item?.amount) * parseFloat(patentUser?.sessionCommission) / 100).toFixed(2)),
              parentId: patentUser.id,
              matchType: marketBetType.SESSION
            });
          });

          if (patentUser?.id == patentUser?.createBy) {
            bulkCommission[user?.user?.id]?.forEach((item) => {
              faAdminCal.commission.push({
                createBy: user.user.id,
                matchId: item.matchId,
                betId: item?.betId,
                betPlaceId: item?.betPlaceId,
                parentId: patentUser.id,
                teamName: item?.sessionName,
                betPlaceDate: new Date(item?.betPlaceDate),
                odds: item?.odds,
                betType: item?.betType,
                stake: item?.stake,
                commissionAmount: parseFloat((parseFloat(item?.amount) * parseFloat(patentUser?.sessionCommission) / 100).toFixed(2)),
                partnerShip: upLinePartnership,
                matchName: match?.title,
                matchStartDate: new Date(match?.startAt),
                userName: user.user.userName,
                matchType: marketBetType.SESSION
              });
            });
          }
        }
      }
      faAdminCal.userData[user.user.superParentId] = {
        profitLoss: profitLoss + (faAdminCal.userData?.[user.user.superParentId]?.profitLoss || 0),
        exposure: maxLoss + (faAdminCal.userData?.[user.user.superParentId]?.exposure || 0),
        myProfitLoss: parseFloat(faAdminCal.userData?.[user.user.superParentId]?.profitLoss || 0) + parseFloat(parseFloat((profitLoss) * (user.user.superParentType == userRoleConstant.fairGameAdmin ? (parseFloat(user.user.fwPartnership) / 100) : 1)).toFixed(2)),
        totalCommission: parseFloat((parseFloat(bulkCommission?.[user.user.id]?.reduce((prev, curr) => prev + curr.amount, 0)) * (user.user.superParentType == userRoleConstant.fairGameAdmin ? parseFloat(user.user.fwPartnership) / 100 : 1)).toFixed(2)) + (faAdminCal.userData?.[user.user.superParentId]?.totalCommission || 0),
        role: user.user.superParentType
      }
    }

  };
  return { fwProfitLoss, faAdminCal: JSON.stringify(faAdminCal), superAdminData: JSON.stringify(superAdminData), bulkCommission: JSON.stringify(bulkCommission) };
}


exports.declareSessionNoResult = async (call) => {
  try {
    const { betId, score, matchId } = call.request;

    logger.info({
      message: "Session no result declared.",
      data: {
        betId, score
      }
    });

    let users = await getDistinctUserBetPlaced(betId);

    await updatePlaceBet({ betId: betId }, { result: betResultStatus.TIE });

    let upperUserObj = {};
    const profitLossData = await calculateMaxLossSessionForUserNoResult(
      users,
      betId,
      matchId,
      socketData.sessionNoResult,
      upperUserObj
    );

    logger.info({
      message: "Upper user for this bet.",
      data: { upperUserObj, betId }
    });

    for (let [key, value] of Object.entries(upperUserObj)) {
      let parentUser = await getUserBalanceDataByUserId(key);

      let parentUserRedisData = await getUserRedisData(parentUser.userId);

      let parentExposure = parentUser?.exposure || 0;
      if (parentUserRedisData?.exposure) {
        parentExposure = parseFloat(parentUserRedisData?.exposure);
      }

      parentUser.exposure = parentExposure - value["exposure"];
      if (parentUser.exposure < 0) {
        logger.info({
          message: "Exposure in negative for user: ",
          data: {
            betId,
            matchId,
            parentUser,
          },
        });

        value["exposure"] += parentUser.exposure;
        parentUser.exposure = 0;
      }
      await updateUserExposure(key, -value["exposure"]);

      logger.info({
        message: "Declare result db update for parent ",
        data: {
          betId,
          parentUser,
        },
      });

      const redisSessionExposureName = redisKeys.userSessionExposure + matchId;

      if (
        parentUserRedisData?.exposure
      ) {
        await incrementValuesRedis(key, {
          [redisSessionExposureName]: -value["exposure"],
          exposure: -value["exposure"]
        });
        await deleteKeyFromUserRedis(key, betId + "_profitLoss");
      }
      sendMessageToUser(key, socketData.sessionResult, {
        ...parentUser,
        betId,
        matchId,
        sessionExposure: parentUserRedisData?.[redisSessionExposureName] - value["exposure"],
      });
    }


    return { data: profitLossData }

  } catch (error) {
    logger.error({
      error: `Error at declare session no result for the user.`,
      stack: error.stack,
      message: error.message,
    });
    // Handle any errors and return an error response
    throw {
      code: grpc.status.INTERNAL,
      message: error?.message || __mf("internalServerError"),
    };
  }
}

const calculateMaxLossSessionForUserNoResult = async (
  users,
  betId,
  matchId,
  redisEventName,
  upperUserObj
) => {
  let faAdminCal = {};
  let superAdminData = {};

  for (const user of users) {
    let userRedisData = await getUserRedisData(user.user.id);
    let maxLoss = 0;
    let redisSesionExposureValue = 0;
    let redisSesionExposureName = redisKeys.userSessionExposure + matchId;
    redisSesionExposureValue = parseFloat(
      userRedisData?.[redisSesionExposureName] || 0
    );

    logger.info({ message: "Updated users", data: user.user });
    logger.info({
      redisSessionExposureValue: redisSesionExposureValue,
      sessionBet: true,
    });

    // check if data is already present in the redis or not
    if (userRedisData?.[betId + "_profitLoss"]) {
      let redisData = JSON.parse(userRedisData[betId + "_profitLoss"]);
      maxLoss = redisData.maxLoss || 0;
    } else {
      // if data is not available in the redis then get data from redis and find max loss amount for all placed bet by user
      let redisData = await calculateProfitLossForSessionToResult(
        betId,
        user.user?.id
      );
      maxLoss = redisData.maxLoss || 0;
    }
    redisSesionExposureValue = redisSesionExposureValue - maxLoss;

    user.user.userBalance.exposure = user.user.userBalance.exposure - maxLoss;

    logger.info({
      message: "Update user exposure.",
      data: {
        userExposure: user.user.userBalance.exposure,
        maxLoss: maxLoss,
        userRedisExposure: redisSesionExposureValue,
      },
    });

    if (userRedisData?.exposure) {
      await incrementValuesRedis(user.user.id, {
        [redisSesionExposureName]: -maxLoss,
        exposure: -maxLoss,

      });
      await deleteKeyFromUserRedis(user.user.id, betId + "_profitLoss");
    }

    await updateUserExposure(user.user.id, -maxLoss);

    if (user.user.createBy === user.user.id && !user.user.isDemo) {
      superAdminData[user.user.id] = { exposure: maxLoss };
    }

    sendMessageToUser(user.user.id, redisEventName, {
      ...user.user,
      betId,
      matchId,
      sessionExposure: redisSesionExposureValue,
      userBalanceData: user.user.userBalance
    });

    if (!user.user.isDemo) {
      let parentUsers = await getParentsWithBalance(user.user.id);

      for (const patentUser of parentUsers) {
        if (upperUserObj[patentUser.id]) {
          upperUserObj[patentUser.id].exposure =
            upperUserObj[patentUser.id].exposure + maxLoss;
        } else {
          upperUserObj[patentUser.id] = { exposure: maxLoss };
        }


        if (patentUser.createBy === patentUser.id) {
          superAdminData[patentUser.id] = upperUserObj[patentUser.id];
        }
      }
      faAdminCal[user.user.superParentId] = {
        exposure: maxLoss + (faAdminCal?.[user.user.superParentId]?.exposure || 0),
        role: user.user.superParentType
      }
    }
  }
  return { faAdminCal: JSON.stringify(faAdminCal), superAdminData: JSON.stringify(superAdminData) };
};

exports.unDeclareSessionResult = async (call) => {
  try {

    const { betId, matchId, sessionDetails, userId } = call.request;
    const matchDetail = await getMatchData({ id: matchId }, ["id", "teamC"]);
    logger.info({
      message: "Session result un declared.",
      data: {
        betId
      }
    });

    let users = await getDistinctUserBetPlaced(betId);

    let upperUserObj = {};
    let bulkWalletRecord = [];
    const commissionData = await getCombinedCommission(betId);
    const profitLossData = await calculateProfitLossSessionForUserUnDeclare(
      users,
      betId,
      matchId,
      0,
      sessionDetails,
      socketData.sessionResultUnDeclare,
      userId,
      bulkWalletRecord,
      upperUserObj,
      matchDetail,
      commissionData
    );
    deleteCommission(betId);
    insertBulkTransactions(bulkWalletRecord);
    logger.info({
      message: "Upper user for this bet.",
      data: { upperUserObj, betId }
    });

    const redisSessionExposureName = redisKeys.userSessionExposure + matchId;

    const userEntries = Object.entries(upperUserObj);
    if (!userEntries.length) return;

    // 1️⃣ Fetch all current balances in one Redis pipeline
    const balanceResponses = await internalRedis.pipeline(
      userEntries.map(([userId]) =>
        ['hmget', userId, 'profitLoss', 'myProfitLoss', 'exposure', 'totalCommission']
      )
    ).exec();

    // 2️⃣ Compute deltas, queue Redis updates, and send socket messages
    const updatePipeline = internalRedis.pipeline();

    userEntries.forEach(([userId, updateData], idx) => {
      upperUserObj[userId].profitLoss = -upperUserObj[userId].profitLoss;
      upperUserObj[userId].totalCommission = -upperUserObj[userId].totalCommission;

      if (balanceResponses[idx][1]?.filter((items) => items != null).length) {
        const [plStr, mplStr, expStr, comStr] = balanceResponses[idx][1];
        const currentProfitLoss = +plStr || 0;
        const currentMyProfitLoss = +mplStr || 0;
        const currentExposure = +expStr || 0;
        const currentTotalCommission = +comStr || 0;


        const profitLossDelta = -(+updateData.profitLoss) || 0;
        const myProfitLossDelta = (+updateData.myProfitLoss) || 0;
        const rawExposureDelta = (+updateData.exposure) || 0;
        const commissionDelta = -(+updateData.totalCommission) || 0;

        // clamp exposure and adjust leftover
        let newExposure = currentExposure + rawExposureDelta;
        let adjustedExposure = rawExposureDelta;
        if (newExposure < 0) {
          logger.info({
            message: 'Exposure went negative',
            data: { matchId, betId, userId, before: currentExposure, delta: rawExposureDelta }
          });
          adjustedExposure += newExposure;  // fold leftover back
          newExposure = 0;
        }

        let parentRedisUpdateObj = {
          [betId + redisKeys.profitLoss]: JSON.stringify(updateData?.profitLossObj)
        };

        // queue Redis increments & key deletion
        updatePipeline
          .hincrbyfloat(userId, 'profitLoss', profitLossDelta)
          .hincrbyfloat(userId, 'myProfitLoss', myProfitLossDelta)
          .hincrbyfloat(userId, 'exposure', adjustedExposure)
          .hincrbyfloat(userId, [redisSessionExposureName], adjustedExposure)
          .hmset(userId, parentRedisUpdateObj);

        logger.info({
          message: "Un Declare session result db update for parent ",
          data: {
            parentUser: {
              profitLoss: currentProfitLoss + profitLossDelta,
              myProfitLoss: currentMyProfitLoss + myProfitLossDelta,
              exposure: newExposure,
              totalCommission: currentTotalCommission + commissionDelta,
            },
            betId: betId
          },
        });

        // fire-and-forget socket notification
        sendMessageToUser(userId, socketData.matchResultUnDeclare, {
          profitLoss: currentProfitLoss + profitLossDelta,
          myProfitLoss: currentMyProfitLoss + myProfitLossDelta,
          exposure: newExposure,
          totalCommission: currentTotalCommission + commissionDelta,
          betId: betId,
          profitLossData: updateData?.profitLossObj,
          matchId
        });
      }
    });

    await Promise.all([updatePipeline.exec(), updateUserDeclareBalanceData(upperUserObj)]);

    let userIds = users.map(user => user.createBy);
    await updatePlaceBet(
      {
        betId: betId,
        deleteReason: IsNull(),
        createBy: In(userIds)
      },
      {
        result: betResultStatus.PENDING,
      }
    );

    return { data: profitLossData }

  } catch (error) {
    logger.error({
      error: `Error at un declare session result for the user.`,
      stack: error.stack,
      message: error.message,
    });
    // Handle any errors and return an error response
    throw {
      code: grpc.status.INTERNAL,
      message: error?.message || __mf("internalServerError"),
    };
  }
}

const calculateProfitLossSessionForUserUnDeclare = async (users, betId, matchId, fwProfitLoss, resultDeclare, redisEventName, userId, bulkWalletRecord, upperUserObj, matchDetail, commissionData) => {

  let faAdminCal = { userData: {}, walletData: {} };
  let superAdminData = {};

  for (const user of users) {
    let getWinAmount = 0;
    let getLossAmount = 0;
    let profitLoss = 0;
    let userRedisData = await getUserRedisData(user.user.id);
    let getMultipleAmount = await getMultipleAccountProfitLoss(betId, user.user.id);
    let maxLoss = 0;
    let redisSesionExposureValue = 0;
    let redisSesionExposureName = redisKeys.userSessionExposure + matchId;
    redisSesionExposureValue = parseFloat(userRedisData?.[redisSesionExposureName] || 0);
    logger.info({ message: "Updated users", data: user.user });
    logger.info({
      redisSessionExposureValue: redisSesionExposureValue,
      sessionBet: true,
    });


    // if data is not available in the redis then get data from redis and find max loss amount for all placed bet by user
    let betPlace = await findAllPlacedBetWithUserIdAndBetId(user?.user?.id, betId);
    let redisData = await calculatePLAllBet(betPlace, betPlace?.[0]?.marketType, 100, null, null, matchDetail);
    maxLoss = redisData.maxLoss || 0;

    redisSesionExposureValue = redisSesionExposureValue + maxLoss;

    logger.info({
      maxLoss: maxLoss,
      userExposure: redisSesionExposureValue
    });

    user.user.userBalance.exposure = user.user.userBalance.exposure + maxLoss;
    logger.info({
      message: "Update user exposure.",
      data: user.user.exposure
    });

    getWinAmount = getMultipleAmount?.[0]?.winamount || 0;
    getLossAmount = getMultipleAmount?.[0]?.lossamount || 0;
    profitLoss = parseFloat(getWinAmount.toString()) - parseFloat(getLossAmount.toString());

    fwProfitLoss = parseFloat(fwProfitLoss.toString()) - parseFloat(((-profitLoss * user.user.fwPartnership) / 100).toString());

    const userCurrBalance = Number(
      (user.user.userBalance.currentBalance - profitLoss).toFixed(2)
    );

    let userBalanceData = {
      profitLoss: -profitLoss,
      myProfitLoss: -profitLoss,
      exposure: maxLoss,
    }

    let userCommission = commissionData?.find((item) => item?.userId == user.user.id);
    if (userCommission) {
      userBalanceData.totalCommission = - parseFloat(commissionData?.find((item) => item?.userId == user.user.id)?.amount || 0);
    }

    if (user.user.createBy === user.user.id && !user.user.isDemo) {
      superAdminData[user.user.id] = {
        role: user.user.roleName,
        profitLoss: profitLoss,
        myProfitLoss: profitLoss,
        exposure: maxLoss,
        totalCommission: parseFloat(commissionData?.find((item) => item?.userId == user.user.id)?.amount || 0)
      };
    }

    await updateUserBalanceData(user.user.id, userBalanceData);


    if (userRedisData?.exposure) {
      const { totalCommission, ...userBalance } = userBalanceData;

      await incrementValuesRedis(user.user.id, {
        ...userBalance,
        currentBalance: -profitLoss,
        [redisSesionExposureName]: maxLoss,
      }, {
        [betId + redisKeys.profitLoss]: JSON.stringify({
          upperLimitOdds: redisData?.betData?.[redisData?.betData?.length - 1]?.odds,
          lowerLimitOdds: redisData?.betData?.[0]?.odds,
          betPlaced: redisData?.betData,
          maxLoss: redisData?.maxLoss,
          totalBet: redisData.total_bet
        }),
      });
    }
    logger.info({
      message: "user save at un declare result",
      data: user
    })

    sendMessageToUser(user.user.id, redisEventName, {
      ...user.user, betId, matchId,
      userBalanceData: {
        currentBalance: userCurrBalance,
        profitLoss: user.user.userBalance.profitLoss - profitLoss,
        myProfitLoss: user.user.userBalance.myProfitLoss - profitLoss,
        exposure: user.user.userBalance.exposure,
        totalCommission: parseFloat(user.user.userBalance.totalCommission) - parseFloat(commissionData?.find((item) => item?.userId == user.user.id)?.amount || 0)
      },
      profitLossData: JSON.stringify({
        upperLimitOdds: redisData?.betData?.[redisData?.betData?.length - 1]?.odds,
        lowerLimitOdds: redisData?.betData?.[0]?.odds,
        betPlaced: redisData?.betData,
        maxLoss: redisData?.maxLoss,
        totalBet: redisData.total_bet
      }),
      sessionDetails: resultDeclare

    });

    if (betPlace?.[0]?.result != resultType.tie) {
      bulkWalletRecord.push(
        {
          matchId: matchId,
          actionBy: userId,
          searchId: user.user.id,
          userId: user.user.id,
          amount: -profitLoss,
          transType: -profitLoss < 0 ? transType.loss : transType.win,
          closingBalance: userCurrBalance,
          description: `Revert ${user?.eventType}/${user?.eventName}/session`,
          betId: [betId],
          type: transactionType.sports
        }
      );
    }

    if (!user.user.isDemo) {
      let parentUsers = await getParentsWithBalance(user.user.id);

      for (const patentUser of parentUsers) {
        let upLinePartnership = 100;
        if (patentUser.roleName === userRoleConstant.superAdmin) {
          upLinePartnership = user.user.fwPartnership + user.user.faPartnership;
        } else if (patentUser.roleName === userRoleConstant.admin) {
          upLinePartnership = user.user.fwPartnership + user.user.faPartnership + user.user.saPartnership;
        } else if (patentUser.roleName === userRoleConstant.superMaster) {
          upLinePartnership = user.user.fwPartnership + user.user.faPartnership + user.user.saPartnership + user.user.aPartnership;
        } else if (patentUser.roleName === userRoleConstant.master) {
          upLinePartnership = user.user.fwPartnership + user.user.faPartnership + user.user.saPartnership + user.user.aPartnership + user.user.smPartnership;
        }
        else if (patentUser.roleName === userRoleConstant.agent) {
          upLinePartnership = user.user.fwPartnership + user.user.faPartnership + user.user.saPartnership + user.user.aPartnership + user.user.smPartnership + user.user.mPartnership;
        }
        let myProfitLoss = parseFloat(
          ((profitLoss * upLinePartnership) / 100).toString()
        );

        if (upperUserObj[patentUser.id]) {
          upperUserObj[patentUser.id].profitLoss = upperUserObj[patentUser.id].profitLoss + profitLoss;
          upperUserObj[patentUser.id].myProfitLoss = upperUserObj[patentUser.id].myProfitLoss + myProfitLoss;
          upperUserObj[patentUser.id].exposure = upperUserObj[patentUser.id].exposure + maxLoss;

          for (const placedBets of betPlace) {
            switch (placedBets?.marketType) {
              case sessionBettingType.session:
              case sessionBettingType.overByOver:
              case sessionBettingType.ballByBall:
                upperUserObj[patentUser.id].profitLossObj = await calculateProfitLossSession(
                  upperUserObj[patentUser.id].profitLossObj,
                  {
                    betPlacedData: {
                      betType: placedBets?.betType,
                      odds: placedBets?.odds,
                    },
                    lossAmount: placedBets?.lossAmount,
                    winAmount: placedBets?.winAmount,
                  },
                  user?.user[`${partnershipPrefixByRole[patentUser?.roleName]}Partnership`]
                );
                break;
              case sessionBettingType.khado:
                upperUserObj[patentUser.id].profitLossObj = await calculateProfitLossKhado(
                  upperUserObj[patentUser.id].profitLossObj,
                  {
                    betPlacedData: {
                      betType: placedBets?.betType,
                      odds: placedBets?.odds,
                      eventName: placedBets?.eventName
                    },
                    lossAmount: placedBets?.lossAmount,
                    winAmount: placedBets?.winAmount,
                  },
                  user?.user[`${partnershipPrefixByRole[patentUser?.roleName]}Partnership`]
                );
                break;
              case sessionBettingType.meter:
                upperUserObj[patentUser.id].profitLossObj = await calculateProfitLossMeter(
                  upperUserObj[patentUser.id].profitLossObj,
                  {
                    betPlacedData: {
                      betType: placedBets?.betType,
                      odds: placedBets?.odds,
                      rate: placedBets?.rate,
                      stake: placedBets?.amount,
                      isTeamC: !!matchDetail?.teamC
                    },
                    lossAmount: placedBets?.lossAmount,
                    winAmount: placedBets?.winAmount,
                  },
                  user?.user[`${partnershipPrefixByRole[patentUser?.roleName]}Partnership`]
                );
                break;
              case sessionBettingType.oddEven:
                upperUserObj[patentUser.id].profitLossObj = await calculateProfitLossSessionOddEven(
                  upperUserObj[patentUser.id].profitLossObj,
                  {
                    betPlacedData: {
                      betType: placedBets?.betType,
                      odds: placedBets?.odds,
                      teamName: placedBets?.teamName?.split("-")?.pop()?.trim()
                    },
                    lossAmount: -placedBets?.lossAmount,
                    winAmount: -placedBets?.winAmount,
                  },
                  user?.user[`${partnershipPrefixByRole[patentUser?.roleName]}Partnership`]);
                break;
              case sessionBettingType.cricketCasino:
                upperUserObj[patentUser.id].profitLossObj = await calculateProfitLossSessionCasinoCricket(
                  upperUserObj[patentUser.id].profitLossObj,
                  {
                    betPlacedData: {
                      betType: placedBets?.betType,
                      odds: placedBets?.odds,
                      teamName: placedBets?.teamName?.split("-")?.pop()?.trim()
                    },
                    lossAmount: -placedBets?.lossAmount,
                    winAmount: -placedBets?.winAmount,
                  },
                  user?.user[`${partnershipPrefixByRole[patentUser?.roleName]}Partnership`]);
                break;
              case sessionBettingType.fancy1:
                upperUserObj[patentUser.id].profitLossObj = await calculateProfitLossSessionFancy1(
                  upperUserObj[patentUser.id].profitLossObj,
                  {
                    betPlacedData: {
                      betType: placedBets?.betType,
                      odds: placedBets?.odds,
                    },
                    lossAmount: -placedBets?.lossAmount,
                    winAmount: -placedBets?.winAmount,
                  },
                  user?.user[`${partnershipPrefixByRole[patentUser?.roleName]}Partnership`]);
                break;
              default:
                break;
            }

          }
        } else {
          upperUserObj[patentUser.id] = { profitLoss: profitLoss, myProfitLoss: myProfitLoss, exposure: maxLoss, balance: 0 };
          let userCommission = commissionData?.find((item) => item?.userId == patentUser.id);
          if (userCommission) {
            upperUserObj[patentUser.id].totalCommission = parseFloat((parseFloat(commissionData?.find((item) => item?.userId == patentUser.id)?.amount || 0) * parseFloat(upLinePartnership) / 100).toFixed(2));
          }
          const betPlaceProfitLoss = await calculatePLAllBet(betPlace, betPlace?.[0]?.marketType, -user?.user[`${partnershipPrefixByRole[patentUser?.roleName]}Partnership`], null, null, matchDetail);

          upperUserObj[patentUser.id] = {
            ...upperUserObj[patentUser.id], profitLossObj: {
              upperLimitOdds: betPlaceProfitLoss?.betData?.[betPlaceProfitLoss?.betData?.length - 1]?.odds,
              lowerLimitOdds: betPlaceProfitLoss?.betData?.[0]?.odds,
              betPlaced: betPlaceProfitLoss?.betData,
              maxLoss: betPlaceProfitLoss?.maxLoss,
              totalBet: betPlaceProfitLoss?.total_bet
            }
          };

        }

        if (patentUser.createBy === patentUser.id) {
          superAdminData[patentUser.id] = {
            ...upperUserObj[patentUser.id],
            role: patentUser.roleName,
          };
        }
      }


      if (!faAdminCal.walletData.profitLossObjWallet) {
        const betPlaceProfitLoss = await calculatePLAllBet(
          betPlace,
          betPlace?.[0]?.marketType,
          -user?.user[`fwPartnership`],
          null, null, matchDetail
        );
        faAdminCal.walletData.profitLossObjWallet = {
          upperLimitOdds: betPlaceProfitLoss?.betData?.[betPlaceProfitLoss?.betData?.length - 1]?.odds,
          lowerLimitOdds: betPlaceProfitLoss?.betData?.[0]?.odds,
          betPlaced: betPlaceProfitLoss?.betData,
          maxLoss: betPlaceProfitLoss?.maxLoss,
          totalBet: betPlaceProfitLoss?.total_bet
        };
      } else {
        for (const placedBets of betPlace) {
          switch (placedBets?.marketType) {
            case sessionBettingType.session:
            case sessionBettingType.overByOver:
            case sessionBettingType.ballByBall:
              faAdminCal.walletData.profitLossObjWallet = await calculateProfitLossSession(
                faAdminCal.walletData.profitLossObjWallet,
                {
                  betPlacedData: {
                    betType: placedBets?.betType,
                    odds: placedBets?.odds,
                  },
                  lossAmount: placedBets?.lossAmount,
                  winAmount: placedBets?.winAmount,
                },
                user?.user[`fwPartnership`]
              );
              break;
            case sessionBettingType.khado:
              faAdminCal.walletData.profitLossObjWallet = await calculateProfitLossKhado(
                faAdminCal.walletData.profitLossObjWallet,
                {
                  betPlacedData: {
                    betType: placedBets?.betType,
                    odds: placedBets?.odds,
                    eventName: placedBets?.eventName
                  },
                  lossAmount: placedBets?.lossAmount,
                  winAmount: placedBets?.winAmount,
                },
                user?.user[`fwPartnership`]
              );
              break;
            case sessionBettingType.meter:
              faAdminCal.walletData.profitLossObjWallet = await calculateProfitLossMeter(
                faAdminCal.walletData.profitLossObjWallet,
                {
                  betPlacedData: {
                    betType: placedBets?.betType,
                    odds: placedBets?.odds,
                    rate: placedBets?.rate,
                    stake: placedBets?.amount,
                    isTeamC: !!matchDetail?.teamC
                  },
                  lossAmount: placedBets?.lossAmount,
                  winAmount: placedBets?.winAmount,
                },
                user?.user[`fwPartnership`]
              );
              break;
            case sessionBettingType.oddEven:
              faAdminCal.walletData.profitLossObjWallet = await calculateProfitLossSessionOddEven(
                faAdminCal.walletData.profitLossObjWallet,
                {
                  betPlacedData: {
                    betType: placedBets?.betType,
                    odds: placedBets?.odds,
                    teamName: placedBets?.teamName?.split("-")?.pop()?.trim()
                  },
                  lossAmount: -placedBets?.lossAmount,
                  winAmount: -placedBets?.winAmount,
                },
                user?.user[`fwPartnership`]);
              break;
            case sessionBettingType.cricketCasino:
              faAdminCal.walletData.profitLossObjWallet = await calculateProfitLossSessionCasinoCricket(
                faAdminCal.walletData.profitLossObjWallet,
                {
                  betPlacedData: {
                    betType: placedBets?.betType,
                    odds: placedBets?.odds,
                    teamName: placedBets?.teamName?.split("-")?.pop()?.trim()
                  },
                  lossAmount: -placedBets?.lossAmount,
                  winAmount: -placedBets?.winAmount,
                },
                user?.user[`fwPartnership`]);
              break;
            case sessionBettingType.fancy1:
              faAdminCal.walletData.profitLossObjWallet = await calculateProfitLossSessionFancy1(
                faAdminCal.walletData.profitLossObjWallet,
                {
                  betPlacedData: {
                    betType: placedBets?.betType,
                    odds: placedBets?.odds,
                  },
                  lossAmount: -placedBets?.lossAmount,
                  winAmount: -placedBets?.winAmount,
                },
                user?.user[`fwPartnership`]);
              break;
            default:
              break;
          }

        }
      }
      if (user.user.superParentType == userRoleConstant.fairGameAdmin) {
        if (!faAdminCal.userData[user.user.superParentId]) {
          faAdminCal.userData[user.user.superParentId] = {};
          const betPlaceProfitLoss = await calculatePLAllBet(
            betPlace,
            betPlace?.[0]?.marketType,
            -user?.user[`faPartnership`],
            null, null, matchDetail
          );
          faAdminCal.userData[user.user.superParentId].profitLossData = {
            upperLimitOdds: betPlaceProfitLoss?.betData?.[betPlaceProfitLoss?.betData?.length - 1]?.odds,
            lowerLimitOdds: betPlaceProfitLoss?.betData?.[0]?.odds,
            betPlaced: betPlaceProfitLoss?.betData,
            maxLoss: betPlaceProfitLoss?.maxLoss,
            totalBet: betPlaceProfitLoss?.total_bet
          };
        } else {
          for (const placedBets of betPlace) {
            switch (placedBets?.marketType) {
              case sessionBettingType.session:
              case sessionBettingType.overByOver:
              case sessionBettingType.ballByBall:
                faAdminCal.userData[user.user.superParentId].profitLossData = await calculateProfitLossSession(
                  faAdminCal.userData[user.user.superParentId].profitLossData,
                  {
                    betPlacedData: {
                      betType: placedBets?.betType,
                      odds: placedBets?.odds,
                    },
                    lossAmount: placedBets?.lossAmount,
                    winAmount: placedBets?.winAmount,
                  },
                  user?.user[`faPartnership`]
                );
                break;
              case sessionBettingType.khado:
                faAdminCal.userData[user.user.superParentId].profitLossData = await calculateProfitLossKhado(
                  faAdminCal.userData[user.user.superParentId].profitLossData,
                  {
                    betPlacedData: {
                      betType: placedBets?.betType,
                      odds: placedBets?.odds,
                      eventName: placedBets?.eventName
                    },
                    lossAmount: placedBets?.lossAmount,
                    winAmount: placedBets?.winAmount,
                  },
                  user?.user[`faPartnership`]
                );
                break;
              case sessionBettingType.meter:
                faAdminCal.userData[user.user.superParentId].profitLossData = await calculateProfitLossMeter(
                  faAdminCal.userData[user.user.superParentId].profitLossData,
                  {
                    betPlacedData: {
                      betType: placedBets?.betType,
                      odds: placedBets?.odds,
                      stake: placedBets?.amount,
                      rate: placedBets?.rate,
                      isTeamC: !!matchDetail?.teamC
                    },
                    lossAmount: placedBets?.lossAmount,
                    winAmount: placedBets?.winAmount,
                  },
                  user?.user[`faPartnership`]
                );
                break;
              case sessionBettingType.oddEven:
                faAdminCal.userData[user.user.superParentId].profitLossData = await calculateProfitLossSessionOddEven(faAdminCal.userData[user.user.superParentId].profitLossData,
                  {
                    betPlacedData: {
                      betType: placedBets?.betType,
                      odds: placedBets?.odds,
                      teamName: placedBets?.teamName?.split("-")?.pop()?.trim()
                    },
                    lossAmount: -placedBets?.lossAmount,
                    winAmount: -placedBets?.winAmount,
                  },
                  user?.user[`faPartnership`]);
                break;
              case sessionBettingType.cricketCasino:
                faAdminCal.userData[user.user.superParentId].profitLossData = await calculateProfitLossSessionCasinoCricket(faAdminCal.userData[user.user.superParentId].profitLossData,
                  {
                    betPlacedData: {
                      betType: placedBets?.betType,
                      odds: placedBets?.odds,
                      teamName: placedBets?.teamName?.split("-")?.pop()?.trim()
                    },
                    lossAmount: -placedBets?.lossAmount,
                    winAmount: -placedBets?.winAmount,
                  },
                  user?.user[`faPartnership`]);
                break;
              case sessionBettingType.fancy1:
                faAdminCal.userData[user.user.superParentId].profitLossData = await calculateProfitLossSessionFancy1(faAdminCal.userData[user.user.superParentId].profitLossData,
                  {
                    betPlacedData: {
                      betType: placedBets?.betType,
                      odds: placedBets?.odds,
                    },
                    lossAmount: -placedBets?.lossAmount,
                    winAmount: -placedBets?.winAmount,
                  },
                  user?.user[`faPartnership`]);
                break;
              default:
                break;
            }
          }
        }
      }

      faAdminCal.userData[user.user.superParentId] = {
        ...faAdminCal.userData[user.user.superParentId],
        profitLoss: profitLoss + (faAdminCal.userData[user.user.superParentId]?.profitLoss || 0),
        exposure: maxLoss + (faAdminCal.userData[user.user.superParentId]?.exposure || 0),
        myProfitLoss: parseFloat((parseFloat(faAdminCal.userData[user.user.superParentId]?.myProfitLoss || 0) + (parseFloat(profitLoss) * parseFloat(user.user.fwPartnership) / 100)).toFixed(2)),
        role: user.user.superParentType
      }
    }

  };
  return { fwProfitLoss, faAdminCal: JSON.stringify(faAdminCal), superAdminData: JSON.stringify(superAdminData) };
}