const { AppDataSource } = require("../config/postGresConnection");
const internalRedis = require("../config/internalRedisConnection");
const externalRedis = require("../config/externalRedisConnection");
const publisherService = require("./redis/externalRedisPublisher");
const subscribeService = require("./redis/externalRedisSubscriber");
const internalRedisSubscribe = require("./redis/internalRedisSubscriber");
const internalRedisPublisher = require("./redis/internalRedisPublisher");
const userSchema = require("../models/user.entity");
const userRepo = AppDataSource.getRepository(userSchema);




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
    await publisherService.sendMessage("channelName", JSON.stringify(message));
  }, 1000 * 2);

  setInterval(async () => {
    const message = { foo: Math.random() };
    await internalRedisPublisher.sendMessage(
      "internalChannel",
      JSON.stringify(message)
    );
  }, 1000 * 2);

  return await user.find();
};

exports.getUserByUsername = async (userName,select) => {
  const user = await userRepo.findOne({
    where: { userName },
    select: select,
  });
  return user;
};

exports.getUserById = async (id,select) => {
  const user = await userRepo.findOne({
    where: { id },
    select: select,
  });
  return user;
};
