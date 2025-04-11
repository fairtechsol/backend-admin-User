const { logger } = require("../../../../config/logger");
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

exports.updateBalanceAPICallHandler = async (requestData) => {
    try {
    await grpcReq.expert.callMethod(
        "UserService",
        "UpdateBalanceAPICall",
        requestData
      );
    } catch (error) {
      logger.error({
        error: `Error at update balance via gRPC.`,
        stack: error.stack,
        message: error.message,
      });
      throw error;
    }
  };
