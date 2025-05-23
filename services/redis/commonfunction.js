const { redisKeys, matchBettingType, redisTimeOut, oddsSessionBetType, sessionBettingType } = require("../../config/contants");
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

exports.getUserRedisMultiKeyData = async (userIds, keys) => {
  // Validate input to avoid unnecessary processing
  if (!Array.isArray(userIds) || !Array.isArray(keys) || userIds.length === 0 || keys.length === 0) {
    return {};
  }

  try {
    const pipeline = internalRedis.pipeline();

    // Use more efficient array iteration
    for (const userId of userIds) {
      pipeline.hmget(userId, ...keys);
    }

    const results = await pipeline.exec();

    // Process results to extract values and handle potential individual command errors
    return results.reduce((prev, [error, data], index) => {
      if (!error && data?.filter((item) => item !== null).length) {
        prev[userIds[index]] = {};
        for (let i = 0; i < data.length; i++) {
          prev[userIds[index]][keys[i]] = data[i];
        }
      }
      return prev;
    }, {});
  } catch (error) {
    throw error;
  }
};

exports.getUserRedisMultiKeyDataSession = async (userIds, matchId, betId) => {
  // Validate input to avoid unnecessary processing
  if (!Array.isArray(userIds) || !Array.isArray(keys) || userIds.length === 0 || !matchId || !betId) {
    return {};
  }

  try {
    const pipeline = internalRedis.pipeline();

    // Use more efficient array iteration
    for (const userId of userIds) {
      pipeline.get(`session:${userId}:${matchId}:${betId}:maxLoss`);
    }

    const results = await pipeline.exec();

    // Process results to extract values and handle potential individual command errors
    return results.reduce((prev, [error, data], index) => {
      if (!error && data?.filter((item) => item !== null).length) {
        prev[userIds[index]] = {};
        for (let i = 0; i < data.length; i++) {
          prev[userIds[index]].maxLoss = data[i];
        }
      }
      return prev;
    }, {});
  } catch (error) {
    throw error;
  }
};


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

exports.getUserSessionPL = async (userId, matchId, betId) => {
  const pipeline = internalRedis.pipeline();

  const upperKey = `session:${userId}:${matchId}:${betId}:upperLimitOdds`;
  const lowerKey = `session:${userId}:${matchId}:${betId}:lowerLimitOdds`;

  // Queue commands
  pipeline.get(upperKey);
  pipeline.get(lowerKey);

  // Execute pipeline
  const results = await pipeline.exec(); // [ [err, result], [err, result], ... ]

  // Extract results safely
  const [upperLimitRes, lowerLimitRes] = results;

  const upperLimit = upperLimitRes[1] !== null ? Number(upperLimitRes[1]) : null;
  const lowerLimit = lowerLimitRes[1] !== null ? Number(lowerLimitRes[1]) : null;

  return {
    upperLimitOdds: upperLimit,
    lowerLimitOdds: lowerLimit,
  };
};

exports.getUserSessionAllPL = async (userId, matchId, betId, type = sessionBettingType.session) => {
  const pipeline = internalRedis.pipeline();

  const upperKey = `session:${userId}:${matchId}:${betId}:upperLimitOdds`;
  const lowerKey = `session:${userId}:${matchId}:${betId}:lowerLimitOdds`;
  const totalBetKey = `session:${userId}:${matchId}:${betId}:totalBet`;
  const profitLossKey = `session:${userId}:${matchId}:${betId}:profitLoss`;
  const maxLossKey = `session:${userId}:${matchId}:${betId}:maxLoss`;

  // Queue commands
  pipeline.get(upperKey);
  pipeline.get(lowerKey);
  pipeline.get(totalBetKey);
  pipeline.hgetall(profitLossKey);
  pipeline.get(maxLossKey);

  // Execute pipeline
  const results = await pipeline.exec(); // [ [err, result], [err, result], ... ]

  // Extract results safely
  const [upperLimitRes, lowerLimitRes, totalBetRes, profitLossRes, maxLossRes] = results;

  const upperLimit = upperLimitRes[1] !== null ? Number(upperLimitRes[1]) : null;
  const lowerLimit = lowerLimitRes[1] !== null ? Number(lowerLimitRes[1]) : null;
  const totalBet = totalBetRes[1] !== null ? Number(totalBetRes[1]) : null;
  const profitLoss = profitLossRes[1] !== null ? profitLossRes[1] : null;
  const maxLoss = maxLossRes[1] !== null ? Number(maxLossRes[1]) : null;

  return {
    upperLimitOdds: upperLimit,
    lowerLimitOdds: lowerLimit,
    totalBet: totalBet,
    betPlaced: oddsSessionBetType.includes(type) ? Object.entries(profitLoss || {}).map(([key, value]) => ({
      odds: parseFloat(key),
      profitLoss: parseFloat(value)
    })) : profitLoss,
    maxLoss: maxLoss
  };
};

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

exports.setUserPLSession = async (userId, matchId, betId, redisData) => {
  const base = `session:${userId}:${matchId}:${betId}:`;

  await internalRedis.eval(`local pl = KEYS[1]
                local lo = tonumber(redis.call('GET', KEYS[2])) or 0
                local hi = tonumber(redis.call('GET', KEYS[3])) or 0

                local blo = tonumber(redis.call('HGET', pl, tostring(lo))) or 0
                local bhi = tonumber(redis.call('HGET', pl, tostring(hi))) or 0
                
                local maxLoss=0
                local high=hi
                local low=tonumber(redis.call('GET', KEYS[2])) or 999

                for i = 1, #ARGV, 2 do
                  local k = tonumber(ARGV[i])
                  local v = tonumber(ARGV[i + 1])
                  local base = 0

                  if k < low then
                    low=k
                  end

                  if k > high then
                      high=k
                  end

                  if k < lo then
                    base = blo
                  elseif k > hi then
                    base = bhi 
                  else
                    base = 0
                  end

                  local incr = v
                  local newValue =  redis.call('HINCRBYFLOAT', pl, ARGV[i], tonumber(base + incr))
                  if tonumber(newValue) < maxLoss then
                    maxLoss = tonumber(newValue)
                  end

                end
                redis.call('SET', KEYS[2], low)
                redis.call('SET', KEYS[3], high)
                redis.call('INCRBY', KEYS[4], 1)
                redis.call('SET', KEYS[5], math.abs(maxLoss))
                `, 5,
    base + 'profitLoss',
    base + 'lowerLimitOdds',
    base + 'upperLimitOdds',
    base + 'totalBet',
    base + 'maxLoss',
    ...redisData);
};

exports.setUserPLSessionOddEven = async (userId, matchId, betId, redisData) => {
  const base = `session:${userId}:${matchId}:${betId}:`;

  await internalRedis.eval(`
                local pl = KEYS[1]

                local maxLoss=0

                for i = 1, #ARGV, 2 do
                  local k = ARGV[i]
                  local v = tonumber(ARGV[i + 1])
                 
                 local newValue = redis.call('HINCRBYFLOAT', pl, k, v)
                
                  if tonumber(newValue) < maxLoss then
                    maxLoss=tonumber(newValue)
                  end
                
                end
                redis.call('INCRBY', KEYS[2], 1)
                redis.call('SET', KEYS[3], math.abs(maxLoss))
                `, 3,
    base + 'profitLoss',
    base + 'totalBet',
    base + 'maxLoss',
    ...redisData);
};

exports.getAllSessions = async (userId, matchId) => {
  if (matchId) {
    const pattern = `session:${userId}:${matchId}:*`;
    let cursor = '0';
    const sessions = {};

    do {
      // 1) Fetch a batch of keys
      const [nextCursor, keys] = await internalRedis.scan(
        cursor,
        'MATCH', pattern,
        'COUNT', 1000       // bump this up if you can afford more per‐round
      );
      cursor = nextCursor;

      if (keys.length) {
        // 2) Pipeline all TYPE calls
        const typePipeline = internalRedis.pipeline();
        keys.forEach(key => typePipeline.type(key));
        const typeResults = await typePipeline.exec();

        // 3) Pipeline GET or HGETALL based on type
        const dataPipeline = internalRedis.pipeline();
        typeResults.forEach(([_, type], idx) => {
          const key = keys[idx];
          if (type === 'hash') {
            dataPipeline.hgetall(key);
          } else {
            dataPipeline.get(key);
          }
        });
        const dataResults = await dataPipeline.exec();

        // 4) Assemble results
        for (let i = 0; i < keys.length; i++) {
          const [, , , betId, key] = keys[i]?.split(":")
          sessions[betId] = {
            ...sessions[betId],
            [key]: dataResults[i][1]
          }
        }
      }
    } while (cursor !== '0');

    return {
      [matchId]: Object.entries(sessions).reduce((prev, [key, val]) => {
        prev[key] = {
          totalBet: val.totalBet, "maxLoss": val.maxLoss, "betId": key,
          "upperLimitOdds": val.upperLimitOdds, "lowerLimitOdds": val.lowerLimitOdds, "betPlaced": Object.entries(val?.profitLoss || {})?.map(([odds, pl]) => ({ odds: odds, profitLoss: pl })) || [],
        }
        return prev;
      }, {})
    };
  }
  else {
    const data = await internalRedis.eval(`
      local userId = KEYS[1]
local pattern = 'session:' .. userId .. ':*'
local cursor = '0'
local sessions = {}

repeat
  local scanResult = redis.call('SCAN', cursor, 'MATCH', pattern, 'COUNT', 1000)
  cursor = scanResult[1]
  local keys = scanResult[2]

  for _, key in ipairs(keys) do
    local parts = {}
    for part in string.gmatch(key, '([^:]+)') do
      table.insert(parts, part)
    end
    local matchId = parts[3]
    local betId = parts[4]
    local field = parts[5]

    local t = redis.call('TYPE', key).ok
    local value
    if t == 'hash' then
      local raw = redis.call('HGETALL', key)
      local tbl = {}
      for i = 1, #raw, 2 do
        tbl[raw[i]] = raw[i+1]
      end
      value = tbl
    else
      value = redis.call('GET', key)
    end

    sessions[matchId] = sessions[matchId] or {}
    sessions[matchId][betId] = sessions[matchId][betId] or {}
    sessions[matchId][betId][field] = value
  end
until cursor == '0'

return cjson.encode(sessions)
`, 1, userId)
    return Object.entries(JSON.parse(data || "{}"))?.reduce((prev, [key, val]) => {
      prev[key] = Object.entries(val)?.reduce((prev, [betKey, betVal]) => {
        prev[betKey] = {
          "totalBet": betVal.totalBet, "maxLoss": betVal.maxLoss, "betId": betKey,
          "upperLimitOdds": betVal.upperLimitOdds, "lowerLimitOdds": betVal.lowerLimitOdds, "betPlaced": Object.entries(betVal?.profitLoss || {})?.map(([odds, pl]) => ({ odds: odds, profitLoss: pl })) || [],
        }
        return prev;
      }, {})
      return prev;
    }, {})
  }
};


exports.setProfitLossData = async (userId, matchId, betId, redisData) => {
  const base = `session:${userId}:${matchId}:${betId}:`;
  const pipeline = internalRedis.pipeline();
  pipeline.hset(base + 'profitLoss', redisData.betPlaced);
  pipeline.set(base + 'totalBet', redisData.totalBet);
  if (redisData.upperLimitOdds != null) {
    pipeline.set(base + 'upperLimitOdds', redisData.upperLimitOdds);
  }
  if (redisData.lowerLimitOdds != null) {
    pipeline.set(base + 'lowerLimitOdds', redisData.lowerLimitOdds);
  }
  pipeline.set(base + 'maxLoss', redisData.maxLoss);
  await pipeline.exec();
}

exports.deleteProfitLossData = async (userId) => {
  let cursor = '0';
  const keysToUnlink = [];

  do {
    const [newCursor, keys] = await internalRedis.scan(cursor, 'MATCH', `session:${userId}:*`, 'COUNT', 10000);
    cursor = newCursor;
    keysToUnlink.push(...keys);
  } while (cursor !== '0');

  if (keysToUnlink.length > 0) {
    const pipeline = internalRedis.pipeline();
    keysToUnlink.forEach(key => pipeline.unlink(key));
    await pipeline.exec();
  }
}

exports.setLoginVal = async (values) => {
  const pipeline = internalRedis.pipeline();

  for (const [key, value] of Object.entries(values)) {
    if (typeof value === 'object') {
      pipeline.hset(key, value);
    }
    else {
      pipeline.set(key, value);
    }
    pipeline.expire(key, redisTimeOut)
  }
  await pipeline.exec();
}


