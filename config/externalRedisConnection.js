const Redis = require('ioredis');
require("dotenv").config();

const externalRedis = new Redis({
    host: process.env.EXTERNAL_REDIS_HOST || 'localhost',
    port: process.env.EXTERNAL_REDIS_PORT || 6379,
});

// Listen for the 'connect' event
externalRedis.on('connect', () => {
    console.log('Connected to External Redis server');
});

// Handle other Redis events if needed
externalRedis.on('error', (error) => {
    console.error('Error:', error);
});

module.exports = externalRedis;