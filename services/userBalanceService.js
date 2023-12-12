const { AppDataSource } = require("../config/postGresConnection");
const userBalanceSchema = require("../models/userBalance.entity");
const { In } = require('typeorm');
const UserBalance = AppDataSource.getRepository(userBalanceSchema);


exports.getUserBalanceDataByUserId = async(userId,select) =>{
    return await UserBalance.findOne({
        where: {userId},
        select: select
      })
}

//get usersbalance data from array of userids
exports.getUserBalanceDataByUserIds = async(userIds,select) =>{
    return await UserBalance.find({
        where: {userId: In(userIds)},
        select: select
      })
}

exports.addInitialUserBalance = async (body) => {
    let insertUserBalance = await UserBalance.save(body);
    return insertUserBalance;
}

exports.updateUserBalanceByUserId = async(userId,body) =>{
    let updateUserBalance = await UserBalance.update({ userId: userId },body);
    return updateUserBalance;
}

exports.getAllChildProfitLossSum = async(childUserIds)=>{
    let queryColumns = 'SUM(userBalance.profitLoss) as firstLevelChildsProfitLossSum';
  
    let childUserData = await UserBalance
      .createQueryBuilder('userBalance')
      .select([queryColumns])
      .where('userBalance.userId IN (:...childUserIds)', { childUserIds })
      .getRawOne();
    
    return childUserData;
    
}

exports.getAllChildCurrentBalanceSum = async (childUserIds) => {
     queryColumns = 'SUM(userBalance.currentBalance) as allChildsCurrentBalanceSum';
  
     let childUserData = await UserBalance
      .createQueryBuilder('userBalance')
      .select([queryColumns])
      .where('userBalance.userId IN (:...childUserIds)', { childUserIds })
      .getRawOne();
   
    return childUserData;
  }