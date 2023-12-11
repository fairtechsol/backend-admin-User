const { AppDataSource } = require("../config/postGresConnection");
const bcrypt = require("bcryptjs");
const userSchema = require("../models/user.entity");
const userBalanceSchema = require("../models/userBalance.entity");
const user = AppDataSource.getRepository(userSchema);
const UserBalance = AppDataSource.getRepository(userBalanceSchema);
const userBlockSchema = require("../models/userBlock.entity");
const userBlockRepo = AppDataSource.getRepository(userBlockSchema);
const internalRedis = require("../config/internalRedisConnection");
const externalRedis = require("../config/externalRedisConnection");
const publisherService = require("./redis/externalRedisPublisher");
const subscribeService = require("./redis/externalRedisSubscriber");
const internalRedisSubscribe = require("./redis/internalRedisSubscriber");
const internalRedisPublisher = require("./redis/internalRedisPublisher");
const { ILike, In, IsNull, LessThanOrEqual, MoreThanOrEqual, Not } = require("typeorm");
const { userRoleConstant, blockType } = require("../config/contants");

// id is required and select is optional parameter is an type or array

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
};


exports.getUserByUserName = async (userName, select) => {
  return await user.findOne({
    where: { userName: ILike(userName) },
    select: select,
  });
};
/**
 * Block or unblock a user or bet based on the specified parameters.
 *
 * @param {string} userId - The ID of the user to be blocked or unblocked.
 * @param {string} blockBy - The ID of the user performing the block or unblock action.
 * @param {boolean} block - A boolean indicating whether to block or unblock the user.
 * @returns {Promise<object>} - A Promise that resolves to the result of the database query.
 */
exports.userBlockUnblock = async (userId, blockBy, block) => {


  // Define a recursive SQL query to fetch user hierarchy for the given 'userId'
  const getUserChild = `WITH RECURSIVE RoleHierarchy AS (
            SELECT id, "roleName", "createBy"
            FROM public.users
            WHERE id = '${userId}'
            UNION
            SELECT ur.id, ur."roleName", ur."createBy"
            FROM public.users ur
            JOIN RoleHierarchy rh ON ur."createBy" = rh.id
            )`;

  // Construct the SQL query for blocking or unblocking users based on the 'block' parameter
  const userBlockUnBlockQuery = block
    ? `
${getUserChild}
  UPDATE users
  SET "userBlock" = true, "userBlockedBy" = '${blockBy}'
  WHERE id IN (SELECT id FROM RoleHierarchy) AND "userBlockedBy" IS NULL RETURNING id;;
`
    : `
${getUserChild}
    UPDATE users
    SET "userBlock" = false, "userBlockedBy" = NULL
    WHERE id IN (SELECT id FROM RoleHierarchy) AND "userBlockedBy" = '${blockBy}' RETURNING id;;
    `;

  // Execute the constructed query using the 'user.query' method
  let query = await user.query(userBlockUnBlockQuery);
  // Return the result of the query
  return query;
};

exports.betBlockUnblock = async (userId, blockBy, block) => {


  // Define a recursive SQL query to fetch user hierarchy for the given 'userId'
  const getUserChild = `WITH RECURSIVE RoleHierarchy AS (
            SELECT id, "roleName", "createBy"
            FROM public.users
            WHERE id = '${userId}'
            UNION
            SELECT ur.id, ur."roleName", ur."createBy"
            FROM public.users ur
            JOIN RoleHierarchy rh ON ur."createBy" = rh.id
            )`;

  // Construct the SQL query for blocking or unblocking users based on the 'block' parameter
  const userBlockUnBlockQuery = block
    ? `
${getUserChild}
  UPDATE users
  SET "betBlock" = true, "betBlockedBy" = '${blockBy}'
  WHERE id IN (SELECT id FROM RoleHierarchy) AND "betBlockedBy" IS NULL RETURNING id;;
`
    : `
${getUserChild}
    UPDATE users
    SET "betBlock" = false, "betBlockedBy" = NULL
    WHERE id IN (SELECT id FROM RoleHierarchy) AND "betBlockedBy" = '${blockBy}' RETURNING id;;
    `;

  // Execute the constructed query using the 'user.query' method
  let query = await user.query(userBlockUnBlockQuery);
  // Return the result of the query
  return query;
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
  return await user.find({ where : { createBy: id}, select: { id: true, userName:true }})

}


exports.getUserBalanceDataByUserIds = async (userIds, select) => {
  return await UserBalance.find({
    where: { userId: In(userIds) },
    select: select
  })
}
