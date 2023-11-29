const { AppDataSource } = require("../config/postGresConnection");
const transactionSchema = require("../models/transaction.entity");
const Transaction = AppDataSource.getRepository(transactionSchema);

// this is the dummy function to test the functionality

exports.getTransactionById = async (id) => {
  return await Transaction.findOne({ id });
};

exports.addTransaction = async (body) => {
  let insertUser = await Transaction.save(body);
  return insertUser;
};

exports.insertTransactions = async (transactions) => {
  let insertUser = await Transaction.insert(transactions);
  return insertUser;
};

/**
 * Retrieves transactions based on specified filters and options.
 * @param {Object} filters - Query filters for WHERE clause.
 * @param {string[]} select - Selected columns for the result.
 * @param {string} searchBy - Column to search by.
 * @param {string} keyword - Keyword for the search.
 * @param {string} orderBy - Column to order by.
 * @param {string} order - Sorting order ('ASC' or 'DESC').
 * @param {number} skip - Number of records to skip.
 * @param {number} limit - Maximum number of records to retrieve.
 * @returns {Promise<{transactions: Transaction[], count: number}>} - Resulting transactions and count.
 */
exports.getTransactions = async (
  filters,
  select,
  searchBy,
  keyword,
  orderBy,
  order,
  skip,
  limit
) => {
  try {
    // Start building the query
    let transactionQuery = Transaction.createQueryBuilder()
      .where(filters)
      .leftJoinAndMapOne(
        "transaction.user",
        "user",
        "user",
        "transaction.userId = user.id"
      )
      .leftJoinAndMapOne(
        "transaction.actionByUser",
        "user",
        "actionByUser",
        "transaction.actionBy = actionByUser.id"
      )
      .andWhere(`${searchBy} like '%${keyword||""}%'`)
      .select(select)
      .orderBy(orderBy, order);

    // Apply optional skip and limit
    if (skip) {
      transactionQuery = transactionQuery.offset(skip);
    }
    if (limit) {
      transactionQuery = transactionQuery.limit(limit);
    }

    // Execute the query and get the result along with count
    const [transactions, count] = await transactionQuery.getManyAndCount();

    return { transactions, count };
  } catch (error) {
    throw error;
  }
};
