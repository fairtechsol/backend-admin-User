const grpc = require("@grpc/grpc-js");
const { __mf } = require("i18n");
const { logger } = require("../../../config/logger");
const { addMatchData } = require("../../../services/matchService");
const { addRaceData } = require("../../../services/racingServices");
const { userRoleConstant, matchWiseBlockType } = require("../../../config/contants");
const { getAllUsers, getChildUser, isAllChildDeactive, getUserMatchLock, addUserMatchLock, deleteUserMatchLock } = require("../../../services/userService");


exports.addMatch = async (call) => {
  try {
    const data = call.request;

    await addMatchData(data);

    return {}
  }
  catch (err) {
    logger.error({
      error: `Error at get match for the user.`,
      stack: err.stack,
      message: err.message,
    });
    // Handle any errors and return an error response
    throw {
      code: grpc.status.INTERNAL,
      message: err?.message || __mf("internalServerError"),
    };
  }
}

exports.raceAdd = async (call) => {
  try {
    const data = call.request;

    await addRaceData(data);

    return {}
  }
  catch (err) {
    logger.error({
      error: `Error at get match for the user.`,
      stack: err.stack,
      message: err.message,
    });
    // Handle any errors and return an error response
    throw {
      code: grpc.status.INTERNAL,
      message: err?.message || __mf("internalServerError"),
    };
  }
}

exports.userMatchLock = async (call) => {
  try {
    const { userId, matchId, type, block, operationToAll, roleName } = call.request;
    let reqUser = { id: userId, roleName: roleName };

    const childUsers = roleName == userRoleConstant.fairGameWallet ? await getAllUsers({}, ["id", "userName"]) : roleName == userRoleConstant.fairGameAdmin ? await getAllUsers({ superParentId: userId }, ["id", "userName"]) : await getChildUser(userId);
    const allChildUserIds = [...childUsers.map(obj => obj.id), ...(operationToAll ? [] : [userId])];

    let returnData;
    for (const blockUserId of allChildUserIds) {
      returnData = await userBlockUnlockMatch(blockUserId, matchId, reqUser, block, type);
    }

    let allChildMatchDeactive = true;
    let allChildSessionDeactive = true;

    const allDeactive = await isAllChildDeactive({ createBy: reqUser.id, id: Not(reqUser.id) }, ['userMatchLock.id'], matchId);
    allDeactive.forEach(ob => {
      if (!ob.userMatchLock_id || !ob.userMatchLock_matchLock) {
        allChildMatchDeactive = false;
      }
      if (!ob.userMatchLock_id || !ob.userMatchLock_sessionLock) {
        allChildSessionDeactive = false;
      }
    });

    return {};
  } catch (error) {
    throw {
      code: grpc.status.INTERNAL,
      message: error?.message || __mf("internalServerError"),
    };
  }
  async function userBlockUnlockMatch(userId, matchId, reqUser, block, type) {
    let userAlreadyBlockExit = await getUserMatchLock({ userId, matchId, blockBy: reqUser.id });

    if (!userAlreadyBlockExit) {
      if (!block) {
        throw { message: __mf("notUnblockFirst") };
      }

      const object = {
        userId,
        matchId,
        blockBy: reqUser.id,
        matchLock: type == matchWiseBlockType.match && block,
        sessionLock: type != matchWiseBlockType.match && block
      };

      addUserMatchLock(object);
      return object;
    }

    if (type == matchWiseBlockType.match) {
      userAlreadyBlockExit.matchLock = block;
    } else {
      userAlreadyBlockExit.sessionLock = block;
    }

    if (!block && !(userAlreadyBlockExit.matchLock || userAlreadyBlockExit.sessionLock)) {
      deleteUserMatchLock({ id: userAlreadyBlockExit.id });
      return userAlreadyBlockExit;
    }

    addUserMatchLock(userAlreadyBlockExit);
    return userAlreadyBlockExit;
  }

}
