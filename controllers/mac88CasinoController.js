const { mac88Domain, mac88CasinoOperatorId } = require("../config/contants");
const { getUserRedisData } = require("../services/redis/commonfunction");
const { getUserBalanceDataByUserId } = require("../services/userBalanceService");
const { getUserById } = require("../services/userService");
const { apiCall, apiMethod, allApiRoutes } = require("../utils/apiService");
const { generateRSASignature } = require("../utils/generateCasinoSignature");
const { SuccessResponse, ErrorResponse } = require("../utils/response");

exports.loginMac88Casino = async (req, res) => {
    try {
        const { gameId, platformId, providerName } = req.body;

        const user = await getUserById(req.user.id, ["id", "userName", "isDemo"]);
        if (user.isDemo) {
            return ErrorResponse({ statusCode: 403, message: { msg: "user.demoNoAccess" } }, req, res);
        }
        const userRedisData = await getUserRedisData(user.id);

        let casinoData = {
            "operatorId": mac88CasinoOperatorId,
            "providerName": providerName,
            "gameId": gameId,
            "userId": user.id,
            "username": user.userName,
            "platformId": platformId,
            "lobby": false,
            "clientIp": "52.56.207.91",
            "currency": "INR",
            "balance": parseInt(userRedisData?.currentBalance || 0) - parseInt(userRedisData?.exposure || 0),
            "redirectUrl": "https://devmaxbet9api.fairgame.club"
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
        const { userId } = req.body;
        const userRedisData = await getUserRedisData(userId);
        if (!userRedisData) {
            return res.status(400).json({
                "status": "OP_USER_NOT_FOUND"
            })
        }
        let balance = parseInt(userRedisData?.currentBalance || 0) - parseInt(userRedisData?.exposure || 0)


        return res.status(200).json({
            "balance": balance,
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

        return res.status(200).json({
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

        return res.status(200).json({
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

        return res.status(200).json({
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

exports.getMac88GameList = async (req, res) => {
    try {

        let casinoData = {
            "operator_id": mac88CasinoOperatorId
        }
        let result = await apiCall(apiMethod.post, mac88Domain + allApiRoutes.MAC88.gameList, casinoData, { Signature: generateRSASignature(JSON.stringify(casinoData)) });

        result = result?.data?.reduce((prev, curr) => {
            return { ...prev, [curr.provider_name]: { ...(prev[curr.provider_name] || {}), [curr?.category]: [...(prev?.[curr.provider_name]?.[curr.category] || []), curr] } }
        },{});
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