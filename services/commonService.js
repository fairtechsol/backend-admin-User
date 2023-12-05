const internalRedis = require("../config/internalRedisConnection");
const { sendMessageToUser } = require("../sockets/socketManager");

exports.forceLogoutIfLogin = async (userId) => {
    let token = await internalRedis.hget(userId,"token");
  
    if (token) {
      // function to force logout
      sendMessageToUser(userId,"logoutUserForce",null)
    }
  };