const Queue = require('bee-queue');
const lodash = require('lodash');
const { getUserRedisData, updateUserDataRedis } = require('../services/redis/commonfunction');
const { redisKeys, userRoleConstant, socketData, partnershipPrefixByRole } = require('../config/contants');
const { logger } = require('../config/logger');
const { getUserBalanceDataByUserId, updateUserBalanceByUserId } = require('../services/userBalanceService');
const { calculateExpertRate, calculateProfitLossSession } = require('../services/commonService');
const { sendMessageToUser } = require('../sockets/socketManager');

const options = {
  removeOnSuccess: true,
  redis: {
    host: process.env.INTERNAL_REDIS_HOST,
    port: process.env.INTERNAL_REDIS_PORT,
    password: process.env.INTERNAL_REDIS_PASSWORD
  }
}

const MatchBetQueue = new Queue('matchBetQueue', options);
const SessionMatchBetQueue = new Queue('sessionMatchBetQueue', options);

const externalRedisOption = {
  removeOnSuccess: true,
  redis: {
    port: process.env.EXTERNAL_REDIS_PORT,
    host: process.env.EXTERNAL_REDIS_HOST
  }
}

const WalletMatchBetQueue = new Queue('walletMatchBetQueue', externalRedisOption);
const WalletSessionBetQueue = new Queue('walletSessionBetQueue', externalRedisOption);
const walletSessionBetDeleteQueue = new Queue('walletSessionBetDeleteQueue', externalRedisOption);
const walletMatchBetDeleteQueue = new Queue('walletMatchBetDeleteQueue', externalRedisOption);


const ExpertMatchBetQueue = new Queue('expertMatchBetQueue', externalRedisOption);
const ExpertSessionBetQueue = new Queue('expertSessionBetQueue', externalRedisOption);
const expertSessionBetDeleteQueue = new Queue('expertSessionBetDeleteQueue', externalRedisOption);
const expertMatchBetDeleteQueue = new Queue('expertMatchBetDeleteQueue', externalRedisOption);

SessionMatchBetQueue.process(async function (job, done) {
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
  let partnershipObj = JSON.parse(userRedisData.partnerShips);

  // Extract relevant data from jobData
  const placedBetObject = jobData.betPlaceObject;
  let maxLossExposure = placedBetObject.maxLoss;
  let partnerSessionExposure = placedBetObject.diffSessionExp;
  let stake = placedBetObject?.betPlacedData?.stake;

  // If user role is 'user', send balance update message
  if (userRedisData?.roleName == userRoleConstant.user) {
    sendMessageToUser(userId, socketData.SessionBetPlaced, {
      currentBalance: userRedisData?.currentBalance,
      exposure: userRedisData?.exposure,
      myProfitLoss: userRedisData?.myProfitLoss,
      profitLoss: userRedisData?.profitLoss,
      profitLossData: userRedisData?.[`${jobData?.placedBet?.betId}_profitLoss`],
      betPlaced: jobData
    });
  }

  // Iterate through partnerships based on role and update exposure
  Object.keys(partnershipPrefixByRole)
    ?.filter(
      (item) =>
        item != userRoleConstant.fairGameAdmin &&
        item != userRoleConstant.fairGameWallet
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
            let partnerUser = await getUserBalanceDataByUserId(partnershipId);
            let partnerExposure = (parseFloat(partnerUser.exposure) || 0) + partnerSessionExposure;
            await updateUserBalanceByUserId(partnershipId, {
              exposure: partnerExposure,
            });
          } else {
            // If masterRedisData exists, update partner exposure and session data
            let masterExposure = parseFloat(masterRedisData.exposure) ?? 0;
            let partnerExposure = (parseFloat(masterExposure) || 0) + partnerSessionExposure;
            updateUserBalanceByUserId(partnershipId, {
              exposure: partnerExposure,
            });

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

            let redisData = await calculateProfitLossSession(
              redisBetData,
              placedBetObject,
              partnership
            );

            updateUserDataRedis(partnershipId, {
              [`${placedBetObject?.betPlacedData?.betId}_profitLoss`]:
                JSON.stringify(redisData),
              exposure: partnerExposure,
              [`${redisKeys.userSessionExposure}${placedBetObject?.betPlacedData?.matchId}`]:
                parseFloat(
                  masterRedisData?.[
                  `${redisKeys.userSessionExposure}${placedBetObject?.betPlacedData?.matchId}`
                  ] || 0
                ) + parseFloat(redisData?.maxLoss || 0.0) - parseFloat(redisBetData?.maxLoss || 0.0),
            });

            // Log information about exposure and stake update
            logger.info({
              context: "Update User Exposure and Stake",
              process: `User ID : ${userId} ${item} id ${partnershipId}`,
              data: `My Stake : ${(
                (stake * parseFloat(partnership)) /
                100
              ).toFixed(2)}`,
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


MatchBetQueue.process(async function (job, done) {

  let jobData = job.data;
  let userId = jobData.userId;
  let userRedisData = await getUserRedisData(userId);
  try {

    if (!lodash.isEmpty(userRedisData)) {
      logger.info({
        file: 'matchBetQueueProcessingFile',
        info: `process job for user id ${userId}`,
        userRedisData,
        jobData
      })
      await calculateRateAmount(userRedisData, jobData, userId);
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

let calculateRateAmount = async (userRedisData, jobData, userId) => {
  let roleName = userRedisData.userRole;
  let userOldExposure = jobData.userPreviousExposure
  let userCurrentExposure = jobData.newUserExposure;
  let partnershipObj = JSON.parse(userRedisData.partnerShips);

  let teamRates = {
    teamA: parseFloat(userRedisData[jobData.teamArateRedisKey]) || 0.0,
    teamB: parseFloat(userRedisData[jobData.teamBrateRedisKey]) || 0.0,
    teamC: jobData.teamCrateRedisKey ? parseFloat(userRedisData[jobData.teamCrateRedisKey]) || 0.0 : 0.0
  }

  let teamData = {
    teamA: jobData.newTeamRateData.teamA,
    teamB: jobData.newTeamRateData.teamB,
    ...(jobData.teamCrateRedisKey ? { teamC: jobData.newTeamRateData.teamC } : {})
  }
  let obj = {
    teamA: jobData.teamA,
    teamB: jobData.teamB,
    teamC: jobData.teamC,
    winAmount: jobData.winAmount,
    lossAmount: jobData.lossAmount,
    bettingType: jobData.bettingType,
    betOnTeam: jobData.betOnTeam
  }
  if (roleName == userRoleConstant.user) {
    let userRedisObj = {
      [redisKeys.userAllExposure]: userCurrentExposure,
      [jobData.teamArateRedisKey]: teamData.teamA,
      [jobData.teamBrateRedisKey]: teamData.teamB,
      ...(jobData.teamCrateRedisKey ? { [jobData.teamCrateRedisKey]: teamData.teamC } : {})
    }
    await updateUserDataRedis(userId, userRedisObj);
    updateUserBalanceByUserId(userId, {
      exposure: userCurrentExposure
    });
    //send socket to user
    sendMessageToUser(userId, socketData.MatchBetPlaced, { userRedisData, jobData, ...teamData })
  }

  Object.keys(partnershipPrefixByRole)
    ?.filter(
      (item) =>
        item != userRoleConstant.fairGameAdmin &&
        item != userRoleConstant.fairGameWallet
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
            let partnerUser = await getUserBalanceDataByUserId(partnershipId);
            let partnerExposure = (parseFloat(partnerUser?.exposure) || 0) - userOldExposure + userCurrentExposure;
            await updateUserBalanceByUserId(partnershipId, { exposure: partnerExposure });
          } else {
            let masterExposure = masterRedisData?.exposure ? masterRedisData.exposure : 0;
            let partnerExposure = (parseFloat(masterExposure) || 0) - userOldExposure + userCurrentExposure;
            await updateUserBalanceByUserId(partnershipId, { exposure: partnerExposure });

            let teamRates = {
              teamA: parseFloat((parseFloat(masterRedisData[jobData.teamArateRedisKey]) || 0.0).toFixed(2)),
              teamB: parseFloat((parseFloat(masterRedisData[jobData.teamBrateRedisKey]) || 0.0).toFixed(2)),
              teamC: jobData.teamCrateRedisKey ? parseFloat((parseFloat(masterRedisData[jobData.teamCrateRedisKey]) || 0.0).toFixed(2)) : 0.0
            }
            let teamData = await calculateExpertRate(teamRates, obj, partnership);
            let userRedisObj = {
              [redisKeys.userAllExposure]: partnerExposure,
              [jobData.teamArateRedisKey]: parseFloat((teamData.teamA).toFixed(2)),
              [jobData.teamBrateRedisKey]: parseFloat(parseFloat(teamData.teamB).toFixed(2)),
              ...(jobData.teamCrateRedisKey ? { [jobData.teamCrateRedisKey]: parseFloat(parseFloat(teamData.teamC).toFixed(2)) } : {})
            }
            await updateUserDataRedis(partnershipId, userRedisObj);
            jobData.myStake = Number(((jobData.stake / 100) * partnership).toFixed(2));
            sendMessageToUser(partnershipId, socketData.MatchBetPlaced, { userRedisData, jobData, userRedisObj })
            // Log information about exposure and stake update
            logger.info({
              context: "Update User Exposure and Stake at the match bet",
              process: `User ID : ${userId} ${item} id ${partnershipId}`,
              data: `My Stake : ${jobData.myStake}`,
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
  MatchBetQueue: MatchBetQueue,
  WalletMatchBetQueue: WalletMatchBetQueue,
  SessionMatchBetQueue: SessionMatchBetQueue,
  WalletSessionBetQueue: WalletSessionBetQueue,
  ExpertMatchBetQueue: ExpertMatchBetQueue,
  ExpertSessionBetQueue: ExpertSessionBetQueue,
  walletSessionBetDeleteQueue, expertSessionBetDeleteQueue, walletMatchBetDeleteQueue, expertMatchBetDeleteQueue
};