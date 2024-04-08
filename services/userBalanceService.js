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

exports.updateUserBalanceData =async (userId, data) => {
  await UserBalance.query(`update "userBalances" set "currentBalance" = "currentBalance" + $2, "profitLoss" = "profitLoss" + $2, "myProfitLoss" = "myProfitLoss" + $3, "exposure" = "exposure" + $4, "totalCommission" = "totalCommission" + $5 where "userId" = $1`, [userId, (data.profitLoss || 0), (data.myProfitLoss || 0), (data.exposure || 0), (data.totalCommission || 0), (data?.balance || data?.profitLoss || 0)]);
}

exports.updateUserBalanceByUserId = async(userId,body) =>{
    let updateUserBalance = await UserBalance.update({ userId: userId },body);
    return updateUserBalance;
}
exports.updateUserExposure =async (userId, exposure) => {
  await UserBalance.query(`update "userBalances" set "exposure" = "exposure" + $2 where "userId" = $1`, [userId, exposure || 0]);
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


  exports.getAllUsersBalanceSum = async () => {
    queryColumns = 'SUM(userBalance.currentBalance) as balance';
 
    let childUserData = await UserBalance
     .createQueryBuilder('userBalance')
     .select([queryColumns])
     .getRawOne();
  
   return childUserData;
 }