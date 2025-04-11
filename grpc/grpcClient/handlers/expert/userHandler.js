const grpcReq = require("../../index");

exports.getNotificationHandler = async (requestData) => {
    try {
        const response = await grpcReq.expert.callMethod(
            "UserService",
            "GetNotification",
            requestData
        );
        return JSON.parse(response?.data || "{}");
    } catch (error) {
        throw error;
    }
};
