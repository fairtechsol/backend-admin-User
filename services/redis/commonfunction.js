const internalRedis = require("../../config/internalRedisConnection");

exports.updateSessionExposure = async (userId, matchId, value) => {
  await internalRedis.hset(userId, `${matchId}_sessionExposure`, value);
};

exports.getUserRedisData = async (userId)=>{
  
  // Retrieve all user data for the match from Redis
  const userData = await internalRedis.hgetall(userId);

  // Return the user data as an object or null if no data is found
  return Object.keys(userData)?.length == 0 ? null : userData;
}


exports.updateUserDataRedis = async (userId, value) => {
  await internalRedis.hmset(userId, value);
};

exports.hasUserInCache = async (userId) => {
  return await internalRedis.exists(userId);
}