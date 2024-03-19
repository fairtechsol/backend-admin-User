const { userRoleConstant } = require("../config/contants");
const { AppDataSource } = require("../config/postGresConnection");
const userSchema = require("../models/user.entity");
const userBalanceSchema = require("../models/userBalance.entity");
const userMatchLockSchema = require("../models/userMatchLock.entity");
const user = AppDataSource.getRepository(userSchema);
const UserBalance = AppDataSource.getRepository(userBalanceSchema);
const userMatchLock = AppDataSource.getRepository(userMatchLockSchema);
const { ILike, In, Not, MoreThan } = require("typeorm");
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
    let userData1 = await user.createQueryBuilder()
      .where(where)
      .leftJoinAndMapOne(
        'user.userBal',
        'userBalances',
        'userBalances',
        'user.id = userBalances.userId'
      )
      .select(select);
    //userData1.select(select)
    let userData = userData1.getMany();

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
  WHERE id IN (SELECT id FROM RoleHierarchy) AND "userBlockedBy" IS NULL RETURNING id;
`
    : `
${getUserChild}
    UPDATE users
    SET "userBlock" = false, "userBlockedBy" = NULL
    WHERE id IN (SELECT id FROM RoleHierarchy) AND "userBlockedBy" = '${blockBy}' RETURNING id;
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
  WHERE id IN (SELECT id FROM RoleHierarchy) AND "betBlockedBy" IS NULL RETURNING id,"roleName";
`
    : `
${getUserChild}
    UPDATE users
    SET "betBlock" = false, "betBlockedBy" = NULL
    WHERE id IN (SELECT id FROM RoleHierarchy) AND "betBlockedBy" = '${blockBy}' RETURNING id,"roleName";
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

exports.getChildUserBalanceSum = async (id,excludeSelfBalance=false) => {
  let query = `WITH RECURSIVE p AS (
    SELECT * FROM "users" WHERE "users"."id" = '${id}'
    UNION
    SELECT "lowerU".* FROM "users" AS "lowerU" JOIN p ON "lowerU"."createBy" = p."id"
  )
SELECT SUM("userBalances"."currentBalance") as balance FROM p JOIN "userBalances" ON "userBalances"."userId" = "p"."id" where "deletedAt" IS NULL ${excludeSelfBalance ? `AND "p"."id" <> '${id}'` : ""};
;`

  return await user.query(query)
}



exports.getChildsWithOnlyUserRole = async (userId) => {
  let query = await user.query(`WITH RECURSIVE p AS (
    SELECT * FROM "users" WHERE "users"."id" = '${userId}'
    UNION
    SELECT "lowerU".* FROM "users" AS "lowerU" JOIN p ON "lowerU"."createBy" = p."id"
  )
  SELECT "id", "userName" FROM p where "deletedAt" IS NULL AND "roleName" = '${userRoleConstant.user}';`);
  return query;
}

exports.getParentsWithBalance = async (userId) => {
  let query = await user.query(`WITH RECURSIVE p AS (
    SELECT * FROM "users" WHERE "users"."id" = '${userId}'
    UNION
    SELECT "lowerU".* FROM "users" AS "lowerU" JOIN p ON "lowerU"."id" = p."createBy"
  )
  SELECT p."id", p."userName",p."roleName", p."matchCommission", p."sessionCommission", p."matchComissionType", p."createBy", p."userBlock", p."betBlock" FROM p where p."id" != '${userId}';`);
  return query;
}

exports.getFirstLevelChildUser = async (id) => {
  return await user.find({ where: { createBy: id, id: Not(id) }, select: { id: true, userName: true, roleName: true } });
}
exports.getFirstLevelChildUserWithPartnership = async (id,partnership) => {
  return await user.find({ where: { createBy: id, id: Not(id) }, select: { id: true, roleName: true, userName: true, [partnership]: true } })

}

exports.getUserBalanceDataByUserIds = async (userIds, select) => {
  return await UserBalance.find({
    where: { userId: In(userIds) },
    select: select
  })
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

exports.getUsersWithUserBalances = async (where) => {
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

exports.getMultipleUserWithTotalUsersBalanceData = (where, query, select) => {
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

exports.getMatchLockAllChild = (id) => {
  let query = `SELECT p."id", p."userName", um."blockBy", um."matchId", um."matchLock", um."sessionLock" FROM "users" p left join "userMatchLocks" um on p.id = um."userId" where p."deletedAt" IS NULL AND p.id != '${id}' AND p."createBy" = '${id}';`
  return user.query(query)
}

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
    SELECT * FROM "users" WHERE "users"."id" = '${id}'
    UNION
    SELECT "lowerU".* FROM "users" AS "lowerU" JOIN p ON "lowerU"."createBy" = p."id"
  )
SELECT p.*,"userBalances".*  FROM p JOIN "userBalances" ON "userBalances"."userId" = "p"."id" where "deletedAt" IS NULL;
`

  return await user.query(query)
}


exports.softDeleteAllUsers = (id) => {
  const query = `WITH RECURSIVE p AS (
    SELECT * FROM "users" WHERE "users"."id" = '${id}'
    UNION
    SELECT "lowerU".* FROM "users" AS "lowerU" JOIN p ON "lowerU"."createBy" = p."id"
  )
  UPDATE "users" AS u
  SET "deletedAt" = NOW(), -- Assuming "deletedAt" is the column for soft deletion
      "userName" = CONCAT('deleted_', u."userName", '_', EXTRACT(EPOCH FROM NOW()))
  WHERE u."id" IN (
    SELECT "id" FROM p
  )
  AND "deletedAt" IS NULL -- Only soft delete if not already deleted;  
  `
  return user.query(query);
}

exports.deleteUserByDirectParent = async (id) => {
  const query = `
  UPDATE "users" 
  SET "deletedAt" = NOW(), -- Assuming "deletedAt" is the column for soft deletion
      "userName" = CONCAT('deleted_', "users"."userName", '_', EXTRACT(EPOCH FROM NOW()))
  WHERE "users"."superParentId" = '${id}'
  AND "deletedAt" IS NULL -- Only soft delete if not already deleted;  
  `
  return user.query(query);
};