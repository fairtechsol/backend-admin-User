const { apiCall, apiMethod, allApiRoutes } = require("../utils/apiService");
const { ErrorResponse, SuccessResponse } = require("../utils/response");

let expertDomain = process.env.EXPERT_DOMAIN_URL || 'http://localhost:6060'

exports.getNotification = async (req, res) => {
    try {
        let response = await apiCall(
            apiMethod.get,
            expertDomain + allApiRoutes.notification
        );
        return SuccessResponse(
            {
              statusCode: 200,
              data: response.data
            },
            req,
            res
          );
    } catch (err) { 
        return ErrorResponse(err?.response?.data, req, res);
    }
};