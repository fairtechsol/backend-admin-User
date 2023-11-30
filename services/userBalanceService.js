const { AppDataSource } = require("../config/postGresConnection");
const userBalanceSchema = require("../models/userBalance.entity");
const UserBalance = AppDataSource.getRepository(userBalanceSchema);

exports.getUserBalanceDataByUserId = async(userId,select) =>{
    return await UserBalance.findOne({
        where: {userId},
        select: select
      })
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

exports.getAllchildsCurrentBalanceSum = async (childUserIds) => {
     queryColumns = 'SUM(userBalance.currentBalance) as allChildsCurrentBalanceSum';
  
     let childUserData = await UserBalance
      .createQueryBuilder('userBalance')
      .select([queryColumns])
      .where('userBalance.userId IN (:...childUserIds)', { childUserIds })
      .getRawOne();
   
    return childUserData;
  }