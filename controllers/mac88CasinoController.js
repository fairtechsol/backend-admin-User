const { mac88Domain, mac88CasinoOperatorId } = require("../config/contants");
const { getUserRedisData } = require("../services/redis/commonfunction");
const { getUserById } = require("../services/userService");
const { apiCall, apiMethod, allApiRoutes } = require("../utils/apiService");
const { generateRSASignature } = require("../utils/generateCasinoSignature");
const { SuccessResponse, ErrorResponse } = require("../utils/response");

exports.loginMac88Casino = async (req, res) => {
    try {
        const { gameId, platformId } = req.body;

        const user = await getUserById(req.user.id, ["id", "userName", "isDemo"]);
        if (user.isDemo) {
            return ErrorResponse({ statusCode: 403, message: { msg: "user.demoNoAccess" } }, req, res);
        }
        const userRedisData = await getUserRedisData(user.id);

        let casinoData = {
            "operatorId": mac88CasinoOperatorId,
            "providerName": "EZUGI",
            "gameId": gameId,
            "userId": user.id,
            "username": user.userName,
            "platformId": platformId,
            "lobby": false,
            "clientIp": req.headers["x-forwarded-for"] || req.socket.remoteAddress,
            "currency": "INR",
            "balance": userRedisData?.currentBalance,
            "redirectUrl": "https://hypexone.com"
        }
        let result;
        if (userRedisData) {
            result = await apiCall(apiMethod.post, mac88Domain + allApiRoutes.MAC88.login, casinoData, { Signature: generateRSASignature(JSON.stringify(casinoData)) });

            console.log(result);
        }

        return SuccessResponse(
            {
                statusCode: 200,
                data: result,
            },
            req,
            res
        );
    }
    catch (error) {
        return ErrorResponse(
            {
                statusCode: 500,
                message: error.message,
            },
            req,
            res
        );
    }
}

exports.getBalanceMac88 = async (req, res) => {
    try {
        console.log(req.body);

        return res.send(200).json({
            "balance": 1000,
            "status": "OP_SUCCESS"
        })
    }
    catch (error) {
        return ErrorResponse(
            {
                statusCode: 500,
                message: error.message,
            },
            req,
            res
        );
    }
}

exports.getBetsMac88 = async (req, res) => {
    try {
        console.log(req.body);

        return res.send(200).json({
            "balance": 1000,
            "status": "OP_SUCCESS"
        })
    }
    catch (error) {
        return ErrorResponse(
            {
                statusCode: 500,
                message: error.message,
            },
            req,
            res
        );
    }
}

exports.resultRequestMac88 = async (req, res) => {
    try {
        console.log(req.body);

        return res.send(200).json({
            "balance": 1000,
            "status": "OP_SUCCESS"
        })
    }
    catch (error) {
        return ErrorResponse(
            {
                statusCode: 500,
                message: error.message,
            },
            req,
            res
        );
    }
}

exports.rollBackRequestMac88 = async (req, res) => {
    try {
        console.log(req.body);

        return res.send(200).json({
            "balance": 1000,
            "status": "OP_SUCCESS"
        })
    }
    catch (error) {
        return ErrorResponse(
            {
                statusCode: 500,
                message: error.message,
            },
            req,
            res
        );
    }
}