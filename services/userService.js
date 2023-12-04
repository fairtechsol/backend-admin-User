const { AppDataSource } = require("../config/postGresConnection");
const bcrypt = require("bcryptjs");
const userSchema = require("../models/user.entity");
const user = AppDataSource.getRepository(userSchema);
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
};

exports.getUserByUserName = async (userName, select) => {
  return await user.findOne({
    where: { userName: ILike(userName) },
    select: select,
  });
};

exports.userBlockUnblock = async (userId, blockBy, block) => {
  const userBlockQuery = block
    ? `
    WITH RECURSIVE RoleHierarchy AS (
        SELECT id, "roleName", "createBy"
        FROM public.users
        WHERE id = '${userId}'
        UNION
        SELECT ur.id, ur."roleName", ur."createBy"
        FROM public.users ur
        JOIN RoleHierarchy rh ON ur."createBy" = rh.id
        
      )
      UPDATE users
      SET "userBlock" = true, "userBlockedBy" = '${blockBy}'
      WHERE id IN (SELECT id FROM RoleHierarchy) AND "userBlockedBy" IS NULL;
`
    : `
WITH RECURSIVE RoleHierarchy AS (
    SELECT id, "roleName", "createBy"
    FROM public.users
    WHERE id = '${userId}'
    UNION
    SELECT ur.id, ur."roleName", ur."createBy"
    FROM public.users ur
    JOIN RoleHierarchy rh ON ur."createBy" = rh.id
    
  )
  UPDATE users
  SET "userBlock" = false, "userBlockedBy" = NULL
  WHERE id IN (SELECT id FROM RoleHierarchy) AND "userBlockedBy" = '${blockBy}';
`;

  let query = await user.query(userBlockQuery);
  return query;
};
