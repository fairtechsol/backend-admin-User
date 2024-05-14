const { Not } = require("typeorm");
const { getTransactions } = require("../services/transactionService");
const FileGenerate = require("../utils/generateFile");
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
    const { type, gameName, ...query } = req.query;
    
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

    if (gameName == "upper") {
      filters.actionBy = Not(userId);
    }
    else if (gameName == "down") {
      filters.actionBy = userId;
    }

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
      "transaction.uniqueId",
      "user.id",
      "user.userName",
      "user.phoneNumber",
      "actionByUser.id",
      "actionByUser.userName",
      "actionByUser.phoneNumber",
    ];

    const transaction = await getTransactions(filters, select, query);

    if (type) {
      const header = [
        { excelHeader: "Date", dbKey: "date" },
        { excelHeader: "Credit", dbKey: "credit" },
        { excelHeader: "Debit", dbKey: "debit" },
        { excelHeader: "Closing", dbKey: "closingBalance" },
        { excelHeader: "Description", dbKey: "description" },
        { excelHeader: "Fromto", dbKey: "fromTo" },
      ];

      let data = transaction.transactions?.map((item)=>{
        let date=new Date(item?.createdAt);
        return{
          date: `${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear()}`,
          credit: parseFloat(item?.amount) > 0 ? parseFloat(item.amount).toFixed(2) : 0,
          debit: parseFloat(item?.amount) < 0 ? parseFloat(item.amount).toFixed(2) : 0,
          closingBalance: item?.closingBalance,
          description: item?.description,
          fromTo: item?.actionByUser && item?.user ? item?.user?.userName + " / " + item?.actionByUser?.userName : ""
        }
      })

      const fileGenerate = new FileGenerate(type);
      const file = await fileGenerate.generateReport(data, header);
      const fileName = `accountStatement_${new Date()}`

      return SuccessResponse(
        {
          statusCode: 200,
          message: { msg: "fetched", keys:{ type:"Transactions" }},
          data: { file: file, fileName: fileName },
        },
        req,
        res
      );
    }


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
