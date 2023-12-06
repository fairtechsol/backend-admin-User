const { AppDataSource } = require("../config/postGresConnection");
const bcrypt = require("bcryptjs");
const userSchema = require("../models/user.entity");
const userBlockSchema = require("../models/userBlock.entity");
const user = AppDataSource.getRepository(userSchema);
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
 * @param {string} type - The type of blocking (user or bet) as a string.
 * @returns {Promise<object>} - A Promise that resolves to the result of the database query.
 */
exports.userBlockUnblock = async (userId, blockBy, block, type) => {
  // Determine the block type based on the provided 'type' and set the corresponding constant values
  const blockByType =
    type == blockType.betBlock ? "betBlockedBy" : "userBlockedBy";

  // Determine the blocking type based on the provided 'type' and set the corresponding constant values
  const blockingType =
    type == blockType.betBlock ? "betBlock" : "userBlock";

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
  SET "${blockingType}" = true, "${blockByType}" = '${blockBy}'
  WHERE id IN (SELECT id FROM RoleHierarchy) AND "${blockByType}" IS NULL RETURNING id;;
`
    : `
${getUserChild}
    UPDATE users
    SET "${blockingType}" = false, "${blockByType}" = NULL
    WHERE id IN (SELECT id FROM RoleHierarchy) AND "${blockByType}" = '${blockBy}' RETURNING id;;
    `;

  // Execute the constructed query using the 'user.query' method
  let query = await user.query(userBlockUnBlockQuery);
  // Return the result of the query
  return query;
};
exports.lockUnlockUserService = async (
  loginUser,
  updateUser,
  userBlock,
  betBlock
) => {
  try {
    let userId = updateUser.id;
    let createBy = loginUser.userId;
    let findChildQuery = `WITH RECURSIVE p AS (
    SELECT * FROM "users" WHERE "users"."id" = '${userId}'
    UNION
    SELECT "lowerU".* FROM "users" AS "lowerU" JOIN p ON "lowerU"."createBy" = p."id"
  )
SELECT "id", "userName" FROM p where "deletedAt" IS NULL;`;
    if (
      loginUser.roleName == userRoleConstant.fairGameWallet &&
      loginUser.id == updateUser.id
    ) {
      findChildQuery = `WITH RECURSIVE p AS (
        SELECT * FROM "user" WHERE "users"."id" = '${userId}'
        UNION
        SELECT "lowerU".* FROM "users" AS "lowerU" JOIN p ON "lowerU"."createBy" = p."id"
      )
    SELECT "id", "userName" FROM p where "deletedAt" IS NULL and "id" != '${userId}';`;
    }
    let childUsers = await user.query(findChildQuery);
    childUsers.map(async (child) => {
      let childUser = await this.getUserById(child.id, [
        "id",
        "userBlock",
        "betBlock",
        "roleName",
      ]);
      if (userBlock == 1 || betBlock == 1) {
        let blockUser = await userBlockRepo.findOne({
          where: { userId: child.id, createBy: createBy },
        });
        if (!blockUser) {
          let block = {};
          block.userBlock = userBlock;
          block.betBlock = betBlock;
          block.createBy = loginUser.id;
          block.userId = child.id;
          await userBlockRepo.save(block);
        } else if (
          blockUser.userBlock != userBlock ||
          blockUser.betBlock != betBlock
        ) {
          blockUser.userBlock = userBlock;
          blockUser.betBlock = betBlock;
          userBlockRepo.save(blockUser);
        }
        if (betBlock == 1 && userBlock == 1) {
          childUser.userBlock = userBlock;
          childUser.betBlock = betBlock;
        }
        if (betBlock == 0 && userBlock == 1) {
          childUser.betBlock = betBlock;
          let blockByOtherUser = await userBlockRepo.findOne({
            where: {
              userId: child.id,
              createBy: Not(createBy),
              betBlock: true,
            },
          });
          if (blockByOtherUser) {
            childUser.betBlock = 1;
          }
          childUser.userBlock = userBlock;
        }
        if (betBlock == 1 && userBlock == 0) {
          childUser.userBlock = userBlock;
          let blockByOtherUser = await userBlockRepo.findOne({
            where: {
              userId: child.id,
              createBy: Not(createBy),
              userBlock: true,
            },
          });
          if (blockByOtherUser) {
            childUser.userBlock = 1;
          }
          childUser.betBlock = betBlock;
        }
      } else {
        if (userBlock == 0 && betBlock == 0) {
          await userBlockRepo.delete({ userId: child.id, createBy: createBy });
          let blockUser = await userBlockRepo.find({
            where: { userId: child.id },
          });
          if (blockUser && blockUser.length) {
            let allBlockChange = false;
            let betBlockChange = false;
            blockUser.map((user) => {
              if (user.userBlock) {
                childUser.userBlock = true;
                allBlockChange = true;
                if (!betBlockChange) {
                  childUser.userBlock = user.userBlock;
                }
              }
              if (user.betBlock) {
                childUser.betBlock = true;
                betBlockChange = true;
                if (!allBlockChange) {
                  childUser.betBlock = user.betBlock;
                }
              }
            });
          } else {
            childUser.betBlock = false;
            childUser.userBlock = false;
          }
        }
      }
      user.update(
        { id: childUser.id },
        { betBlock: childUser.betBlock, userBlock: childUser.userBlock }
      );

      // will add the token expire and force logout if user is all block
    });
    return user.update(
      { id: updateUser.id },
      { betBlock: updateUser.betBlock, userBlock: updateUser.userBlock }
    );
  } catch (err) {
    throw err;
  }
};
