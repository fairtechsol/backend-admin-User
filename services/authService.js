
const { AppDataSource } = require("../config/postGresConnection");
const userSchema = require('../models/user.entity');
const user = AppDataSource.getRepository(userSchema);
const internalRedis = require("../config/internalRedisConnection");
const externalRedis = require("../config/externalRedisConnection");
const publisherService = require("./redis/externalRedisPublisher");
const subscribeService = require("./redis/externalRedisSubscriber");
const internalRedisSubscribe = require("./redis/internalRedisSubscriber");
const internalRedisPublisher = require("./redis/internalRedisPublisher");

// this is the dummy function to test the functionality
exports.dummyFunction = async () => {
  subscribeService.receiveMessages();
  internalRedisSubscribe.receiveMessages();
  let counter = parseInt(await internalRedis.get("first")) || 1;
  console.log("internal redis count ", counter);
  await internalRedis.set("first", counter + 1);


  let counter1 = (await externalRedis.hgetall("first")) || 2;
  console.log("external redis count ", counter1.count);
  await externalRedis.hset("first", { count: 1 });
  setInterval(async () => {
    const message = { foo: Math.random() };
    await publisherService.sendMessage('channelName', JSON.stringify(message));
  }, 1000*2);



  setInterval(async () => {
    const message = { foo: Math.random() };
    await internalRedisPublisher.sendMessage('internalChannel', JSON.stringify(message));
  }, 1000*2);

  return await user.find();
}
  exports.createUser = async () => {
    let userCreate = user.create({
      userName : "uniqueUser",
      fullName : "unique user",
      password : "123456",
      "transPassword" : "1234556",
      phoneNumber : "9876544321",
      city : "mohali",
      roleName  :"admin",
      matchComissionType : 'totalLoss',
    })
    return  userCreate;
  }