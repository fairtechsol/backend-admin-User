const { redisKeys } = require("../../config/contants");
const internalRedis = require("../../config/internalRedisConnection");

exports.updateSessionExposure = async (userId, matchId, value) => {
  await internalRedis.hset(userId, `${matchId}_sessionExposure`, value);
};
exports.updateMatchExposure = async (userId, matchId, value) => {
  await internalRedis.hset(userId, redisKeys.userMatchExposure+matchId, value);
};

exports.getUserRedisData = async (userId)=>{
  
  // Retrieve all user data for the match from Redis
  const userData = await internalRedis.hgetall(userId);

  // Return the user data as an object or null if no data is found
  return Object.keys(userData)?.length == 0 ? null : userData;
}

exports.getUserRedisKey = async (userId,key)=>{
  
  // Retrieve all user data for the match from Redis
  const userData = await internalRedis.hget(userId,key);

  // Return the user data as an object or null if no data is found
  return  userData;
}

exports.updateUserDataRedis = async (userId, value) => {
  await internalRedis.hmset(userId, value);
};

exports.hasUserInCache = async (userId) => {
  return await internalRedis.exists(userId);
}

exports.deleteKeyFromUserRedis = async (userId,key) => {
  return await internalRedis.hdel(userId,key);
}