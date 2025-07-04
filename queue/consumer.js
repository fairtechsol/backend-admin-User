const Queue = require('bee-queue');
const lodash = require('lodash');
const { getUserRedisData, incrementValuesRedis } = require('../services/redis/commonfunction');
const { redisKeys, userRoleConstant, socketData, partnershipPrefixByRole, sessionBettingType, jobQueueConcurrent } = require('../config/contants');
const { logger } = require('../config/logger');
const { updateUserExposure } = require('../services/userBalanceService');
const { calculateProfitLossSession, parseRedisData, calculateRacingExpertRate, calculateProfitLossSessionOddEven, calculateProfitLossSessionCasinoCricket, calculateProfitLossSessionFancy1, calculateProfitLossKhado, calculateProfitLossMeter } = require('../services/commonService');
const { sendMessageToUser } = require('../sockets/socketManager');
const { CardProfitLoss } = require('../services/cardService/cardProfitLossCalc');

const options = {
  removeOnSuccess: true,
  redis: {
    host: process.env.INTERNAL_REDIS_HOST,
    port: process.env.INTERNAL_REDIS_PORT,
    password: process.env.INTERNAL_REDIS_PASSWORD
  }
}

const MatchTournamentBetQueue = new Queue('matchTournamentBetQueue', options);
const SessionMatchBetQueue = new Queue('sessionMatchBetQueue', options);

const CardMatchBetQueue = new Queue('cardMatchBetQueue', options);

const externalRedisOption = {
  removeOnSuccess: true,
  redis: {
    port: process.env.EXTERNAL_REDIS_PORT,
    host: process.env.EXTERNAL_REDIS_HOST
  }
}

const WalletSessionBetQueue = new Queue('walletSessionBetQueue', externalRedisOption);
const WalletMatchTournamentBetQueue = new Queue('walletMatchTournamentBetQueue', externalRedisOption);
const WalletCardMatchBetQueue = new Queue('walletCardMatchBetQueue', externalRedisOption);
const walletSessionBetDeleteQueue = new Queue('walletSessionBetDeleteQueue', externalRedisOption);
const walletTournamentMatchBetDeleteQueue = new Queue('walletTournamentMatchBetDeleteQueue', externalRedisOption);


const ExpertSessionBetQueue = new Queue('expertSessionBetQueue', externalRedisOption);
const ExpertMatchTournamentBetQueue = new Queue('expertMatchTournamentBetQueue', externalRedisOption);
const expertSessionBetDeleteQueue = new Queue('expertSessionBetDeleteQueue', externalRedisOption);
const expertTournamentMatchBetDeleteQueue = new Queue('expertTournamentMatchBetDeleteQueue', externalRedisOption);

SessionMatchBetQueue.process(jobQueueConcurrent, async function (job, done) {
  let jobData = job.data;
  let userId = jobData.userId;
  let userRedisData = await getUserRedisData(userId);
  try {
    if (!lodash.isEmpty(userRedisData)) {
      logger.info({
        file: "matchBetQueueProcessingFile",
        info: `process job for user id ${userId}`,
        userRedisData,
        jobData,
      });
      await calculateSessionRateAmount(userRedisData, jobData, userId);
    }

    return done(null, {});
  } catch (error) {
    logger.info({
      file: "error in session bet Queue",
      info: `process job for user id ${userId}`,
      userRedisData,
      jobData,
    });
    return done(null, {});
  }
});

const calculateSessionRateAmount = async (userRedisData, jobData, userId) => {
  // Parse partnerships from userRedisData
  let partnershipObj = JSON.parse(userRedisData.partnerShips || "{}");

  // Extract relevant data from jobData
  const placedBetObject = jobData.betPlaceObject;
  // let maxLossExposure = placedBetObject.maxLoss;
  let partnerSessionExposure = placedBetObject.diffSessionExp;
  let stake = placedBetObject?.betPlacedData?.stake;
  let redisObj = jobData?.redisObject;

  // If user role is 'user', send balance update message
  if (userRedisData?.roleName == userRoleConstant.user) {
    sendMessageToUser(userId, socketData.SessionBetPlaced, {
      currentBalance: userRedisData?.currentBalance,
      exposure: (parseFloat(userRedisData?.exposure) + parseFloat(partnerSessionExposure)).toFixed(2),
      myProfitLoss: userRedisData?.myProfitLoss,
      profitLoss: userRedisData?.profitLoss,
      profitLossData: redisObj?.[`${jobData?.placedBet?.betId}_profitLoss`],
      betPlaced: jobData
    });

    //update db
    await updateUserExposure(userId, partnerSessionExposure);
    // updating redis
    await incrementValuesRedis(userId, { [redisKeys.userAllExposure]: partnerSessionExposure }, redisObj);

    logger.info({
      message: "User exposure for session",
      data: {
        matchId: jobData?.matchId,
        userId: userId,
        exposure: userRedisData?.exposure,
        userRedisObj: redisObj
      }
    });
  }

  // Iterate through partnerships based on role and update exposure
  Object.keys(partnershipPrefixByRole)
    ?.filter(
      (item) =>
        item != userRoleConstant.fairGameAdmin &&
        item != userRoleConstant.fairGameWallet && item != userRoleConstant.expert
    )
    ?.map(async (item) => {
      let partnerShipKey = `${partnershipPrefixByRole[item]}`;

      // Check if partnershipId exists in partnershipObj
      if (partnershipObj[`${partnerShipKey}PartnershipId`]) {
        let partnershipId = partnershipObj[`${partnerShipKey}PartnershipId`];
        let partnership = partnershipObj[`${partnerShipKey}Partnership`];

        try {
          // Get user data from Redis or balance data by userId
          let masterRedisData = await getUserRedisData(partnershipId);

          if (lodash.isEmpty(masterRedisData)) {
            // If masterRedisData is empty, update partner exposure
            await updateUserExposure(partnershipId, partnerSessionExposure);
          } else {
            // If masterRedisData exists, update partner exposure and session data
            let masterExposure = parseFloat(masterRedisData.exposure) ?? 0;
            let partnerExposure = (parseFloat(masterExposure) || 0) + partnerSessionExposure;

            // Calculate profit loss session and update Redis data
            const redisBetData = masterRedisData[
              `${placedBetObject?.betPlacedData?.betId}_profitLoss`
            ]
              ? JSON.parse(
                masterRedisData[
                `${placedBetObject?.betPlacedData?.betId}_profitLoss`
                ]
              )
              : null;

            let redisData;

            switch (jobData?.placedBet?.marketType) {
              case sessionBettingType.session:
              case sessionBettingType.overByOver:
              case sessionBettingType.ballByBall:
                redisData = await calculateProfitLossSession(
                  redisBetData,
                  placedBetObject,
                  partnership
                );
                break;
              case sessionBettingType.khado:
                redisData = await calculateProfitLossKhado(
                  redisBetData,
                  placedBetObject,
                  partnership
                );
                break;
              case sessionBettingType.meter:
                redisData = await calculateProfitLossMeter(
                  redisBetData,
                  placedBetObject,
                  partnership
                );
                break;
              case sessionBettingType.oddEven:
                redisData = await calculateProfitLossSessionOddEven(redisBetData,
                  { ...placedBetObject, winAmount: -placedBetObject?.winAmount, lossAmount: -placedBetObject?.lossAmount }, partnership);
                break;
              case sessionBettingType.cricketCasino:
                redisData = await calculateProfitLossSessionCasinoCricket(redisBetData,
                  { ...placedBetObject, winAmount: -placedBetObject?.winAmount, lossAmount: -placedBetObject?.lossAmount }, partnership);
                break;
              case sessionBettingType.fancy1:
                redisData = await calculateProfitLossSessionFancy1(redisBetData,
                  { ...placedBetObject, winAmount: -placedBetObject?.winAmount, lossAmount: -placedBetObject?.lossAmount }, partnership);
                break;
              default:
                break;
            }

            await updateUserExposure(partnershipId, partnerSessionExposure);
            await incrementValuesRedis(partnershipId, { [redisKeys.userAllExposure]: parseFloat(parseFloat(partnerSessionExposure).toFixed(2)), [`${redisKeys.userSessionExposure}${placedBetObject?.betPlacedData?.matchId}`]: parseFloat(redisData?.maxLoss || 0.0) - parseFloat(redisBetData?.maxLoss || 0.0) }, {
              [`${placedBetObject?.betPlacedData?.betId}_profitLoss`]:
                JSON.stringify(redisData)
            });

            // Log information about exposure and stake update
            logger.info({
              context: "Update User Exposure and Stake",
              process: `User ID : ${userId} ${item} id ${partnershipId}`,
              data: `My Stake : ${(
                (stake * parseFloat(partnership)) /
                100
              ).toFixed(2)}, exposure: ${partnerExposure}`,
            });

            // Update jobData with calculated stake
            jobData.betPlaceObject.myStack = (
              (stake * parseFloat(partnership)) /
              100
            ).toFixed(2);

            // Send data to socket for session bet placement
            sendMessageToUser(partnershipId, socketData.SessionBetPlaced, {
              userRedisData,
              jobData,
              profitLoss: redisData
            });
          }
        } catch (error) {
          // Log error if any during exposure update
          logger.error({
            context: `error in ${item} exposure update`,
            process: `User ID : ${userId} and ${item} id ${partnershipId}`,
            error: error.message,
            stake: error.stack,
          });
        }
      }
    });
};

// calculate tournament bet place
MatchTournamentBetQueue.process(jobQueueConcurrent, async function (job, done) {

  let jobData = job.data;
  let userId = jobData.userId;
  let userRedisData = await getUserRedisData(userId);
  try {

    if (!lodash.isEmpty(userRedisData)) {
      logger.info({
        file: 'matchTournamentBetQueueProcessingFile',
        info: `process job for user id ${userId}`,
        userRedisData,
        jobData
      })
      await calculateTournamentRateAmount(userRedisData, jobData, userId);
    }
    return done(null, {});
  } catch (error) {
    logger.info({
      file: 'error in bet Queue',
      info: `process job for user id ${userId}`,
      userRedisData,
      jobData
    })
    return done(null, {});
  }
});

let calculateTournamentRateAmount = async (userRedisData, jobData, userId) => {
  let roleName = userRedisData.roleName;
  let userOldExposure = jobData.userPreviousExposure
  let userCurrentExposure = jobData.newUserExposure;
  let partnershipObj = JSON.parse(userRedisData.partnerShips || "{}");

  let teamData = { ...jobData?.newTeamRateData };

  let obj = {
    runners: jobData.runners,
    winAmount: jobData.winAmount,
    lossAmount: jobData.lossAmount,
    bettingType: jobData.bettingType,
    runnerId: jobData.runnerId
  }
  if (roleName == userRoleConstant.user) {
    let userRedisObj = {
      [`${jobData?.betId}${redisKeys.profitLoss}_${jobData?.matchId}`]: JSON.stringify(teamData)
    }

    // updating redis
    await incrementValuesRedis(userId, { [redisKeys.userAllExposure]: userCurrentExposure - userOldExposure, [redisKeys.userMatchExposure + jobData?.matchId]: userCurrentExposure - userOldExposure }, userRedisObj);

    // updating db
    await updateUserExposure(userId, (userCurrentExposure - userOldExposure));

    logger.info({
      message: "User exposure for match",
      data: {
        matchId: jobData?.matchId,
        userId: userId,
        exposure: userCurrentExposure,
        userRedisObj: userRedisObj
      }
    });
    //send socket to user
    sendMessageToUser(userId, socketData.MatchBetPlaced, { userRedisData, jobData, teamData })
  }

  Object.keys(partnershipPrefixByRole)
    ?.filter(
      (item) =>
        item != userRoleConstant.fairGameAdmin &&
        item != userRoleConstant.fairGameWallet && item != userRoleConstant.expert
    )
    ?.map(async (item) => {
      let partnerShipKey = `${partnershipPrefixByRole[item]}`;
      // Check if partnershipId exists in partnershipObj
      if (partnershipObj[`${partnerShipKey}PartnershipId`]) {
        let partnershipId = partnershipObj[`${partnerShipKey}PartnershipId`];
        let partnership = partnershipObj[`${partnerShipKey}Partnership`];
        try {
          // Get user data from Redis or balance data by userId
          let masterRedisData = await getUserRedisData(partnershipId);
          await updateUserExposure(partnershipId, (- userOldExposure + userCurrentExposure));

          if (!lodash.isEmpty(masterRedisData)) {
            let masterExposure = masterRedisData?.exposure ? masterRedisData.exposure : 0;
            let partnerExposure = (parseFloat(masterExposure) || 0) - userOldExposure + userCurrentExposure;

            let teamRates = masterRedisData?.[`${jobData?.betId}${redisKeys.profitLoss}_${jobData?.matchId}`];

            if (teamRates) {
              teamRates = JSON.parse(teamRates);
            }

            if (!teamRates) {
              teamRates = jobData?.runners?.reduce((acc, key) => {
                acc[key?.id] = 0;
                return acc;
              }, {});
            }

            teamRates = Object.keys(teamRates).reduce((acc, key) => {
              acc[key] = parseRedisData(key, teamRates);
              return acc;
            }, {});

            let teamData = await calculateRacingExpertRate(teamRates, obj, partnership);
            let userRedisObj = {
              [`${jobData?.betId}${redisKeys.profitLoss}_${jobData?.matchId}`]: JSON.stringify(teamData)
            }

            // updating redis
            await incrementValuesRedis(partnershipId, { [redisKeys.userAllExposure]: userCurrentExposure - userOldExposure }, userRedisObj);

            jobData.myStake = Number(((jobData.stake / 100) * partnership).toFixed(2));
            sendMessageToUser(partnershipId, socketData.MatchBetPlaced, { jobData, userRedisObj: teamData })
            // Log information about exposure and stake update
            logger.info({
              context: "Update User Exposure and Stake at the match bet",
              process: `User ID : ${userId} ${item} id ${partnershipId}`,
              data: `My Stake : ${jobData.myStake} exposure: ${partnerExposure}`,
            });

          }
        } catch (error) {
          logger.error({
            context: "error in master exposure update",
            process: `User ID : ${userId} and master id ${partnershipId}`,
            error: error.message,
            stake: error.stack
          })
        }
      }
    });
}

CardMatchBetQueue.process(jobQueueConcurrent, async function (job, done) {

  let jobData = job.data;
  let userId = jobData.userId;
  let userRedisData = await getUserRedisData(userId);
  try {

    if (!lodash.isEmpty(userRedisData)) {
      logger.info({
        file: 'cardMatchQueueProcessingFile',
        info: `process job for user id ${userId}`,
        userRedisData,
        jobData
      })
      await calculateCardMatchRateAmount(userRedisData, jobData, userId);
    }
    return done(null, {});
  } catch (error) {
    logger.info({
      file: 'error in bet Queue',
      info: `process job for user id ${userId}`,
      userRedisData,
      jobData
    })
    return done(null, {});
  }
});

let calculateCardMatchRateAmount = async (userRedisData, jobData, userId) => {
  let roleName = userRedisData.roleName;
  let userOldExposure = jobData.userPreviousExposure
  let userCurrentExposure = jobData.newUserExposure;
  let partnershipObj = JSON.parse(userRedisData.partnerShips || "{}");

  let teamData = jobData?.newTeamRateData;

  if (roleName == userRoleConstant.user) {
    let userRedisObj = {
      [`${jobData?.mid}_${jobData?.selectionId}${redisKeys.card}`]: teamData
    }

    // updating redis
    await incrementValuesRedis(userId, { [redisKeys.userAllExposure]: userCurrentExposure - userOldExposure, [redisKeys.userMatchExposure + jobData?.mid]: userCurrentExposure - userOldExposure }, userRedisObj);

    // updating db
    await updateUserExposure(userId, (userCurrentExposure - userOldExposure));

    logger.info({
      message: "User exposure for match",
      data: {
        matchId: jobData?.matchId,
        userId: userId,
        exposure: userCurrentExposure,
        userRedisObj: userRedisObj
      }
    });
    //send socket to user
    sendMessageToUser(userId, socketData.CardBetPlaced, { userRedisData, jobData, userRedisObj: userRedisObj })
  }

  Object.keys(partnershipPrefixByRole)
    ?.filter(
      (item) =>
        item != userRoleConstant.fairGameAdmin &&
        item != userRoleConstant.fairGameWallet && item != userRoleConstant.expert
    )
    ?.map(async (item) => {
      let partnerShipKey = `${partnershipPrefixByRole[item]}`;
      // Check if partnershipId exists in partnershipObj
      if (partnershipObj[`${partnerShipKey}PartnershipId`]) {
        let partnershipId = partnershipObj[`${partnerShipKey}PartnershipId`];
        let partnership = partnershipObj[`${partnerShipKey}Partnership`];
        try {
          // Get user data from Redis or balance data by userId
          let masterRedisData = await getUserRedisData(partnershipId);
          await updateUserExposure(partnershipId, (- userOldExposure + userCurrentExposure));

          if (!lodash.isEmpty(masterRedisData)) {
            let masterExposure = masterRedisData?.exposure ? masterRedisData.exposure : 0;
            let partnerExposure = (parseFloat(masterExposure) || 0) - userOldExposure + userCurrentExposure;

            let teamRates = masterRedisData?.[`${jobData?.mid}_${jobData?.selectionId}${redisKeys.card}`];

            let cardProfitLossAndExposure = new CardProfitLoss(jobData?.matchType, teamRates, { bettingType: jobData?.bettingType, winAmount: jobData?.winAmount, lossAmount: jobData?.lossAmount, playerName: jobData?.betOnTeam, partnership: partnership, sid: jobData?.selectionId }, userOldExposure).getCardGameProfitLoss()

            let teamData = cardProfitLossAndExposure.profitLoss;
            let userRedisObj = {
              [`${jobData?.mid}_${jobData?.selectionId}${redisKeys.card}`]: teamData
            }

            // updating redis
            await incrementValuesRedis(partnershipId, { [redisKeys.userAllExposure]: userCurrentExposure - userOldExposure }, userRedisObj);

            jobData.myStake = Number(((jobData.stake / 100) * partnership).toFixed(2));
            sendMessageToUser(partnershipId, socketData.CardBetPlaced, { jobData, userRedisObj: userRedisObj })
            // Log information about exposure and stake update
            logger.info({
              context: "Update User Exposure and Stake at the card bet",
              process: `User ID : ${userId} ${item} id ${partnershipId}`,
              data: `My Stake : ${jobData.myStake} exposure: ${partnerExposure}`,
            });

          }
        } catch (error) {
          logger.error({
            context: "error in master exposure update",
            process: `User ID : ${userId} and master id ${partnershipId}`,
            error: error.message,
            stake: error.stack
          })
        }
      }
    });
}

module.exports = {
  SessionMatchBetQueue: SessionMatchBetQueue,
  WalletSessionBetQueue: WalletSessionBetQueue,
  ExpertSessionBetQueue: ExpertSessionBetQueue,
  CardMatchBetQueue: CardMatchBetQueue,
  WalletCardMatchBetQueue: WalletCardMatchBetQueue,
  walletSessionBetDeleteQueue, expertSessionBetDeleteQueue,
  ExpertMatchTournamentBetQueue, WalletMatchTournamentBetQueue, MatchTournamentBetQueue, walletTournamentMatchBetDeleteQueue, expertTournamentMatchBetDeleteQueue
};