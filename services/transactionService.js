const { AppDataSource } = require("../config/postGresConnection");
const transactionSchema = require("../models/transaction.entity");
const Transaction = AppDataSource.getRepository(transactionSchema);

// this is the dummy function to test the functionality

exports.getTransactionById = async(id) =>{
    return await Transaction.findOne({id})
}

exports.addTransaction = async(body) =>{
        let insertUser = await Transaction.save(body);
        return insertUser;
}

exports.insertTransactions = async(transactions) =>{
    let insertUser = await Transaction.insert(transactions);
    return insertUser;
}
