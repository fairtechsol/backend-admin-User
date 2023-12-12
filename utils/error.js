

module.exports = function (err, req, res, next) {

  res.errorMessage = err.errorMessage;
  res.status(500).send({
    statusCode: 500,
    message: 'Failure',
    data: { message: 'Something failed. Please try again after 5 minutes' },
  });
};