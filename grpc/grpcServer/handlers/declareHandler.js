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
} = require("../../../config/contants");
const { logger } = require("../../../config/logger");
const { getMatchBetPlaceWithUser, addNewBet, getMultipleAccountProfitLoss, getDistinctUserBetPlaced } = require("../../../services/betPlacedService");
const {
  calculateProfitLossForSessionToResult,
  insertBulkTransactions,
  insertBulkCommissions,
} = require("../../../services/commonService");

const { getUserRedisData, deleteKeyFromUserRedis, incrementValuesRedis } = require("../../../services/redis/commonfunction");
const {
  getUserBalanceDataByUserId,
  updateUserBalanceData,
} = require("../../../services/userBalanceService");
const {
  getParentsWithBalance,
} = require("../../../services/userService");
const { sendMessageToUser } = require("../../../sockets/socketManager");


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

    for (let [key, value] of Object.entries(upperUserObj)) {
      let parentUser = await getUserBalanceDataByUserId(key);

      let parentUserRedisData = await getUserRedisData(parentUser.userId);

      let parentProfitLoss = parentUser?.profitLoss || 0;
      if (parentUserRedisData?.profitLoss) {
        parentProfitLoss = parseFloat(parentUserRedisData.profitLoss);
      }
      let parentMyProfitLoss = parentUser?.myProfitLoss || 0;
      if (parentUserRedisData?.myProfitLoss) {
        parentMyProfitLoss = parseFloat(parentUserRedisData.myProfitLoss);
      }
      let parentExposure = parentUser?.exposure || 0;
      if (parentUserRedisData?.exposure) {
        parentExposure = parseFloat(parentUserRedisData?.exposure);
      }

      parentUser.profitLoss = parentProfitLoss + value?.["profitLoss"];
      parentUser.myProfitLoss = parentMyProfitLoss - value["myProfitLoss"];
      parentUser.exposure = parentExposure - value["exposure"];
      parentUser.totalCommission = (parentUser.totalCommission || 0) + (value["totalCommission"] || 0);
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

      await updateUserBalanceData(key, {
        balance: 0,
        profitLoss: value?.["profitLoss"],
        myProfitLoss: -value["myProfitLoss"],
        exposure: -value["exposure"],
        totalCommission: value["totalCommission"] || 0
      });

      logger.info({
        message: "Declare result db update for parent ",
        data: {
          betId,
          parentUser,
        },
      });

      const redisSessionExposureName = redisKeys.userSessionExposure + matchId;

      if (parentUserRedisData?.exposure) {
        await incrementValuesRedis(key, {
          profitLoss: value?.["profitLoss"],
          myProfitLoss: -value["myProfitLoss"],
          exposure: -value["exposure"],
          [redisSessionExposureName]: -value["exposure"]
        });
        await deleteKeyFromUserRedis(key, betId + "_profitLoss");
      }

      sendMessageToUser(key, socketData.sessionResult, {
        ...parentUser,
        betId,
        matchId
      });
    }
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
          upperUserObj[patentUser.id] = { profitLoss: profitLoss, myProfitLoss: myProfitLoss, exposure: maxLoss, ...(patentUser?.sessionCommission && parseFloat(patentUser?.sessionCommission) != 0 ? { totalCommission: parentCommission } : {}) };
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
  return { fwProfitLoss, faAdminCal:JSON.stringify(faAdminCal), superAdminData:JSON.stringify(superAdminData), bulkCommission:JSON.stringify(bulkCommission) };
}