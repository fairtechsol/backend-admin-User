const { AppDataSource } = require("../config/postGresConnection");
const bcrypt = require("bcryptjs");
const { In } = require('typeorm');
const userSchema = require("../models/user.entity");
const userBalanceSchema = require("../models/userBalance.entity");
const user = AppDataSource.getRepository(userSchema);
const UserBalance = AppDataSource.getRepository(userBalanceSchema);
const internalRedis = require("../config/internalRedisConnection");
const externalRedis = require("../config/externalRedisConnection");
const publisherService = require("./redis/externalRedisPublisher");
const subscribeService = require("./redis/externalRedisSubscriber");
const internalRedisSubscribe = require("./redis/internalRedisSubscriber");
const internalRedisPublisher = require("./redis/internalRedisPublisher");
const { ILike } = require("typeorm");

// this is the dummy function to test the functionality

exports.getUserById = async (id, select) => {
  return await user.findOne({
    where: { id },
    select: select,
  });
};

exports.addUser = async (body) => {
  let insertUser = await user.save(body);
  return insertUser;
};

exports.updateUser = async (id, body) => {
  let updateUser = await user.update(id, body);
  return updateUser;
}


exports.getUserByUserName = async (userName, select) => {
  return await user.findOne({
    where: { userName: ILike(userName) },
    select: select,
  });
};

exports.getUser = async (where = {}, select) => {
  //find list with filter and pagination
  return await user.findOne({
    where: where,
    select: select
  });

};


exports.getUsers = async (where, select, offset, limit, relations) => {
  //find list with filter and pagination
  
  return await user.findAndCount({
    where: where,
    select: select,
    skip: offset,
    take: limit,
    relations: relations
  });

};

exports.getUsersWithUserBalance = async (where, offset, limit) => {
  //get all users with user balance according to pagoination

  let Query = user.createQueryBuilder()
  .select()
  .where(where)
  .leftJoinAndMapOne("user.userBal","userBalances", "UB","user.id = UB.userId")

  if (offset) {
    Query = Query.offset(parseInt(offset));
  }
  if (limit) {
    Query = Query.limit(parseInt(limit));
  }

  var result = await Query.getManyAndCount();
  return result;

}
exports.getChildUser = async (id) => {
  let query = `WITH RECURSIVE p AS (
    SELECT * FROM "users" WHERE "users"."id" = '${id}'
    UNION
    SELECT "lowerU".* FROM "users" AS "lowerU" JOIN p ON "lowerU"."createBy" = p."id"
  )
SELECT "id", "userName" FROM p where "deletedAt" IS NULL AND id != '${id}';`

  return await user.query(query)
}

exports.getFirstLevelChildUser = async (id) => {
  let query = `SELECT "id","userName" FROM "users" WHERE "users"."createBy" = '${id}' AND "users"."deletedAt" IS NULL;`
  return await user.query(query)

}


exports.getUserBalanceDataByUserIds = async (userIds, select) => {
  return await UserBalance.find({
    where: { userId: In(userIds) },
    select: select
  })
}