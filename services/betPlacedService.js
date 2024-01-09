const { userRoleConstant, betResultStatus } = require("../config/contants");
const { In, IsNull } = require("typeorm");
const { AppDataSource } = require("../config/postGresConnection");
const betPlacedSchema = require("../models/betPlaced.entity");
const ApiFeature = require("../utils/apiFeatures");
const BetPlaced = AppDataSource.getRepository(betPlacedSchema);

// this is the dummy function to test the functionality

exports.getBetById = async (id, select) => {
  return await BetPlaced.findOne({
    where: { id },
    select: select,
  });
}
exports.getBetByUserId = async (id, select) => {
  return await BetPlaced.find({
    where: { createBy: id },
    select: select,
  });
}

// add bet in db 
exports.addNewBet = async (body) => {
  let userBet = await BetPlaced.save(body);
  return userBet;
}

exports.getBet = async (where, query,roleName, select) => {
  let pgQuery = BetPlaced.createQueryBuilder().where(where);
  if (roleName != userRoleConstant.user) {
    pgQuery.leftJoinAndMapOne(
      "betPlaced.user",
      "user",
      "user",
      "betPlaced.createBy = user.id"
    )
  }
  pgQuery.select(select).orderBy("betPlaced.createdAt");
  return await new ApiFeature(
    pgQuery,
    query
  )
    .search()
    .filter()
    .sort()
    .paginate()
    .getResult();
}



exports.getMatchBetPlaceWithUser = async (betId,select) => {
  let betPlaced = await BetPlaced.createQueryBuilder()
  .where({ betId: betId, result: betResultStatus.PENDING, deleteReason: IsNull() })
  .leftJoinAndMapOne("betPlaced.user", "user", 'user', 'betPlaced.createBy = user.id')
  .select(select)
  .getMany()
  return betPlaced;
};


exports.getMultipleAccountProfitLoss = async (betId, userId) => {
  let betPlaced = await BetPlaced.query(`SELECT Sum(CASE result WHEN '${betResultStatus.WIN}' then "winAmount" ELSE 0 END) AS winAmount, Sum(CASE result WHEN '${betResultStatus.LOSS}' then "lossAmount" ELSE 0 END) AS lossAmount from "betPlaceds" where "betId" ='${betId}' AND "userId"='${userId}' AND "deleteReason" IS NULL`)
  return betPlaced;
};
exports.findAllPlacedBet = async (matchId, placeBetIdArray) => {
  return await BetPlaced.find({
    where: {
      matchId: matchId,
      id: In(placeBetIdArray)
    }
  });
}

exports.findAllPlacedBetWithUserIdAndBetId = async (userId, betId) => {
  return await BetPlaced.find({
    where: {
      betId: betId,
      userId: userId
    }
  });
}

exports.updatePlaceBet = async (conditionObj, updateColumsObj) => {
  return await BetPlaced.update(conditionObj, updateColumsObj);
}


exports.getDistinctUserBetPlaced= async (betId)=>{
  let betPlaced = await BetPlaced.createQueryBuilder()
  .where({ betId: betId, deleteReason: IsNull() })
  .leftJoinAndMapOne("betPlaced.user", "user", 'user', 'betPlaced.createBy = user.id')
  .leftJoinAndMapOne("user.userBalance", "userBalance", 'userBalance', 'user.id = userBalance.userId')
  .distinctOn(['user.id'])
  .getMany()
  return betPlaced;
}