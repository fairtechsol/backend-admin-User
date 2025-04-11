const { logger } = require("../../../../config/logger");
const grpcReq = require("../../index");

  
exports.getPartnershipIdHandler = async (requestData) => {
  try {
    const response = await grpcReq.wallet.callMethod(
      "UserService",
      "GetPartnershipId",
      requestData
    );
    return JSON.parse(response?.data || "[]");
  } catch (error) {
    throw error;
  }
};

exports.lockUnlockUserByUserPanelHandler = async (requestData) => {
  try {
    await grpcReq.wallet.callMethod(
      "UserService",
      "LockUnlockUserByUserPanel",
      requestData
    );
    return {};
  } catch (error) {
    throw error;
  }
};

exports.updateBalanceAPICallHandler = async (requestData) => {
  try {
  await grpcReq.wallet.callMethod(
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
