const { transType, socketData } = require('../config/contants');
const { getUser, } = require('../services/userService');
const { ErrorResponse, SuccessResponse } = require('../utils/response')
const { insertTransactions } = require('../services/transactionService')
const { getUserBalanceDataByUserIds, updateUserBalanceByUserId, addInitialUserBalance, getUserBalanceDataByUserId } = require('../services/userBalanceService');
const { sendMessageToUser } = require('../sockets/socketManager');

exports.updateUserBalance = async (req, res) => {
  try {
    let { userId, transactionType, amount, transactionPassword, remark } =
      req.body;
    let reqUser = req.user;

    const userExistRedis=await hasUserInCache(userId);


    amount = parseFloat(amount);
    // let loginUser = await getUserById(reqUser.id || createBy)
    // if (!loginUser) return ErrorResponse({ statusCode: 400, message: { msg: "invalidData" } }, req, res);
    let user = await getUser({ id: userId, createBy: reqUser.id }, ["id"])
    if (!user) return ErrorResponse({ statusCode: 400, message: { msg: "notFound",keys :{name : "User"} } }, req, res);

    let loginUserBalanceData = getUserBalanceDataByUserId(reqUser.id);
    let insertUserBalanceData = getUserBalanceDataByUserId(user.id);
    let usersBalanceData = await Promise.all([loginUserBalanceData, insertUserBalanceData])
    if (!usersBalanceData.length || !usersBalanceData[1])
      return ErrorResponse(
        {
          statusCode: 400,
          message: { msg: "notFound", keys: { name: "User balance" } },
        },
        req,
        res
      );

    loginUserBalanceData = usersBalanceData[0]
    let updatedLoginUserBalanceData = {}
    let updatedUpdateUserBalanceData = {}
    if (transactionType == transType.add) {
      if (amount > loginUserBalanceData.currentBalance)
        return ErrorResponse(
          {
            statusCode: 400,
            message: { msg: "userBalance.insufficientBalance" },
          },
          req,
          res
        );
      insertUserBalanceData = usersBalanceData[1];
      updatedUpdateUserBalanceData.currentBalance =
        parseFloat(insertUserBalanceData.currentBalance) + parseFloat(amount);
      updatedUpdateUserBalanceData.profitLoss =
        parseFloat(insertUserBalanceData.profitLoss) + parseFloat(amount);
      let newUserBalanceData = await updateUserBalanceByUserId(
        user.id,
        updatedUpdateUserBalanceData
      );

      if(userExistRedis){

        await updateUserDataRedis(userId, updatedUpdateUserBalanceData);
      }

      updatedLoginUserBalanceData.currentBalance =
        parseFloat(loginUserBalanceData.currentBalance) - parseFloat(amount);
    } else if (transactionType == transType.withDraw) {
      insertUserBalanceData = usersBalanceData[1]
      if (amount > insertUserBalanceData.currentBalance)
        return ErrorResponse(
          {
            statusCode: 400,
            message: { msg: "userBalance.insufficientBalance" },
          },
          req,
          res
        );
      updatedUpdateUserBalanceData.currentBalance =
        parseFloat(insertUserBalanceData.currentBalance) - parseFloat(amount);
      updatedUpdateUserBalanceData.profitLoss =
        parseFloat(insertUserBalanceData.profitLoss) - parseFloat(amount);
      let newUserBalanceData = await updateUserBalanceByUserId(
        user.id,
        updatedUpdateUserBalanceData
      );

      if(userExistRedis){

        await updateUserDataRedis(userId, updatedUpdateUserBalanceData);
      }

      updatedLoginUserBalanceData.currentBalance =
        parseFloat(loginUserBalanceData.currentBalance) + parseFloat(amount);
    } else {
      return ErrorResponse(
        {
          statusCode: 400,
          message: { msg: "userBalance.InvalidTransactionType" },
        },
        req,
        res
      );
    }

    let newLoginUserBalanceData = await updateUserBalanceByUserId(
      reqUser.id,
      updatedLoginUserBalanceData
    );

    const parentUserExistRedis=await hasUserInCache(reqUser.id);

    if(parentUserExistRedis){

        await updateUserDataRedis(reqUser.id, updatedLoginUserBalanceData);
      }

    let transactionArray = [
      {
        actionBy: reqUser.id,
        searchId: reqUser.id,
        userId: user.id,
        amount: transactionType == transType.add ? amount : -amount,
        transType: transactionType,
        currentAmount: updatedUpdateUserBalanceData.currentBalance,
        description: remark
      }, {
        actionBy: reqUser.id,
        searchId: user.id,
        userId: user.id,
        amount: transactionType == transType.add ? -amount : amount,
        transType: transactionType == transType.add ? transType.withDraw : transType.add,
        currentAmount: updatedUpdateUserBalanceData.currentBalance,
        description: remark
        }]

    const transactioninserted = await insertTransactions(transactionArray);
    sendMessageToUser(userId,socketData.userBalanceUpdateEvent,updatedUpdateUserBalanceData);
    return SuccessResponse(
      {
        statusCode: 200,
        message: { msg: "updated",keys : {name : "User Balance"} },
        data: updatedUpdateUserBalanceData,
      },
      req,
      res
    );
  } catch (error) {
    return ErrorResponse(error, req, res);
  }
}

