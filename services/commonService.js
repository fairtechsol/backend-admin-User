const internalRedis = require("../config/internalRedisConnection");

exports.forceLogoutIfLogin = async (userId) => {
    let token = await internalRedis.hget(userId,"token");
  
    if (token) {
      // function to force logout
    }
  };