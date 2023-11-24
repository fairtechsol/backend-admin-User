const { userRoleConstant, redisTimeOut } = require("../config/contants");
const internalRedis = require("../config/internalRedisConnection");
const authService = require("../services/authService");
const { ErrorResponse, SuccessResponse } = require("../utils/response");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const validateUser = async (userName, password) => {
  // Find user by username and select specific fields
  const user = await authService.getUserByUsername(userName, []);

  if (user) {
    if (bcrypt.compareSync(password, user.password)) {
      const { password, ...result } = user;
      return result;
    }
    return {
      error: true,
      message: "auth.invalidPass",
      statusCode: 403,
    };
  }
  return null;
};

const CheckAlreadyLogin = async (userId) => {
  let userRedisData = await internalRedis.hgetall(userId);
  if (userRedisData) {
    let token = userRedisData.token;
    if (token) {
      // function to force logout
    }
  }
};

const setUserDetailsRedis = async (user) => {
  const redisUserPartnerShip = await internalRedis.hget(
    user.id,
    "partnerShips"
  );
  if (redisUserPartnerShip) {
    internalRedis.expire(user.id, redisTimeOut);
  }

  let partnerShipObject = await findUserPartnerShipObj(user);
  const userPartnerShipData = {
    partnerShips: partnerShipObject,
    userRole: user.roleName,
  };
  await internalRedis.hmset(user.id, userPartnerShipData);
  await internalRedis.expire(user.id, redisTimeOut);
};

const findUserPartnerShipObj = async (user) => {
  const obj = {};

  if (
    user.userRole == userRoleConstant.user ||
    user.userRole == userRoleConstant.expert
  ) {
    return JSON.stringify(obj);
  }

  const roleFieldMapping = {
    [userRoleConstant.master]: "m",
    [userRoleConstant.superMaster]: "sm",
    [userRoleConstant.admin]: "a",
    [userRoleConstant.superAdmin]: "sa",
    [userRoleConstant.fairGameAdmin]: "fa",
    [userRoleConstant.fairGameWallet]: "fw",
  };

  const updateObj = (prefix, id) => {
    obj[`${prefix}Partnership`] = user[`${prefix}Partnership`];
    obj[`${prefix}PartnershipId`] = id;
  };

  const traverseHierarchy = async (currentUser) => {
    if (!currentUser) {
      return;
    }

    updateObj(roleFieldMapping[currentUser.roleName], currentUser.id);

    if (currentUser.createBy) {
      const createdByUser = await authService.getUserById(
        currentUser.createBy,
        ["id", "roleName", "createBy"]
      );
      await traverseHierarchy(createdByUser);
    }
  };

  await traverseHierarchy(user);

  return JSON.stringify(obj);
};

exports.login = async (req, res) => {
  try {
    const { password, loginType } = req.body;
    const userName = req.body.userName.trim.toUpperCase();
    const user = await validateUser(userName, password);

    if (user?.error) {
      return ErrorResponse(
        {
          statusCode: 404,
          message: {
            msg: user.message,
            key: user.statusCode,
          },
        },
        req,
        res
      );
    }

    if (!user) {
      return ErrorResponse(
        {
          statusCode: 404,
          message: {
            msg: "notFound",
            key: { name: "User" },
          },
        },
        req,
        res
      );
    } else if (user.userBlock) {
      return ErrorResponse(
        {
          statusCode: 403,
          message: {
            msg: "user.blocked",
          },
        },
        req,
        res
      );
    }
    const { roleName } = user;

    const throwBlockedError = () => {
      return ErrorResponse(
        {
          statusCode: 404,
          message: {
            msg: "user.blocked",
          },
        },
        req,
        res
      );
    };

    switch (loginType) {
      case userRoleConstant.user:
      case userRoleConstant.expert:
        if (roleName !== loginType) {
          return throwBlockedError();
        }
        break;

      case userRoleConstant.admin:
        const adminRoles = [
          userRoleConstant.admin,
          userRoleConstant.superAdmin,
          userRoleConstant.master,
          userRoleConstant.superMaster,
        ];
        if (!adminRoles.includes(roleName)) {
          return throwBlockedError();
        }
        break;

      case "wallet":
        const walletRoles = [
          userRoleConstant.fairGameAdmin,
          userRoleConstant.fairGameWallet,
        ];
        if (!walletRoles.includes(roleName)) {
          return throwBlockedError();
        }
        break;
    }

    // force logout user if already login on another device
    await CheckAlreadyLogin(user.id);
    setUserDetailsRedis(user);
    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, role: user.roleName, userName: user.userName },
      process.env.JWT_SECRET
    );

    // checking transition password
    const isTransPasswordCreated = user.transPassword ? true : false;
    // const forceChangePassword = user.loginAt ? false : true;

    // setting token in redis for checking if user already loggedin
    await internalRedis.hmset(user.id, { token: token });

    // Return token and user information

    return SuccessResponse(
      {
        statusCode: 200,
        message: { msg: "auth.loginSuccess" },
        data: {
          token,
          isTransPasswordCreated: isTransPasswordCreated,
          role: roleName,
        },
      },
      req,
      res
    );
  } catch (error) {
    return ErrorResponse(
      {
        statusCode: 500,
        message: error,
      },
      req,
      res
    );
  }
};

exports.signup = async (req, res) => {
  const { email, password } = req.body;
  const users = await authService.createUser(email, password);
  return SuccessResponse(
    { statusCode: 200, message: { msg: "signup" }, data: users },
    req,
    res
  );
};

exports.dummyFunction = async (req, res) => {
  try {
    console.log("at the controller");
    const users = await authService.dummyFunction();
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
