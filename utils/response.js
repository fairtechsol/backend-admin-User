module.exports.ErrorResponse = (errorData,req,res) => {
        errorData.statusCode = errorData.statusCode || 500;
        errorData.status = 'error';
        const errorObj = {
            status: errorData.status,
            statusCode : errorData.statusCode,
            message: errorData.message,
            stack: errorData.stack
        }
        console.log(errorObj);
        res.status(errorData.statusCode).json(errorObj);
}

module.exports.SuccessResponse = (resData, req, res) => {
    resData.statusCode = resData.statusCode || 500;
    resData.status = "success";
    resData.meta = resData.meta || 'PROJECT NAME';
    return res.status(resData.statusCode).json({
      status: resData.status,
      statusCode : resData.statusCode,
      message: resData.message,
      data: resData.data,
      meta: resData.meta,
    });
  };