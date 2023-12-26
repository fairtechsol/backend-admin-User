const { socketData } = require("../config/contants");
const internalRedis = require("../config/internalRedisConnection");
const { sendMessageToUser } = require("../sockets/socketManager");

exports.forceLogoutIfLogin = async (userId) => {
    let token = await internalRedis.hget(userId,"token");
  
    if (token) {
      // function to force logout
      sendMessageToUser(userId,socketData.logoutUserForceEvent,null)
    }
  };


  exports.forceLogoutUser = async (userId, stopForceLogout) => {

    if (!stopForceLogout) {
      await this.forceLogoutIfLogin(userId);
    }
    await internalRedis.hdel(userId, "token");
  
  };