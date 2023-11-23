const Redis = require('ioredis');
require("dotenv").config();

const subscriber = new Redis({
    host: process.env.EXTERNAL_REDIS_HOST || 'localhost',
    port: process.env.ExTERNAL_REDIS_PORT || 6379,
});


function receiveMessages() {
    console.log("this is the sub file");
    subscriber.subscribe('channelName', (err, count) => {
    if (err) {
      console.error('Error in subscription:', err);
      return;
    }
    console.log(`Subscribed to ${count} channel(s)`);
  });

  subscriber.on('message', (channel, message) => {
    console.log(`Received message '${message}' from channel '${channel}'`);
    // Handle the received message here
  });
}

module.exports = { receiveMessages };
