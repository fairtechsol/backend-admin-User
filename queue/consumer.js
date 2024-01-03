const Queue = require('bee-queue');
const lodash = require('lodash');
const { getUserRedisData, updateUserDataRedis } = require('../services/redis/commonfunction');
const { redisKeys, userRoleConstant, socketData } = require('../config/contants');
const { logger } = require('../config/logger');
const { getUserBalanceDataByUserId, updateUserBalanceByUserId } = require('../services/userBalanceService');
const { calculateExpertRate } = require('../services/commonService');
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

const walletRedisOption = {
  removeOnSuccess: true,
  redis: {
    port: process.env.WALLET_REDIS_PORT,
    host: process.env.WALLET_REDIS_HOST
  }
}

const WalletMatchBetQueue = new Queue('walletMatchBetQueue', walletRedisOption);

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

module.exports={
  MatchBetQueue : MatchBetQueue,
  WalletMatchBetQueue : WalletMatchBetQueue
};