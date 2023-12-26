// const { createClient } = require("ioredis");
const Redis = require('ioredis');
require("dotenv").config();

const internalRedis = new Redis({
    host: process.env.INTERNAL_REDIS_HOST || 'localhost',
    port: process.env.INTERNAL_REDIS_PORT || 6379,
    password : process.env.INTERNAL_REDIS_PASSWORD || ''
});

// Listen for the 'connect' event
internalRedis.on('connect', () => {
    console.log('Connected to Internal Redis server');
});

// Handle other Redis events if needed
internalRedis.on('error', (error) => {
    console.error('Error:', error);
});

module.exports = internalRedis;