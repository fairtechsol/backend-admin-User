const {
  transType,
  walletDescription,
  userRoleConstant,
} = require("../config/contants");
const {
  getDomainDataById,
  updateDomainData,
} = require("../services/domainDataService");
const { insertTransactions } = require("../services/transactionService");
const {
  addInitialUserBalance,
  getUserBalanceDataByUserId,
  updateUserBalanceByUserid,
} = require("../services/userBalanceService");
const { addUser, getUser } = require("../services/userService");
const { ErrorResponse } = require("../utils/response");

exports.createSuperAdmin = async (req, res) => {
  try {
    const {
      userName,
      fullName,
      password,
      phoneNumber,
      city,
      betBlock,
      userBlock,
      roleName,
      fwPartnership,
      faPartnership,
      saPartnership,
      aPartnership,
      smPartnership,
      mPartnership,
      id,
      creditRefrence,
      exposureLimit,
      maxBetLimit,
      minBetLimit,
      domain,
    } = req.body;

    if (roleName != userRoleConstant.superAdmin) {
      return ErrorResponse({
        statusCode: 403,
        message: {
          msg: "invalidData",
        },
      });
    }

    await addDomainData({
      ...domain,
      userName,
      userId: id,
    });

    let userData = {
      userName,
      fullName,
      password,
      phoneNumber,
      city,
      betBlock,
      userBlock,
      roleName,
      fwPartnership,
      faPartnership,
      saPartnership,
      aPartnership,
      smPartnership,
      mPartnership,
      id,
      creditRefrence,
      exposureLimit,
      maxBetLimit,
      minBetLimit,
      createBy: id,
    };
    let insertUser = await addUser(userData);

    let transactionArray = [
      {
        actionBy: id,
        searchId: id,
        userId: id,
        amount: 0,
        transType: transType.add,
        currentAmount: creditRefrence,
        description: walletDescription.userCreate,
      },
    ];

    await insertTransactions(transactionArray);
    let insertUserBalanceData = {
      currentBalance: 0,
      userId: insertUser.id,
      profitLoss: 0,
      myProfitLoss: 0,
      downLevelBalance: 0,
      exposure: 0,
    };
    insertUserBalanceData = await addInitialUserBalance(insertUserBalanceData);

    let response = lodash.omit(insertUser, ["password", "transPassword"]);
    return SuccessResponse(
      {
        statusCode: 200,
        message: {
          msg: "created",
          keys: {
            name: "Super admin",
          },
        },
        data: response,
      },
      req,
      res
    );
  } catch (err) {
    return ErrorResponse(err, req, res);
  }
};

exports.updateSuperAdmin = async (req, res) => {
  try {
    let { id, logo, sidebarColor, headerColor, footerColor } = req.body;
    let isDomainData = await getDomainDataById({ id }, ["id"]);
    if (!isDomainData) {
      return ErrorResponse(
        { statusCode: 400, message: { msg: "invalidData" } },
        req,
        res
      );
    }

    await updateDomainData(id, {
      logo,
      sidebarColor,
      headerColor,
      footerColor,
    });

    return SuccessResponse(
      {
        statusCode: 200,
        message: {
          msg: "update",
          keys: {
            name: "User",
          },
        },
        data: response,
      },
      req,
      res
    );
  } catch (err) {
    return ErrorResponse(err, req, res);
  }
};

exports.updateSuperAdminBalance = async (req, res) => {
  try {
    let { userId, transactionType, amount, remark } = req.body;
    amount = parseFloat(amount);

    let user = await getUser({ id: userId }, ["id"]);
    if (!user)
      return ErrorResponse(
        { statusCode: 400, message: { msg: "invalidData" } },
        req,
        res
      );

    let userBalanceData = getUserBalanceDataByUserId(user.id);

    if (!userBalanceData)
      return ErrorResponse(
        { statusCode: 400, message: { msg: "invalidData" } },
        req,
        res
      );

    if (transactionType == transType.add) {
      await updateUserBalanceByUserid(user.id, {
        currentBalance:
          parseFloat(userBalanceData.currentBalance) + parseFloat(amount),
        profitLoss: parseFloat(userBalanceData.profitLoss) + parseFloat(amount),
      });
    } else if (transactionType == transType.withDraw) {
      if (amount > userBalanceData.currentBalance)
        return ErrorResponse(
          {
            statusCode: 400,
            message: { msg: "userBalance.insufficientBalance" },
          },
          req,
          res
        );

      await updateUserBalanceByUserid(user.id, {
        currentBalance:
          parseFloat(userBalanceData.currentBalance) - parseFloat(amount),
        profitLoss: parseFloat(userBalanceData.profitLoss) - parseFloat(amount),
      });
    } else {
      return ErrorResponse(
        { statusCode: 400, message: { msg: "invalidData" } },
        req,
        res
      );
    }

    let transactionArray = [
      {
        actionBy: userId,
        searchId: userId,
        userId: userId,
        amount: transactionType == transType.add ? amount : -amount,
        transType: transactionType,
        currentAmount: userBalanceData.currentBalance,
        description: remark,
      },
    ];

    await insertTransactions(transactionArray);
    return SuccessResponse(
      {
        statusCode: 200,
        message: { msg: "userBalance.BalanceAddedSuccessfully" },
        data: { user },
      },
      req,
      res
    );
  } catch (error) {
    return ErrorResponse(error, req, res);
  }
};
