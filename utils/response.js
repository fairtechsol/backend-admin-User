const { __mf } = require("i18n");

module.exports.ErrorResponse = (errorData, req, res) => {

  errorData.statusCode = errorData.statusCode || 500;
  errorData.status = "error";
  const errorObj = {
    status: errorData.status,
    statusCode: errorData.statusCode,
    message: __mf(errorData.message.msg||errorData.message, errorData.message.key),
    stack: errorData.stack,
  };
  res.status(errorData.statusCode).json(errorObj);
};

module.exports.SuccessResponse = (resData, req, res) => {
  resData.statusCode = resData.statusCode || 500;
  resData.status = "success";
  resData.meta = resData.meta || "PROJECT NAME";
  return res.status(resData.statusCode).json({
    status: resData.status,
    statusCode: resData.statusCode,
    message: __mf(resData.message.msg, resData.message.keys),
    data: resData.data,
    meta: resData.meta,
  });
};