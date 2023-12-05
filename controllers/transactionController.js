const { getTransactions } = require("../services/transactionService");
const { ErrorResponse, SuccessResponse } = require("../utils/response");

exports.getAccountStatement = async (req, res) => {
  try {
    const userId = req?.params?.userId;
    const { query } = req;
    if (!userId) {
      return ErrorResponse(
        {
          statusCode: 403,
          message: {
            msg: "userNotSelect",
          },
        },
        req,
        res
      );
    }

    let filters = {
      searchId: userId,
    };

    const select = [
      "transaction.id",
      "transaction.createdAt",
      "transaction.userId",
      "transaction.matchId",
      "transaction.closingBalance",
      "transaction.amount",
      "transaction.transType",
      "transaction.actionBy",
      "transaction.description",
      "user.id",
      "user.userName",
      "user.phoneNumber",
      "actionByUser.id",
      "actionByUser.userName",
      "actionByUser.phoneNumber",
    ];

    const transaction = await getTransactions(filters, select, query);
    SuccessResponse(
      {
        statusCode: 200,
        data: transaction,
      },
      req,
      res
    );
  } catch (error) {
    return ErrorResponse(
      {
        statusCode: 500,
        message: error.message,
      },
      req,
      res
    );
  }
};
