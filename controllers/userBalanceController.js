const { transType } = require('../config/contants');
const { getUser, } = require('../services/userService');
const { ErrorResponse, SuccessResponse } = require('../utils/response')
const { insertTransactions } = require('../services/transactionService')
const { getUserBalanceDataByUserIds, updateUserBalanceByUserid, addUserBalance } = require('../services/userBalanceService');

exports.updateUserBalance = async (req, res) => {
    try {
        let { userId, transactionType, amount, transactionPassword, remark, createBy } = req.body
        let reqUser = req.user || { id: createBy }
        amount = parseFloat(amount)
        // let loginUser = await getUserById(reqUser.id || createBy)
        // if (!loginUser) return ErrorResponse({ statusCode: 400, message: { msg: "invalidData" } }, req, res);
        let user = await getUser({ id: userId, createBy: reqUser.id }, ["id"])
        if (!user) return ErrorResponse({ statusCode: 400, message: { msg: "invalidData" } }, req, res);

        let usersBalanceData = await getUserBalanceDataByUserIds([reqUser.id, user.id]);
        if (!usersBalanceData.length)
            return ErrorResponse({ statusCode: 400, message: { msg: "invalidData" } }, req, res);
        let loginUserBalanceData = usersBalanceData[0]
        let updateUserBalanceData = {}
        let updatedLoginUserBalanceData = {}
        let updatedUpdateUserBalanceData = {}
        if (transactionType == transType.add) {

            if (amount > loginUserBalanceData.currentBalance)
                return ErrorResponse({ statusCode: 400, message: { msg: "userBalance.insufficientBalance" } }, req, res);
            if (usersBalanceData[1]) {
                updateUserBalanceData = usersBalanceData[1]
                updatedUpdateUserBalanceData.currentBalance = parseFloat(updateUserBalanceData.currentBalance) + parseFloat(amount);
                updatedUpdateUserBalanceData.profitLoss = parseFloat(updateUserBalanceData.profitLoss) + parseFloat(amount)
                console.log(updatedUpdateUserBalanceData);
                let newUserBalanceData = await updateUserBalanceByUserid(user.id, updatedUpdateUserBalanceData)
                updatedLoginUserBalanceData.currentBalance = parseFloat(loginUserBalanceData.currentBalance) - parseFloat(amount);
            } else {
                updateUserBalanceData = {
                    currentBalance: amount,
                    userId: user.id,
                    profitLoss: amount,
                    myProfitLoss: 0,
                    downLevelBalance: 0,
                    exposure: 0
                }
                updateUserBalanceData = await addUserBalance(updateUserBalanceData)
                updatedLoginUserBalanceData.currentBalance = parseFloat(loginUserBalanceData.currentBalance) - parseFloat(amount);
            }
        } else if (transactionType == transType.withDraw) {
            if (!usersBalanceData[1])
                return ErrorResponse({ statusCode: 400, message: { msg: "invalidData" } }, req, res);
            updateUserBalanceData = usersBalanceData[1]
            if (amount > updateUserBalanceData.currentBalance)
                return ErrorResponse({ statusCode: 400, message: { msg: "userBalance.insufficientBalance" } }, req, res);
            updatedUpdateUserBalanceData.currentBalance = parseFloat(updateUserBalanceData.currentBalance) - parseFloat(amount);
            updatedUpdateUserBalanceData.profitLoss = parseFloat(updateUserBalanceData.profitLoss) - parseFloat(amount);
            updatedUpdateUserBalanceData = await updateUserBalanceByUserid(user.id, updatedUpdateUserBalanceData)
            updatedLoginUserBalanceData.currentBalance = parseFloat(loginUserBalanceData.currentBalance) + parseFloat(amount);
        }else{
            return ErrorResponse({ statusCode: 400, message: { msg: "invalidData" } }, req, res);
        }

        console.log(updatedLoginUserBalanceData);
        let newLoginUserBalanceData = await updateUserBalanceByUserid(reqUser.id, updatedLoginUserBalanceData)

        let walletArray = [{
            actionBy: reqUser.id,
            searchId: reqUser.id,
            userId: user.id,
            amount: transactionType == transType.add ? amount : -amount,
            transType: transactionType,
            currentAmount: updateUserBalanceData.currentBalance,
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

        const transactioninserted = await insertTransactions(walletArray);
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

exports.addFGWalletBalance = async (req, res) => {
    try {
        let { amount, walletId } = req.body
        let updateUserBalanceData = {
            currentBalance: amount,
            userId: walletId,
            profitLoss: amount,
            myProfitLoss: 0,
            downLevelBalance: 0,
            exposure: 0
        }
        updateUserBalanceData = await addUserBalance(updateUserBalanceData)
        let walletArray = [{
            actionBy: walletId,
            searchId: walletId,
            userId: walletId,
            amount: amount,
            transType: transType.add,
            currentAmount: amount,
            description: "First wallet entry for testing"
        }]

        const transactioninserted = await insertTransactions(walletArray);
        return SuccessResponse(
            {
                statusCode: 200,
                message: { msg: "userBalance.BalanceAddedSuccessfully" },
                data: { updateUserBalanceData },
            },
            req,
            res
        );
    } catch (error) {
        return ErrorResponse(error, req, res);
    }
}