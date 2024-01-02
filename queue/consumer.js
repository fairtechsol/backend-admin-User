const Queue = require('bee-queue');
const lodash = require('lodash');
const { getUserRedisData, updateUserDataRedis } = require('../services/redis/commonfunction');
const { redisKeys, userRoleConstant } = require('../config/contants');
const { logger } = require('../config/logger');
const { getUserById } = require('../services/userService');
const { getUserBalanceDataByUserId, updateUserBalanceByUserId } = require('../services/userBalanceService');
const { calculateExpertRate } = require('../services/commonService');

const options = {
  removeOnSuccess: true,
  redis: {
    port: process.env.REDIS_PORT,
    host: process.env.REDIS_HOST,
    password: process.env.REDIS_PASSWORD
  }
}

const MatchBetQueue = new Queue('matchBetQueue', options);

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
  let userOldExposure = 0.0;
  let roleName = userRedisData.userRole
  if (userRedisData[redisKeys.userAllExposure]) {
    userOldExposure = parseFloat(userRedisData[redisKeys.userAllExposure]);
  }
  let userCurrentExposure = 0;
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
    userCurrentExposure = calculateUserExposure(userOldExposure,teamRates,teamData,jobData.teamC);
    let userRedisObj = {
      [redisKeys.userAllExposure] : userCurrentExposure,
      [jobData.teamArateRedisKey] : teamData.teamA,
      [jobData.teamBrateRedisKey] : teamData.teamB,
      [jobData.teamCrateRedisKey] : teamData.teamC
    }
    let setRedis = await updateUserDataRedis(userId,userRedisObj);
    console.log(userRedisData,userRedisObj,jobData);
    //send socket to user
  }
  if(partnership['mPartnershipId']){
    let mPartenerShipId = partnership['mPartnershipId'];
    let mPartenerShip = partnership['mPartnership'];
    let masterRedisData = await getUserRedisData(mPartenerShipId);
    if(lodash.isEmpty(masterRedisData)){
      let partnerUser = await getUserBalanceDataByUserId(mPartenerShipId);
      let partnerExpsoure = partnerUser.exposure - userOldExposure + userCurrentExposure;
      await updateUserBalanceByUserId(mPartenerShipId,{exposure:partnerExpsoure})
    }else {
      let partnerExpsoure = partnerUser.exposure - userOldExposure + userCurrentExposure;
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
      //send Data to socket
    }
  } 
  if(partnership['smPartnershipId']){
    let mPartenerShipId = partnership['smPartnershipId'];
    let mPartenerShip = partnership['smPartnership'];
    let masterRedisData = await getUserRedisData(mPartenerShipId);
    if(lodash.isEmpty(masterRedisData)){
      let partnerUser = await getUserBalanceDataByUserId(mPartenerShipId);
      let partnerExpsoure = partnerUser.exposure - userOldExposure + userCurrentExposure;
      await updateUserBalanceByUserId(mPartenerShipId,{exposure:partnerExpsoure})
    }else {
      let partnerExpsoure = partnerUser.exposure - userOldExposure + userCurrentExposure;
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
      //send Data to socket
    }
  }
  if(partnership['aPartnershipId']){
    let mPartenerShipId = partnership['aPartnershipId'];
    let mPartenerShip = partnership['aPartnership'];
    let masterRedisData = await getUserRedisData(mPartenerShipId);
    if(lodash.isEmpty(masterRedisData)){
      let partnerUser = await getUserBalanceDataByUserId(mPartenerShipId);
      let partnerExpsoure = partnerUser.exposure - userOldExposure + userCurrentExposure;
      await updateUserBalanceByUserId(mPartenerShipId,{exposure:partnerExpsoure})
    }else {
      let partnerExpsoure = partnerUser.exposure - userOldExposure + userCurrentExposure;
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
      //send Data to socket
    }
  }
  if(partnership['saPartnershipId']){
    try{
    let mPartenerShipId = partnership['saPartnershipId'];
    let mPartenerShip = partnership['saPartnership'];
    let masterRedisData = await getUserRedisData(mPartenerShipId);
    if(lodash.isEmpty(masterRedisData)){
      let partnerUser = await getUserBalanceDataByUserId(mPartenerShipId);
      let partnerExpsoure = partnerUser.exposure - userOldExposure + userCurrentExposure;
      await updateUserBalanceByUserId(mPartenerShipId,{exposure:partnerExpsoure})
    }else {
      let partnerExpsoure = masterRedisData.exposure - userOldExposure + userCurrentExposure;
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
        process: `Master User ID : ${userId}`,
        action: 'Adding My Stake To Master',
        data: `My Stake : ${myStake}`
      })
      //send Data to socket
    }
  }catch(error){
    console.log('Error in send data to socket', error);
  }
  }
  if(partnership['faPartnershipId']){
 //send data to wallet server

  }
  if(partnership['fwPartnershipId']){
    //send data to wallet server
  }
}

let calculateUserExposure = (userOldExposure,oldTeamRate,newTeamRate,teamC) => {

  let minAmountNewRate = 0;
  let minAmountOldRate = 0;  
  if(teamC && teamC != ''){
    minAmountNewRate = Math.min(newTeamRate.teamA,newTeamRate.teamB,newTeamRate.teamC);
    minAmountOldRate = Math.min(oldTeamRate.teamA,oldTeamRate.teamB,oldTeamRate.teamC);
  }
  else{
    minAmountNewRate = Math.min(newTeamRate.teamA,newTeamRate.teamB);
    minAmountOldRate = Math.min(oldTeamRate.teamA,oldTeamRate.teamB);
  }
  if(minAmountNewRate > 0)
    minAmountNewRate = 0;
  if(minAmountOldRate > 0)
    minAmountOldRate = 0;
  let newExposure = userOldExposure - Math.abs(minAmountOldRate) + Math.abs(minAmountNewRate);
  return Number(newExposure.toFixed(2));
}
// const job = MatchBetQueue.createJob({x: 2, y: 3});
// job.save();
// job.on('succeeded', (result) => {
//   console.log(`Received result for job ${job.id}: ${result}`);
// });

module.exports.MatchBetQueue = MatchBetQueue