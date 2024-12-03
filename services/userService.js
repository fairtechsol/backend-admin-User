const { userRoleConstant } = require("../config/contants");
const { AppDataSource } = require("../config/postGresConnection");
const userSchema = require("../models/user.entity");
const userBalanceSchema = require("../models/userBalance.entity");
const userMatchLockSchema = require("../models/userMatchLock.entity");
const userMarketLockSchema = require("../models/userMarketLock.entity");
const user = AppDataSource.getRepository(userSchema);
const UserBalance = AppDataSource.getRepository(userBalanceSchema);
const userMatchLock = AppDataSource.getRepository(userMatchLockSchema);
const userMarketLock = AppDataSource.getRepository(userMarketLockSchema);
const { ILike, In, Not, IsNull, MoreThan } = require("typeorm");
const ApiFeature = require("../utils/apiFeatures");

// id is required and select is optional parameter is an type or array
exports.getUserById = async (id, select) => {
  return await user.findOne({
    where: { id: id },
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

exports.updateUserExposureLimit = async (exposureLimit, userIds) => {
  let updateUser = await user.createQueryBuilder()
    .update(user)
    .set({ exposureLimit: exposureLimit })
    .where(`("id" = ANY(:userIds)) AND (("exposureLimit" > :exposureLimit) OR ("exposureLimit" = 0))`, { userIds, exposureLimit })
    .execute();
  return updateUser;
};

exports.getCreditRefrence = async (where, select) => {
  let getamount = await user.find({ where, select: select })
  return getamount
}

exports.getUserBalance = async (where, select) => {
  try {
    let userData1 = user.createQueryBuilder()
      .where(where)
      .leftJoinAndMapOne(
        'user.userBal',
        'userBalances',
        'userBalances',
        'user.id = userBalances.userId'
      )
      .select(select);
    //userData1.select(select)
    let userData = await userData1.getMany();

    if (!userData || userData.length === 0) {
      throw new Error('No data found for the given criteria.');
    }

    return userData;
  } catch (error) {
    throw error;
  }
}
exports.getUserByUserName = async (userName, select) => {
  return await user.findOne({
    where: { userName: ILike(userName) },
    select: select,
  });
};

const getUserHierarchyQuery = `
  WITH RECURSIVE RoleHierarchy AS (
    SELECT id, "roleName", "createBy"
    FROM public.users
    WHERE id = $1
    UNION
    SELECT ur.id, ur."roleName", ur."createBy"
    FROM public.users ur
    JOIN RoleHierarchy rh ON ur."createBy" = rh.id
  ) `;
/**
 * Block or unblock a user or bet based on the specified parameters.
 *
 * @param {string} userId - The ID of the user to be blocked or unblocked.
 * @param {string} blockBy - The ID of the user performing the block or unblock action.
 * @param {boolean} block - A boolean indicating whether to block or unblock the user.
 * @returns {Promise<object>} - A Promise that resolves to the result of the database query.
 */
exports.userBlockUnblock = async (userId, blockBy, block) => {
  // Construct the SQL query for blocking or unblocking users based on the 'block' parameter
  const userBlockUnBlockQuery = block
    ? `
${getUserHierarchyQuery}
  UPDATE users
  SET "userBlock" = true, "userBlockedBy" = $2
  WHERE id IN (SELECT id FROM RoleHierarchy) AND "userBlockedBy" IS NULL RETURNING id;
`
    : `
${getUserHierarchyQuery}
    UPDATE users
    SET "userBlock" = false, "userBlockedBy" = NULL, "autoBlock" = false
    WHERE id IN (SELECT id FROM RoleHierarchy) AND "userBlockedBy" = $2 RETURNING id;
    `;

  // Execute the constructed query using the 'user.query' method
  let query = await user.query(userBlockUnBlockQuery, [userId, blockBy]);
  // Return the result of the query
  return query;
};

exports.betBlockUnblock = async (userId, blockBy, block) => {
  // Construct the SQL query for blocking or unblocking users based on the 'block' parameter
  const userBlockUnBlockQuery = block
    ? `
${getUserHierarchyQuery}
  UPDATE users
  SET "betBlock" = true, "betBlockedBy" = $2
  WHERE id IN (SELECT id FROM RoleHierarchy) AND "betBlockedBy" IS NULL RETURNING id,"roleName";
`
    : `
${getUserHierarchyQuery}
    UPDATE users
    SET "betBlock" = false, "betBlockedBy" = NULL
    WHERE id IN (SELECT id FROM RoleHierarchy) AND "betBlockedBy" = $2 RETURNING id,"roleName";
    `;

  // Execute the constructed query using the 'user.query' method
  let query = await user.query(userBlockUnBlockQuery, [userId, blockBy]);
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


exports.getAllUsers = async (where, select) => {

  return await user.find({
    where: where,
    select: select
  });

};
exports.getUsersWithUserBalance = async (where, offset, limit) => {
  //get all users with user balance according to pagoination

  let Query = user.createQueryBuilder()
    .select()
    .where(where)
    .leftJoinAndMapOne("user.userBal", "userBalances", "UB", "user.id = UB.userId")

  if (offset) {
    Query = Query.offset(parseInt(offset));
  }
  if (limit) {
    Query = Query.limit(parseInt(limit));
  }

  let result = await Query.getManyAndCount();
  return result;

}

exports.getUsersByWallet = async (where, select) => {
  let userData = user
    .createQueryBuilder()
    .where(where)
    .andWhere("user.id = user.createBy")
    .select(select)
    .getMany();

  return userData;
}

exports.getChildUser = async (id) => {
  let query = `WITH RECURSIVE p AS (
    SELECT * FROM "users" WHERE "users"."id" = $1
    UNION
    SELECT "lowerU".* FROM "users" AS "lowerU" JOIN p ON "lowerU"."createBy" = p."id"
  )
SELECT "id", "userName" FROM p where "deletedAt" IS NULL AND id != $1;`

  return await user.query(query, [id])
}

exports.getChildUserBalanceSum = async (id, excludeSelfBalance = false, where = "") => {
  // Initialize the base query
  let query = `
    WITH RECURSIVE p AS (
      SELECT * FROM "users" WHERE "users"."id" = $1
      UNION
      SELECT "lowerU".* FROM "users" AS "lowerU" JOIN p ON "lowerU"."createBy" = p."id"
    )
    SELECT SUM("userBalances"."currentBalance") as balance
    FROM p
    JOIN "userBalances" ON "userBalances"."userId" = "p"."id"
    WHERE "p"."deletedAt" IS NULL
  `;

  // Add condition to exclude self balance if needed
  if (excludeSelfBalance) {
    query += ` AND "p"."id" <> $1`;
  }

  // Add any additional conditions passed in the 'where' parameter
  if (where) {
    query += ` AND ${where}`;
  }

  // Complete the query
  query += ';';

  // Execute the query with parameterized values
  return await user.query(query, [id]);
}

exports.getChildsWithOnlyUserRole = async (userId) => {
  const query = `WITH RECURSIVE p AS (
      SELECT * FROM "users" WHERE "users"."id" = $1
      UNION
      SELECT "lowerU".* FROM "users" AS "lowerU" JOIN p ON "lowerU"."createBy" = p."id"
    )
    SELECT "id", "userName" FROM p WHERE "deletedAt" IS NULL AND "roleName" = $2;`;
  const results = await user.query(query, [userId, userRoleConstant.user]);
  return results;
}
exports.getParentsWithBalance = async (userId) => {
  const query = `WITH RECURSIVE p AS (
      SELECT * FROM "users" WHERE "users"."id" = $1
      UNION
      SELECT "lowerU".* FROM "users" AS "lowerU" JOIN p ON "lowerU"."id" = p."createBy"
    )
    SELECT p."id", p."userName", p."roleName", p."matchCommission", p."matchComissionType", p."createBy", p."userBlock", p."betBlock" FROM p WHERE p."id" != $1;`;
  const results = await user.query(query, [userId]);
  return results;
};

exports.getFirstLevelChildUser = async (id) => {
  return await user.find({ where: { createBy: id, id: Not(id) }, select: { id: true, userName: true, roleName: true } });
}

exports.getChildsWithMergedUser = async (id, ids) => {
  const query = `
    WITH RECURSIVE p AS (
      SELECT * FROM "users" WHERE "users"."id" = $1
      UNION
      SELECT "lowerU".* FROM "users" AS "lowerU" JOIN p ON "lowerU"."createBy" = p."id"
    )
    SELECT "id", "userName" FROM p WHERE "deletedAt" IS NULL AND ("roleName" = $2 or "createBy" = $1) AND "id" != $1 ${ids?.length?"AND id != ANY($3)":""};
  `;
  const results = await user.query(query, [id, userRoleConstant.user, ...(ids?.length?[ids]:[])]); // Avoid passing a blank array; include `ids` only if it has elements.
  return results;
}
exports.getFirstLevelChildUserWithPartnership = async (id, partnership) => {
  return await user.find({ where: { createBy: id, id: Not(id) }, select: { id: true, roleName: true, userName: true, [partnership]: true } })

}

exports.getUserBalanceDataByUserIds = async (userIds, select) => {
  return await UserBalance.find({
    where: { userId: In(userIds) },
    select: select
  });
}

exports.getUserWithUserBalance = async (userName) => {
  let userData = user
    .createQueryBuilder()
    .where({ userName: ILike(userName) })
    .leftJoinAndMapOne(
      "user.userBal",
      "userBalances",
      "UB",
      "user.id = UB.userId"
    )
    .getOne();

  return userData;
}

exports.getMultipleUsersWithUserBalances = async (where) => {
  let userData = user
    .createQueryBuilder()
    .where(where)
    .leftJoinAndMapOne(
      "user.userBal",
      "userBalances",
      "UB",
      "user.id = UB.userId"
    )
    .getMany();

  return userData;
}

exports.getUserWithUserBalanceData = async (where, select) => {
  const users = await UserBalance.findOne({
    relations: ["user"],
    where: where,
    select: select
  });
  return users;
}

exports.getUsersWithUsersBalanceData = async (where, query) => {
  //get all users with user balance according to pagoination
  let transactionQuery = new ApiFeature(user.createQueryBuilder()
    .where(where)
    .leftJoinAndMapOne("user.userBal", "userBalances", "UB", "user.id = UB.userId")
    , query).search().filter().sort().paginate().getResult();

  return await transactionQuery;
}

exports.getUsersWithTotalUsersBalanceData = (where, query, select) => {
  //get all users with user balance according to pagoination
  let transactionQuery = new ApiFeature(user.createQueryBuilder()
    .where(where)
    .leftJoinAndMapOne("user.userBal", "userBalances", "UB", "user.id = UB.userId")
    .select(select)
    .addOrderBy('1'), query)
    .search()
    .filter();

  return transactionQuery.query.getRawOne();
}

exports.getAllUsersByRole = async (role, select) => {
  return await user.find({
    where: { roleName: role },
    select: select,
  });
}

exports.getUserMatchLock = (where, select) => {
  return userMatchLock.findOne({ where: where, select: select });
}

exports.addUserMatchLock = async (body) => {
  let inserted = await userMatchLock.save(body);
  return inserted;
};

exports.deleteUserMatchLock = async (where) => {
  let deleted = await userMatchLock.delete(where);
  return deleted;
};
exports.getMatchLockAllChild = (id, matchId) => {
  const query = `
    SELECT p."id", p."userName", um."blockBy", um."matchId", um."matchLock", um."sessionLock"
    FROM "users" p
    LEFT JOIN "userMatchLocks" um ON p.id = um."userId" AND um."matchId" = $2
    WHERE p."deletedAt" IS NULL AND p.id != $1 AND p."createBy" = $1;
  `;
  try {
    return user.query(query, [id, matchId]);
  } catch (error) {
    throw error;
  }
}
exports.getUserMarketLock = (where, select) => {
  return userMarketLock.findOne({ where: where, select: select });
}

exports.getAllUsersMarket = async (where, select) => {
  return await userMarketLock.find({
    where: where,
    select: select
  });

};

exports.addUserMarketLock = async (body) => {
  let inserted = await userMarketLock.save(body);
  return inserted;
};

exports.insertUserMarketLock = async (body) => {
  let inserted = await userMarketLock.insert(body);
  return inserted;
};

exports.deleteUserMarketLock = async (where) => {
  let deleted = await userMarketLock.delete(where);
  return deleted;
};
exports.getMarketLockAllChild = async (where, select) => {
  let { matchId, betId, sessionType, createBy, ...whereData } = where; 
  whereData.createBy = createBy;
  let joinParameter = {matchId};
  let joinCondition = `
    userMarketLock.userId = user.id 
    AND userMarketLock.matchId = :matchId AND userMarketLock.createBy = :createBy`;

  if (betId) {
    joinCondition += ` AND userMarketLock.betId = :betId`;
    joinParameter.betId = betId;
  }
  if (sessionType) {
    joinCondition += ` AND userMarketLock.sessionType = :sessionType`;
    joinParameter.sessionType = sessionType;
  }

  const usersWithLockStatus = await user.createQueryBuilder('user')
  .leftJoin('userMarketLock', 'userMarketLock', joinCondition, joinParameter)
  .where(whereData) 
  .select(select)
  .addSelect(`CASE WHEN userMarketLock.userId IS NOT NULL THEN true ELSE false END AS "isLock"`)
  .getRawMany();

  return usersWithLockStatus;
};
exports.getGameLockForDetails = (where, select) => {
  try {
    let userData = userMatchLock.createQueryBuilder('userMatchLock')
      .leftJoinAndMapMany('userMatchLock.blockByUser', 'user', 'blockByUser', 'blockByUser.id = userMatchLock.blockBy')
      .leftJoinAndMapMany('userMatchLock.match', 'match', 'match', 'match.id = userMatchLock.matchId')
      .select(select)
      .where(where);
    return userData.getMany();
  } catch (error) {
    throw error;
  }
}

exports.isAllChildDeactive = (where, select, matchId) => {
  try {
    return user.createQueryBuilder('user')
      .leftJoinAndMapMany('user.blockUser', 'userMatchLock', 'userMatchLock', `user.id = userMatchLock.userId AND userMatchLock.matchId = '${matchId}'`)
      .select(select)
      .where(where)
      .getRawMany();
  } catch (error) {
    throw error;
  }
}


exports.getUserDataWithUserBalance = async (where) => {
  return await user
    .createQueryBuilder()
    .where(where)
    .leftJoinAndMapOne(
      "user.userBal",
      "userBalances",
      "UB",
      "user.id = UB.userId"
    )
    .getOne();
}

exports.getAllUsersBalanceSumByFgId = (parentId) => {
  return user
    .createQueryBuilder()
    .where({ superParentId: parentId })
    .leftJoinAndMapOne(
      "user.userBal",
      "userBalances",
      "UB",
      "user.id = UB.userId"
    )
    .select(["SUM(UB.currentBalance) as balance"])
    .addOrderBy('1')
    .getRawOne();
}

exports.getChildUserBalanceAndData = async (id) => {
  let query = `WITH RECURSIVE p AS (
    SELECT * FROM "users" WHERE "users"."id" = $1
    UNION
    SELECT "lowerU".* FROM "users" AS "lowerU" JOIN p ON "lowerU"."createBy" = p."id"
  )
SELECT p.*,"userBalances".*  FROM p JOIN "userBalances" ON "userBalances"."userId" = "p"."id" where "deletedAt" IS NULL;
`
  return await user.query(query, [id])
}


exports.softDeleteAllUsers = (id) => {
  const query = `WITH RECURSIVE p AS (
    SELECT * FROM "users" WHERE "users"."id" = $1
    UNION
    SELECT "lowerU".* FROM "users" AS "lowerU" JOIN p ON "lowerU"."createBy" = p."id"
  )
  UPDATE "users" AS u
  SET "deletedAt" = NOW(), -- Assuming "deletedAt" is the column for soft deletion
      "userName" = CONCAT('deleted_', u."userName", '_', EXTRACT(EPOCH FROM NOW()))
  WHERE u."id" IN (
    SELECT "id" FROM p
  )
  AND "deletedAt" IS NULL -- Only soft delete if not already deleted;`
  return user.query(query, [id]);
}

exports.deleteUserByDirectParent = async (id) => {
  const query = `
  UPDATE "users" 
  SET "deletedAt" = NOW(), -- Assuming "deletedAt" is the column for soft deletion
      "userName" = CONCAT('deleted_', "users"."userName", '_', EXTRACT(EPOCH FROM NOW()))
  WHERE "users"."superParentId" = $1
  AND "deletedAt" IS NULL -- Only soft delete if not already deleted;`
  return user.query(query, [id]);
};

exports.userPasswordAttempts = async (id) => {
  await user.query(`update "users" set "transactionPasswordAttempts" = "transactionPasswordAttempts" + 1 where "id" = $1`, [id]);

}

exports.getUserDataWithUserBalanceDeclare = async (where) => {
  return await user
    .createQueryBuilder()
    .where(where)
    .leftJoinAndMapOne(
      "user.userBalance",
      "userBalance",
      "userBalance",
      "user.id = userBalance.userId"
    )
    .getMany();
}

exports.deleteUser = async (where) => {
  await user.delete(where);
}