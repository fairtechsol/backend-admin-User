const { promisify } = require('util');
// Redis client configuration
const { matchOddName } = require('../config/contants');
const internalRedis = require('../config/internalRedisConnection');
const { getUser } = require('../services/userService');
const { ErrorResponse } = require('../utils/response');

// Promisify Redis methods for async/await usage
const redisGetAsync = promisify(internalRedis.get).bind(internalRedis);
const redisSetAsync = promisify(internalRedis.set).bind(internalRedis);
const redisExpireAsync = promisify(internalRedis.expire).bind(internalRedis);

// Middleware function for rate limiting
const delayMatchOddBet = async (req, res, next) => {
    try {
        const { bettingName } = req.body;

        if (bettingName == matchOddName) {

            const userId = req.user.id; // Assuming user ID is available in req.user.id
            const { delayTime } = await getUser({ id: userId }, ["id", "delayTime"]); // Function to fetch user delay time from a service

            const windowMs = parseFloat(delayTime) * 1000 ?? 5000;

            const currentTime = Date.now();
            const key = `rateLimit:${userId}`;
            const windowStart = currentTime - windowMs;

            // Fetch timestamps from Redis for the current user and window
            const timestamps = await getTimestampsFromRedis(key);

            // Filter timestamps within the current window
            const validTimestamps = timestamps.filter(ts => ts > windowStart);

            // Check if the number of requests exceeds the limit
            if (validTimestamps.length >= 1) {
                return ErrorResponse({ statusCode: 400, message: { msg: "bet.placeBetAfter5", keys: { time: delayTime } } }, req, res);
            }

            // Add current timestamp to Redis
            await addTimestampToRedis(key, currentTime, windowMs);

        }

        next(); // Proceed to the next middleware
    } catch (error) {
        return ErrorResponse({ statusCode: 400, message: { msg: "internalServerError" } }, req, res);
    }
};

// Function to fetch timestamps from Redis
const getTimestampsFromRedis = async (key) => {
    try {
        const result = await redisGetAsync(key);
        return result ? JSON.parse(result) : [];
    } catch (error) {
        return [];
    }
};

// Function to add timestamp to Redis
const addTimestampToRedis = async (key, timestamp, windowMs) => {
    try {
        const timestamps = await getTimestampsFromRedis(key);
        timestamps.push(timestamp);

        // Trim timestamps that are outside the current window
        const currentTime = Date.now();
        const windowStart = currentTime - windowMs;
        const validTimestamps = timestamps.filter(ts => ts > windowStart);

        // Store valid timestamps in Redis
        await redisSetAsync(key, JSON.stringify(validTimestamps));
        await redisExpireAsync(key, Math.ceil(windowMs / 1000)); // Set expiration in seconds

        return true;
    } catch (error) {
        return false;
    }
};

module.exports = delayMatchOddBet;
