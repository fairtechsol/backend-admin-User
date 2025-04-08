const grpcReq = require("../../index");

exports.getCardResultHandler = async (requestData) => {
  try {
    const response = await grpcReq.wallet.callMethod(
      "MatchProvider",
      "GetCardResult",
      requestData
    );
    return JSON.parse(response?.data || "[]");
  } catch (error) {
    throw error;
  }
};

exports.getCardResultDetailHandler = async (requestData) => {
  try {
    const response = await grpcReq.wallet.callMethod(
      "MatchProvider",
      "GetCardResultDetail",
      requestData
    );
    return {data:JSON.parse(response?.data || "{}")};
  } catch (error) {
    throw error;
  }
};

exports.declareVirtualCasinoResultHandler = async (requestData) => {
  try {
    await grpcReq.wallet.callMethod(
      "MatchProvider",
      "DeclareVirtualCasinoResult",
      requestData
    );
  } catch (error) {
    throw error;
  }
};
