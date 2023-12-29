let Queue = require('bull')

const matchBetQueue = new Queue("matchBet",{
    redis: {
        port: process.env.REDIS_PORT,
        host: process.env.REDIS_HOST,
        password: process.env.REDIS_PASSWORD
        }
});

matchBetQueue.process((job, done) => {
  console.log(job.data);
  done();
  process.exit();
});

module.exports.matchBetQueue = matchBetQueue;