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
  const userData = await internalRedis.hmget(userId,key);

  // Return the user data as an object or null if no data is found
  return  userData;
}

exports.updateUserDataRedis = async (userId, value) => {
  await internalRedis.hmset(userId, value);
};

// Assuming internalRedis is the Redis client instance
exports.incrementValuesRedis = async (userId, value, updateValues) => {
  // Start pipelining
  const pipeline = internalRedis.pipeline();
  // Queue up HINCRBY commands for each field in 'value' object
  Object.entries(value).forEach(([field, increment]) => {
    pipeline.hincrbyfloat(userId, field, increment);
  });
  // If there are additional values to update, queue an HMSET command
  if (updateValues) {
    pipeline.hmset(userId, updateValues);
  }
  // Execute the pipeline
  await pipeline.exec();
};


exports.hasUserInCache = async (userId) => {
  return await internalRedis.exists(userId);
}

exports.deleteKeyFromUserRedis = async (userId,...key) => {
  return await internalRedis.hdel(userId,key);
}

exports.getUserRedisKeys = async (userId,keys)=>{
  // Retrieve all user data for the match from Redis
  const userData = await internalRedis.hmget(userId,keys);

  // Return the user data as an object or null if no data is found
  return  userData;
}

exports.getUserRedisSingleKey = async (userId,key)=>{
  // Retrieve all user data for the match from Redis
  const userData = await internalRedis.hget(userId,key);

  // Return the user data as an object or null if no data is found
  return  userData;
}