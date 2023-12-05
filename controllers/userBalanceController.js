const { transType } = require('../config/contants');
const { getUser, } = require('../services/userService');
const { ErrorResponse, SuccessResponse } = require('../utils/response')
const { insertTransactions } = require('../services/transactionService')
const { getUserBalanceDataByUserIds, updateUserBalanceByUserid, addUserBalance, getUserBalanceDataByUserId } = require('../services/userBalanceService');

exports.updateUserBalance = async (req, res) => {
    try {
        let { userId, transactionType, amount, transactionPassword, remark, createBy } = req.body
        let reqUser = req.user || { id: createBy }
        amount = parseFloat(amount)
        // let loginUser = await getUserById(reqUser.id || createBy)
        // if (!loginUser) return ErrorResponse({ statusCode: 400, message: { msg: "invalidData" } }, req, res);
        let user = await getUser({ id: userId, createBy: reqUser.id }, ["id"])
        if (!user) return ErrorResponse({ statusCode: 400, message: { msg: "invalidData" } }, req, res);

        let loginUserBalanceData = getUserBalanceDataByUserId(reqUser.id);
        let insertUserBalanceData = getUserBalanceDataByUserId(user.id);
        let usersBalanceData = await Promise.all([loginUserBalanceData, insertUserBalanceData])
        if (!usersBalanceData.length || !usersBalanceData[1])
            return ErrorResponse({ statusCode: 400, message: { msg: "invalidData" } }, req, res);
        
        loginUserBalanceData = usersBalanceData[0]
        let updatedLoginUserBalanceData = {}
        let updatedUpdateUserBalanceData = {}
        if (transactionType == transType.add) {
            if (amount > loginUserBalanceData.currentBalance)
                return ErrorResponse({ statusCode: 400, message: { msg: "userBalance.insufficientBalance" } }, req, res);
            insertUserBalanceData = usersBalanceData[1]
            updatedUpdateUserBalanceData.currentBalance = parseFloat(insertUserBalanceData.currentBalance) + parseFloat(amount);
            updatedUpdateUserBalanceData.profitLoss = parseFloat(insertUserBalanceData.profitLoss) + parseFloat(amount)
            let newUserBalanceData = await updateUserBalanceByUserid(user.id, updatedUpdateUserBalanceData)
            updatedLoginUserBalanceData.currentBalance = parseFloat(loginUserBalanceData.currentBalance) - parseFloat(amount);
        } else if (transactionType == transType.withDraw) {
            insertUserBalanceData = usersBalanceData[1]
            if (amount > insertUserBalanceData.currentBalance)
                return ErrorResponse({ statusCode: 400, message: { msg: "userBalance.insufficientBalance" } }, req, res);
            updatedUpdateUserBalanceData.currentBalance = parseFloat(insertUserBalanceData.currentBalance) - parseFloat(amount);
            updatedUpdateUserBalanceData.profitLoss = parseFloat(insertUserBalanceData.profitLoss) - parseFloat(amount);
            let newUserBalanceData = await updateUserBalanceByUserid(user.id, updatedUpdateUserBalanceData)
            updatedLoginUserBalanceData.currentBalance = parseFloat(loginUserBalanceData.currentBalance) + parseFloat(amount);
        } else {
            return ErrorResponse({ statusCode: 400, message: { msg: "invalidData" } }, req, res);
        }

        let newLoginUserBalanceData = await updateUserBalanceByUserid(reqUser.id, updatedLoginUserBalanceData)

        let transactionArray = [{
            actionBy: reqUser.id,
            searchId: reqUser.id,
            userId: user.id,
            amount: transactionType == transType.add ? amount : -amount,
            transType: transactionType,
            currentAmount: insertUserBalanceData.currentBalance,
            description: remark
        }, {
            actionBy: reqUser.id,
            searchId: user.id,
            userId: user.id,
            amount: transactionType == transType.add ? -amount : amount,
            transType: transactionType == transType.add ? transType.withDraw : transType.add,
            currentAmount: newLoginUserBalanceData.currentBalance,
            description: remark
        }]

        const transactioninserted = await insertTransactions(transactionArray);
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
}

