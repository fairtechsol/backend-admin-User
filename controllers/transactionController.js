const { getTransactions } = require("../services/transactionService");
const { ErrorResponse, SuccessResponse } = require("../utils/response");

exports.getAccountStatement = async (req, res) => {
  try {
    const userId = req?.params?.userId;

    /** query format
     * @keyword : key for searching,
     * @searchBy : name of fields on which searching would be apply separated by , like first_name,last_name
     * @sort : name of the fields on which sorting is apply like createdBy:ASC,name:DESC->ASC for ascending and DESC for descending 
     * @page : number of page you are on for pagination
     * @limit : number of row you want on single page
     * @filters : for filters you need to give the filters like the key value pair like ->
     * if you want query like username=="client" then give the filter like username : eqclient
     *   **/
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
