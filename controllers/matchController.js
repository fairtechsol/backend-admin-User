const { apiCall, apiMethod, allApiRoutes } = require("../utils/apiService");
const { SuccessResponse, ErrorResponse } = require("../utils/response");

exports.matchDetails = async (req, res) => {
    try {
        let domain = process.env.EXPERT_DOMAIN_URL;
        let apiResponse = {};

        try {
            apiResponse = await apiCall(apiMethod.get, domain + allApiRoutes.MATCHES.matchDetails + req.params.id);

        } catch (error) {
            throw error?.response?.data;
        }
        return SuccessResponse({ statusCode: 200, message: { msg: "match details", keys: { name: "Match" } }, data: apiResponse.data }, req, res
        );
    } catch (err) {
        return ErrorResponse(err, req, res);
    }
}

exports.listMatch = async (req, res) => {
    try {
        let domain = process.env.EXPERT_DOMAIN_URL;
        let apiResponse = {};
        try {
            apiResponse = await apiCall(apiMethod.get, domain + allApiRoutes.MATCHES.matchList, null, req.query);
        } catch (error) {
            throw error?.response?.data;
        }
        return SuccessResponse({ statusCode: 200, message: { msg: "match details", keys: { name: "Match" } }, data: apiResponse.data }, req, res
        );
    } catch (err) {
        return ErrorResponse(err, req, res);
    }
}