const { ErrorResponse } = require("./response");

const catchAsyncErrors = (func) => (req, res, next) =>
  Promise.resolve(func(req, res, next)).catch((error) => {
    console.log("err", error);
    return ErrorResponse({
      statusCode: 500,
      message: {
        msg: "internalServerErr",
      },
    },req,res);
  });
module.exports = catchAsyncErrors;
