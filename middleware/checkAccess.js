const { permissions } = require("../config/contants");
const { getUserPermissionFromRedis } = require("../utils/authUtils");
const { ErrorResponse } = require("../utils/response");

exports.checkAuthorize = (...permissionKey) => {
  return async (req, res, next) => {
    try {
      const { isAccessUser, childId } = req.user;
      if (!isAccessUser) {
        next();
        return;
      }

      const userPermission = JSON.parse((await getUserPermissionFromRedis(childId)) || "{}");
      for(let items of permissionKey){
        if (userPermission[items] || items == permissions.userPasswordChange) {
          req.user.permission=userPermission;
          next();
          return;
        }
      }
      
      return ErrorResponse(
        {
          statusCode: 403,
          message: {
            msg: "auth.unauthorizeRole",
          },
        },
        req,
        res
      );

    } catch (err) {
      return ErrorResponse(
        {
          statusCode: 403,
          message: {
            msg: "auth.unauthorizeRole",
          },
        },
        req,
        res
      );
    }
  };
}