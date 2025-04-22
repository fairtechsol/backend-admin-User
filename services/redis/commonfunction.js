const { redisKeys, matchBettingType } = require("../../config/contants");
const internalRedis = require("../../config/internalRedisConnection");
const externalRedis = require("../../config/externalRedisConnection");

exports.updateSessionExposure = async (userId, matchId, value) => {
  await internalRedis.hset(userId, `${matchId}_sessionExposure`, value);
};
exports.updateMatchExposure = async (userId, matchId, value) => {
  await internalRedis.hset(userId, redisKeys.userMatchExposure + matchId, value);
};

exports.getUserRedisData = async (userId) => {

  // Retrieve all user data for the match from Redis
  const userData = await internalRedis.hgetall(userId);

  // Return the user data as an object or null if no data is found
  return Object.keys(userData)?.length == 0 ? null : userData;
}

exports.getUserRedisKey = async (userId, key) => {

  // Retrieve all user data for the match from Redis
  const userData = await internalRedis.hmget(userId, key);

  // Return the user data as an object or null if no data is found
  return userData;
}

exports.getUserRedisKeyData = async (userId, key) => {

  // Retrieve all user data for the match from Redis
  const userData = await internalRedis.hget(userId, key);

  // Return the user data as an object or null if no data is found
  return userData;
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

// Assuming internalRedis is the Redis client instance
exports.incrementRedisBalance = async (userId, key, value) => {
  return await internalRedis.hincrbyfloat(userId, key, value)
};

exports.hasUserInCache = async (userId) => {
  return await internalRedis.exists(userId);
}

exports.deleteKeyFromUserRedis = async (userId, ...key) => {
  return await internalRedis.hdel(userId, key);
}

exports.getUserRedisKeys = async (userId, keys) => {
  // Retrieve all user data for the match from Redis
  const userData = await internalRedis.hmget(userId, keys);

  // Return the user data as an object or null if no data is found
  return userData;
}

exports.getUserRedisSingleKey = async (userId, key) => {
  // Retrieve all user data for the match from Redis
  const userData = await internalRedis.hget(userId, key);

  // Return the user data as an object or null if no data is found
  return userData;
}

exports.setCardBetPlaceRedis = async (mid, key, value) => {
  await externalRedis.hincrbyfloat(`${mid}${redisKeys.card}`, key, value);
}

exports.deleteHashKeysByPattern = async (key, pattern) => {
  let cursor = '0';
  do {
    const result = await internalRedis.hscan(key, cursor, 'MATCH', pattern);
    cursor = result[0];
    const keys = result[1];
    for (const keyData of keys) {
      await internalRedis.hdel(key, keyData);
    }
  } while (cursor !== '0');
}

exports.getHashKeysByPattern = async (key, pattern) => {
  let cursor = '0';
  let resultObj = {};
  do {
    const result = await internalRedis.hscan(key, cursor, 'MATCH', pattern);
    cursor = result[0];
    const keys = result[1];
    for (let i = 0; i < keys?.length - 1; i += 2) {
      resultObj[keys[i]] = keys[i + 1];
    }
  } while (cursor !== '0');
  return resultObj;
}

exports.checkAndUpdateTransaction = async (userId, transactionId) => {
  return await internalRedis.hsetnx(userId, transactionId, 1);
}

exports.getRedisKey = async (key) => {
  return await internalRedis.get(key);
}

exports.setRedisKey = async (key, value, expire) => {
  // Start pipelining
  const pipeline = internalRedis.pipeline();

  pipeline.set(key, value);
  if (expire) {
    pipeline.expire(key, expire);
  }

  // Execute the pipeline
  await pipeline.exec();
}

exports.getExternalRedisKey = async (key) => {
  return await externalRedis.get(key);
}


exports.getMatchFromCache = async (matchId) => {
  let matchKey = `${matchId}_match`;
  let matchData = await externalRedis.hgetall(matchKey);
  if (Object.keys(matchData)?.length) {
    if (matchData?.sessionMaxBets) {
      matchData.sessionMaxBets = JSON.parse(matchData.sessionMaxBets)
    }
    

    Object.values(matchBettingType)?.forEach((item) => {
      if (matchData?.[item]) {
        matchData[item] = JSON.parse(matchData[item]);
      }
    });

    return matchData;
  }
  return null;
}

exports.getAllSessionRedis = async (matchId) => {
  // Retrieve all session data for the match from Redis
  const sessionData = await externalRedis.hgetall(`${matchId}_session`);

  // Return the session data as an object or null if no data is found
  return Object.keys(sessionData)?.length == 0 ? null : sessionData;
};

exports.getSessionFromRedis = async (matchId, sessionId) => {
  // Retrieve session data from Redis
  const sessionData = await externalRedis.hget(`${matchId}_session`, sessionId);

  // Parse and return the session data or null if it doesn't exist
  return sessionData ? JSON.parse(sessionData) : null;
};

exports.hasMatchInCache = async (matchId) => {
  let key = `${matchId}_match`;
  return await externalRedis.exists(key);
}

exports.getMultipleMatchKey = async (matchId) => {
  let matchKey = `${matchId}_match`;
  let MatchData = await externalRedis.hgetall(matchKey);
  return MatchData;
}
