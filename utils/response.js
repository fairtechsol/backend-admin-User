const { __mf } = require("i18n");
const { logger } = require("../config/logger");
const { encryptWithAES, encryptAESKeyWithRSA } = require("./encryptDecrypt");
const crypto = require("crypto");
module.exports.ErrorResponse = (errorData, req, res) => {
  try {
    if (!errorData) {
      const aesKey = crypto.randomBytes(32); // Generate AES key
      const encryptedData = encryptWithAES({ message: "Internal server error"}, aesKey);
      const encryptedKey = encryptAESKeyWithRSA(aesKey);
      res.status(500).json({ encryptedData, encryptedKey});
      return
    }
    errorData.statusCode = errorData.statusCode || 500;
    errorData.status = "error";
    const errorMessage = errorData.msg ? errorData : errorData.message || "Internal Server Error";

    // Extracting message code and keys
    const { msg, keys } = errorMessage;

    let i18Code = msg ? msg : errorData?.message?.msg || errorData.message;

    const errorObj = {
      status: errorData?.status,
      statusCode: errorData?.statusCode,
      message: __mf(i18Code, keys || undefined), // Using i18n to get the translated message
      stack: errorData?.stack,
      data: errorData?.data
    };

    logger.error(errorObj);

    const aesKey = crypto.randomBytes(32); // Generate AES key
    const encryptedData = encryptWithAES(errorObj, aesKey);
    const encryptedKey = encryptAESKeyWithRSA(aesKey);

    res.status(errorData.statusCode).json({ encryptedData, encryptedKey });
  } catch (err) {
    logger.error({
      message: "Error at error response.",
      stack: err?.stack,
      context: err?.message,
    });
    const aesKey = crypto.randomBytes(32); // Generate AES key
    const encryptedData = encryptWithAES({ message: "Internal server error"}, aesKey);
    const encryptedKey = encryptAESKeyWithRSA(aesKey);
    res.status(500).json({ encryptedData, encryptedKey});
  }

};

module.exports.SuccessResponse = (resData, req, res) => {
  resData.statusCode = resData.statusCode || 500;
  resData.status = "success";
  resData.meta = resData.meta || "PROJECT NAME";

  const aesKey = crypto.randomBytes(32); // Generate AES key
  const encryptedData = encryptWithAES({
    status: resData?.status,
    statusCode: resData.statusCode,
    message: resData?.message ? __mf(resData?.message?.msg, resData?.message?.keys) : null,
    data: resData?.data,
    meta: resData?.meta,
  }, aesKey);
  const encryptedKey = encryptAESKeyWithRSA(aesKey);

  return res.status(resData.statusCode).json({
    encryptedData, encryptedKey
  });
};
