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

const walletRedisOption = {
  removeOnSuccess: true,
  redis: {
    port: process.env.WALLET_REDIS_PORT,
    host: process.env.WALLET_REDIS_HOST
  }
}

const WalletMatchBetQueue = new Queue('walletMatchBetQueue', walletRedisOption);
const WalletSessionBetQueue = new Queue('walletSessionBetQueue', walletRedisOption);


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
  let stake = placedBetObject.stake;

  // If user role is 'user', send balance update message
  if (userRedisData?.roleName == userRoleConstant.user) {
    sendMessageToUser(userId, socketData.userBalanceUpdateEvent, {
      currentBalance: userRedisData?.currentBalance,
      exposure: userRedisData?.exposure,
      myProfitLoss: userRedisData?.myProfitLoss,
      totalComission: userRedisData?.totalComission,
      profitLoss: userRedisData?.profitLoss,
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
            let partnerExposure = partnerUser.exposure - maxLossExposure;
            await updateUserBalanceByUserId(partnershipId, {
              exposure: partnerExposure,
            });
          } else {
            // If masterRedisData exists, update partner exposure and session data
            let masterExposure = parseFloat(masterRedisData.exposure) ?? 0;
            let partnerExposure = masterExposure + maxLossExposure;
            await updateUserBalanceByUserId(partnershipId, {
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

            await updateUserDataRedis(partnershipId, {
              [`${placedBetObject?.betPlacedData?.betId}_profitLoss`]:
                JSON.stringify(redisData),
              exposure: partnerExposure,
              [`${redisKeys.userSessionExposure}${placedBetObject?.betPlacedData?.matchId}`]:
                parseFloat(
                  masterRedisData?.[
                    `${redisKeys.userSessionExposure}${placedBetObject?.betPlacedData?.matchId}`
                  ] || 0
                ) + partnerSessionExposure,
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
      info : `process job for user id ${userId}`,
      userRedisData,
      jobData
    })
    await calculateRateAmount(userRedisData,jobData,userId);
  }
  return done(null, {});
  } catch (error) {
    logger.info({
      file: 'error in bet Queue',
      info : `process job for user id ${userId}`,
      userRedisData,
      jobData
    })
    return done(null, {});
  }
});

let calculateRateAmount = async (userRedisData, jobData,userId) => {
  let roleName = userRedisData.userRole;
  let userOldExposure = jobData.userPreviousExposure
  let userCurrentExposure = jobData.newUserExposure;
  let partnership = JSON.parse(userRedisData.partnerShips);
  let teamRates = {
    teamA: parseFloat(userRedisData[jobData.teamArateRedisKey]) || 0.0,
    teamB: parseFloat(userRedisData[jobData.teamBrateRedisKey]) || 0.0,
    teamC: parseFloat(userRedisData[jobData.teamCrateRedisKey]) || 0.0
  }

  let teamData = {
    teamA : jobData.newTeamRateData.teamA,
    teamB : jobData.newTeamRateData.teamB,
    teamC : jobData.newTeamRateData.teamC
  }
  let obj = {
    teamA : jobData.teamA,
    teamB : jobData.teamB,
    teamC : jobData.teamC,
    winAmount : jobData.winAmount,
    lossAmount : jobData.lossAmount,
    bettingType : jobData.bettingType,
    betOnTeam : jobData.betOnTeam
  }
  if(roleName == userRoleConstant.user){
    let userRedisObj = {
      [redisKeys.userAllExposure] : userCurrentExposure,
      [jobData.teamArateRedisKey] : teamData.teamA,
      [jobData.teamBrateRedisKey] : teamData.teamB,
      [jobData.teamCrateRedisKey] : teamData.teamC
    }
    let setRedis = await updateUserDataRedis(userId,userRedisObj);
    //send socket to user
    sendMessageToUser(userId,socketData.MatchBetPlaced,{userRedisData,jobData})
  }
  if(partnership['mPartnershipId']){
    let mPartenerShipId = partnership['mPartnershipId'];
    let mPartenerShip = partnership['mPartnership'];
    try{
    let masterRedisData = await getUserRedisData(mPartenerShipId);
    if(lodash.isEmpty(masterRedisData)){
      let partnerUser = await getUserBalanceDataByUserId(mPartenerShipId);
      let partnerExpsoure = partnerUser.exposure - userOldExposure + userCurrentExposure;
      await updateUserBalanceByUserId(mPartenerShipId,{exposure:partnerExpsoure})
    }else {
      let masterExposure = masterRedisData.exposure ? masterRedisData.exposure : 0;
      let partnerExpsoure = masterExposure - userOldExposure + userCurrentExposure;
      await updateUserBalanceByUserId(mPartenerShipId,{exposure:partnerExpsoure});
    
      let teamData =await calculateExpertRate(teamRates,obj,mPartenerShip);
      let userRedisObj = {
        [redisKeys.userAllExposure] : partnerExpsoure,
        [jobData.teamArateRedisKey] : teamData.teamA,
        [jobData.teamBrateRedisKey] : teamData.teamB,
        [jobData.teamCrateRedisKey] : teamData.teamC
      }
      await updateUserDataRedis(mPartenerShipId,userRedisObj);
      let myStake = Number(((jobData.stake/100) * mPartenerShip).toFixed(2));
      logger.info({
        context: "Update User Exposure and Stake",
        process: `User ID : ${userId} master id ${mPartenerShipId}`,
        data: `My Stake : ${myStake}`
      })
      //send Data to socket      
    sendMessageToUser(mPartenerShipId,socketData.MatchBetPlaced,{userRedisData,jobData})
    }
  }catch(error){
    logger.error({
      context: "error in master exposure update",
      process: `User ID : ${userId} and master id ${mPartenerShipId}`,
      error: error.message,
      stake : error.stack
    })
  }
  } 
  if(partnership['smPartnershipId']){
    let mPartenerShipId = partnership['smPartnershipId'];
    let mPartenerShip = partnership['smPartnership'];
    try{
    let masterRedisData = await getUserRedisData(mPartenerShipId);
    if(lodash.isEmpty(masterRedisData)){
      let partnerUser = await getUserBalanceDataByUserId(mPartenerShipId);
      let partnerExpsoure = partnerUser.exposure - userOldExposure + userCurrentExposure;
      await updateUserBalanceByUserId(mPartenerShipId,{exposure:partnerExpsoure})
    }else {
      let masterExposure = masterRedisData.exposure ? masterRedisData.exposure : 0;
      let partnerExpsoure = masterExposure - userOldExposure + userCurrentExposure;
      await updateUserBalanceByUserId(mPartenerShipId,{exposure:partnerExpsoure});
    
      let teamData =await calculateExpertRate(teamRates,obj,mPartenerShip);
      let userRedisObj = {
        [redisKeys.userAllExposure] : partnerExpsoure,
        [jobData.teamArateRedisKey] : teamData.teamA,
        [jobData.teamBrateRedisKey] : teamData.teamB,
        [jobData.teamCrateRedisKey] : teamData.teamC
      }
      await updateUserDataRedis(mPartenerShipId,userRedisObj);
      let myStake = Number(((jobData.stake/100) * mPartenerShip).toFixed(2));
      logger.info({
        context: "Update User Exposure and Stake",
        process: `User ID : ${userId} super master id ${mPartenerShipId}`,
        data: `My Stake : ${myStake}`
      })
      sendMessageToUser(mPartenerShipId,socketData.MatchBetPlaced,{userRedisData,jobData})
      //send Data to socket
    }
  }catch(error){
    logger.error({
      context: "error in super master exposure update",
      process: `User ID : ${userId} and super master id ${mPartenerShipId}`,
      error: error.message,
      stake : error.stack
    })
  }
  }
  if(partnership['aPartnershipId']){
    let mPartenerShipId = partnership['aPartnershipId'];
    let mPartenerShip = partnership['aPartnership'];
    try{
    let masterRedisData = await getUserRedisData(mPartenerShipId);
    if(lodash.isEmpty(masterRedisData)){
      let partnerUser = await getUserBalanceDataByUserId(mPartenerShipId);
      let partnerExpsoure = partnerUser.exposure - userOldExposure + userCurrentExposure;
      await updateUserBalanceByUserId(mPartenerShipId,{exposure:partnerExpsoure})
    }else {
      let masterExposure = masterRedisData.exposure ? masterRedisData.exposure : 0;
      let partnerExpsoure = masterExposure - userOldExposure + userCurrentExposure;
      await updateUserBalanceByUserId(mPartenerShipId,{exposure:partnerExpsoure});
    
      let teamData =await calculateExpertRate(teamRates,obj,mPartenerShip);
      let userRedisObj = {
        [redisKeys.userAllExposure] : partnerExpsoure,
        [jobData.teamArateRedisKey] : teamData.teamA,
        [jobData.teamBrateRedisKey] : teamData.teamB,
        [jobData.teamCrateRedisKey] : teamData.teamC
      }
      await updateUserDataRedis(mPartenerShipId,userRedisObj);
      let myStake = Number(((jobData.stake/100) * mPartenerShip).toFixed(2));
      logger.info({
        context: "Update User Exposure and Stake",
        process: `User ID : ${userId} admin id ${mPartenerShipId}`,
        data: `My Stake : ${myStake}`
      })
      //send Data to socket
    sendMessageToUser(mPartenerShipId,socketData.MatchBetPlaced,{userRedisData,jobData})
    }
  }catch(error){
    logger.error({
      context: "error in admin exposure update",
      process: `User ID : ${userId} and admin id ${mPartenerShipId}`,
      error: error.message,
      stake : error.stack
    })
  }
  }
  if(partnership['saPartnershipId']){
    let mPartenerShipId = partnership['saPartnershipId'];
    let mPartenerShip = partnership['saPartnership'];
    try{
    let masterRedisData = await getUserRedisData(mPartenerShipId);
    if(lodash.isEmpty(masterRedisData)){
      let partnerUser = await getUserBalanceDataByUserId(mPartenerShipId);
      let partnerExpsoure = partnerUser.exposure - userOldExposure + userCurrentExposure;
      await updateUserBalanceByUserId(mPartenerShipId,{exposure:partnerExpsoure})
    }else {
      let masterExposure = masterRedisData.exposure ? masterRedisData.exposure : 0;
      let partnerExpsoure = masterExposure - userOldExposure + userCurrentExposure;
      await updateUserBalanceByUserId(mPartenerShipId,{exposure:partnerExpsoure});
    
      let teamData =await calculateExpertRate(teamRates,obj,mPartenerShip);
      let userRedisObj = {
        [redisKeys.userAllExposure] : partnerExpsoure,
        [jobData.teamArateRedisKey] : teamData.teamA,
        [jobData.teamBrateRedisKey] : teamData.teamB,
        [jobData.teamCrateRedisKey] : teamData.teamC
      }
      await updateUserDataRedis(mPartenerShipId,userRedisObj);
      let myStake = Number(((jobData.stake/100) * mPartenerShip).toFixed(2));
      logger.info({
        context: "Update User Exposure and Stake",
        process: `User ID : ${userId} super admin id ${mPartenerShipId}`,
        data: `My Stake : ${myStake}`
      })
      //send Data to socket
    sendMessageToUser(mPartenerShipId,socketData.MatchBetPlaced,{userRedisData,jobData})
    }
  }catch(error){
    logger.error({
      context: "error in super admin exposure update",
      process: `User ID : ${userId} and superAdmin id ${mPartenerShipId}`,
      error: error.message,
      stake : error.stack
    })
  }
  }
}

module.exports = {
  MatchBetQueue: MatchBetQueue,
  WalletMatchBetQueue: WalletMatchBetQueue,
  SessionMatchBetQueue: SessionMatchBetQueue,
  WalletSessionBetQueue: WalletSessionBetQueue,
};