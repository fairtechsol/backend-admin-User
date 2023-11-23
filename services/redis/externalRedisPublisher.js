const Redis = require('ioredis');
require("dotenv").config();

const publisher = new Redis({
    host: process.env.EXTERNAL_REDIS_HOST || 'localhost',
    port: process.env.EXTERNAL_REDIS_PORT || 6379,
});

async function sendMessage(channel, message) {
  await publisher.publish(channel, message);
}

module.exports = { sendMessage };
