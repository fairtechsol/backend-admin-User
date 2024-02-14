const { userRoleConstant, betResultStatus, matchBettingType, partnershipPrefixByRole, marketBetType } = require("../config/contants");
const { In, IsNull, Not } = require("typeorm");
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

// delete bet in db on any error
exports.deleteBetByEntityOnError = async (body) => {
  let userBet = await BetPlaced.remove(body);
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
  pgQuery.leftJoinAndMapOne(
    "betPlaced.match",
    "match",
    "match",
    "betPlaced.matchId = match.id"
  ).select(select).orderBy("betPlaced.createdAt", 'DESC');
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
  .where({ betId: In(betId), result: betResultStatus.PENDING, deleteReason: IsNull() })
  .leftJoinAndMapOne("betPlaced.user", "user", 'user', 'betPlaced.createBy = user.id')
  .leftJoinAndMapOne("betPlaced.userBalance", "userBalance", 'balance', 'betPlaced.createBy = balance.userId')
  .select(select)
  .getMany()
  return betPlaced;
};

exports.getMultipleAccountProfitLoss = async (betId, userId) => {
  let betPlaced = await BetPlaced.query(`SELECT Sum(CASE result WHEN '${betResultStatus.WIN}' then "winAmount" ELSE 0 END) AS winAmount, Sum(CASE result WHEN '${betResultStatus.LOSS}' then "lossAmount" ELSE 0 END) AS lossAmount from "betPlaceds" where "betId" ='${betId}' AND "userId"='${userId}' AND "deleteReason" IS NULL`)
  return betPlaced;
};

exports.getMultipleAccountMatchProfitLoss = async (betId, userId) => {

  const matchTypes = [
    [matchBettingType.bookmaker, matchBettingType.quickbookmaker1, matchBettingType.quickbookmaker2, matchBettingType.quickbookmaker3, matchBettingType.matchOdd],
    [matchBettingType.tiedMatch1, matchBettingType.tiedMatch2],
    [matchBettingType.completeMatch],
  ];

  const betPlaced = await BetPlaced.createQueryBuilder().select([
    'SUM(CASE WHEN result = :winStatus AND "marketType" IN (:...matchTypes1) THEN "winAmount" ELSE 0 END) AS "winAmount"',
    'SUM(CASE WHEN result = :lossStatus AND "marketType" IN (:...matchTypes1) THEN "lossAmount" ELSE 0 END) AS "lossAmount"',
    'SUM(CASE WHEN result = :winStatus AND "marketType" IN (:...matchTypes2) THEN "winAmount" ELSE 0 END) AS "winAmountTied"',
    'SUM(CASE WHEN result = :lossStatus AND "marketType" IN (:...matchTypes2) THEN "lossAmount" ELSE 0 END) AS "lossAmountTied"',
    'SUM(CASE WHEN result = :winStatus AND "marketType" IN (:...matchTypes3) THEN "winAmount" ELSE 0 END) AS "winAmountComplete"',
    'SUM(CASE WHEN result = :lossStatus AND "marketType" IN (:...matchTypes3) THEN "lossAmount" ELSE 0 END) AS "lossAmountComplete"',
    'SUM(CASE WHEN result = :winStatus AND "marketType" IN (:...matchTypes4) THEN "winAmount" ELSE 0 END) AS "winAmountMatchOdd"',
  ])
  .setParameter('winStatus', betResultStatus.WIN)
  .setParameter('lossStatus', betResultStatus.LOSS)
  .setParameter('matchTypes1', matchTypes[0])
  .setParameter('matchTypes2', matchTypes[1])
  .setParameter('matchTypes3', matchTypes[2])
  .setParameter('matchTypes4', [matchBettingType.matchOdd])
  .andWhere('"betId" IN (:...betIds)', { betIds: betId })
  .andWhere('"userId" = :userId', { userId: userId })
  .andWhere('"deleteReason" IS NULL')
  .getRawOne();

  return betPlaced;
};

exports.findAllPlacedBet = async (whereObj) => {
  return await BetPlaced.find({
    where: whereObj
  });
}

exports.findAllPlacedBetWithUserIdAndBetId = async (userId, betId) => {
  return await BetPlaced.find({
    where: {
      betId: betId,
      createBy: userId,
      deleteReason: IsNull()
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

exports.getUserDistinctBets = async (userId) => {
  let betPlaced = await BetPlaced.createQueryBuilder()
    .where({ createBy: userId, result: In(betResultStatus.PENDING), deleteReason: IsNull() })
    .select(["betPlaced.betId", "betPlaced.matchId", "betPlaced.marketBetType","betPlaced.marketType"])
    .distinctOn(['betPlaced.betId'])
    .getMany()
  return betPlaced;
}

exports.getBetsWithUserRole = async (ids) => {
  let betPlaced = await BetPlaced.createQueryBuilder()
    .leftJoinAndMapOne("betPlaced.user", "user", 'user', 'betPlaced.createBy = user.id')
    .where({ createBy: In(ids), result: In(betResultStatus.PENDING), deleteReason: IsNull() })
    .getMany()
  return betPlaced;
}

exports.allChildsProfitLoss = async (where, startDate, endDate) => {
  let profitLoss = await BetPlaced.createQueryBuilder()
    .where(where);
  if (startDate) {
    profitLoss.andWhere(`"createdAt" >= :startDate`, { startDate: startDate });
  }
  if (endDate) {
    profitLoss.andWhere(`"createdAt" <= :endDate`, { endDate: endDate });
  }
  profitLoss = profitLoss.select([
    `"marketType"`,
    `"eventType"`,
    `(SUM(case when result = 'WIN' then "winAmount" else 0 end) - SUM(case when result = 'LOSS' then "lossAmount" else 0 end) ) as "aggregateAmount"`
  ])
    .groupBy([
      `"marketType"`,
      `"eventType"`,
    ])
  let profitLossData = await profitLoss.getRawMany();
  return profitLossData
}

exports.getTotalProfitLoss = async (where, startDate, endDate, totalLoss) => {
  let query = BetPlaced.createQueryBuilder('placeBet')
    .where(where)
    .andWhere({ result: In([betResultStatus.WIN, betResultStatus.LOSS]), deleteReason: IsNull() })

  if (startDate) {
    query = query.andWhere('placeBet.createdAt >= :startDate', { from: new Date(startDate) })
  }
  if (endDate) {
    let newDate = new Date(endDate);
    newDate.setHours(23, 59, 59, 999);
    query = query.andWhere('placeBet.createdAt <= :endDate', { to: newDate })
  }
  query = query
    .select([
      totalLoss,
      'placeBet.eventType as "eventType"',
      'COUNT(placeBet.id) as "totalBet"'
    ])
    .groupBy('placeBet.eventType')
  let result = await query.getRawMany();
  return result
}

exports.getAllMatchTotalProfitLoss = async (where, startDate, endDate, sessionLoss, matchLoss) => {
  let query = BetPlaced.createQueryBuilder('placeBet')
    .leftJoinAndMapOne("placeBet.match", "match", 'match', 'placeBet.matchId = match.id')
    .where(where)
    .andWhere({ result: In([betResultStatus.WIN, betResultStatus.LOSS]), deleteReason: IsNull() })

  if (startDate) {
    query = query.andWhere('placeBet.createdAt >= :startDate', { from: new Date(startDate) })
  }
  if (endDate) {
    let newDate = new Date(endDate);
    newDate.setHours(23, 59, 59, 999);
    query = query.andWhere('placeBet.createdAt <= :endDate', { to: newDate })
  }
  query = query
    .select([
      sessionLoss,
      matchLoss,
      'placeBet.eventType as "eventType"',
      'COUNT(placeBet.id) as "totalBet"',
      'match.startAt as "startAt"',
      'match.title as title',
      'match.id as "matchId"'
    ])
    .groupBy('placeBet.matchId, match.id, placeBet.eventType').orderBy('match.startAt', 'DESC');

 
  let result = await query.getRawMany();

  return { result };
}

exports.getBetsProfitLoss = async (where, totalLoss) => {
  let query = BetPlaced.createQueryBuilder('placeBet')
    .leftJoinAndMapOne("placeBet.user", 'user', 'user', 'placeBet.createBy = user.id')
    .leftJoinAndMapOne("placeBet.match", "match", 'match', 'placeBet.matchId = match.id')
    .where(where)
    .andWhere({ result: Not(betResultStatus.PENDING) })


  query = query
    .select([
      totalLoss,
      'placeBet.id as "id"',
      'placeBet.createBy as "userId"',
      'placeBet.matchId as "matchId"',
      'placeBet.result  as "result"',
      'placeBet.teamName  as "teamName"',
      'placeBet.betType  as "betType"',
      'placeBet.marketType  as "marketType"',
      'placeBet.marketBetType  as "marketBetType"',
      'placeBet.rate  as "rate"',
      'placeBet.amount as "amount"',
      'placeBet.odds as "odds"',
      'placeBet.createdAt as "createdAt"',
      'user.userName as userName',
      'placeBet.deleteReason as "deleteReason"'
    ])
    .groupBy('placeBet.id, user.userName').orderBy('placeBet.createdAt', 'DESC');

    let result = await query.getRawMany();

    return result;
}

exports.getSessionsProfitLoss = async (where, totalLoss) => {
  let query = BetPlaced.createQueryBuilder('placeBet')
    .where(where)
    .andWhere({ result: In([betResultStatus.WIN, betResultStatus.LOSS]), deleteReason: IsNull() })

  query = query
    .select([
      totalLoss,
      'placeBet.betId as "betId"',
      'placeBet.eventName  as "eventName"'
    ])
    .groupBy('placeBet.betId, placeBet.eventName');

    let result = await query.getRawMany();
    return result;
}

exports.getPlacedBetsWithCategory = async (userId) => {
  const query = BetPlaced.createQueryBuilder()
    .select([
      'COUNT(*) AS "trade"',
      'betPlaced.eventType AS "eventType"',
      'betPlaced.eventName AS "eventName"',
      'betPlaced.matchId AS "matchId"',
      "CASE WHEN betPlaced.marketType IN ('tiedMatch1','tiedMatch2') THEN :tiedmatch ELSE :other END AS groupedMarketType",
    ])
    .setParameter('tiedmatch', 'Match Odds')
    .setParameter('other', 'Tied Match')
    .where({ createBy: userId, result: betResultStatus.PENDING, deleteReason: IsNull() })
    .groupBy('groupedMarketType, betPlaced.matchId, betPlaced.eventName, betPlaced.eventType');

const data = await query.getRawMany();

  return data;
}

exports.getPlacedBetTotalLossAmount = (where) => {
  return BetPlaced.createQueryBuilder('placeBet')
  .select([
    'SUM(placeBet.lossAmount) as totalLossAmount',
    `placeBet.eventName || ' / fancy' as eventName`,
  ])
  .where(where)
  .groupBy('placeBet.betId')
  .addGroupBy('placeBet.eventName')
  .getRawMany();
}

exports.getBetsWithMatchId=(where)=>{

  return BetPlaced.createQueryBuilder()
  .leftJoinAndMapOne("betPlaced.user", "user", 'user', 'betPlaced.createBy = user.id'+where??"")
  .where({ deleteReason: IsNull(), result: In([betResultStatus.PENDING, betResultStatus.UNDECLARE]), user: Not(IsNull()) })
  .groupBy("betPlaced.matchId")
  .select(['betPlaced.matchId as "matchId"', "COUNT(betPlaced.matchId) as count"])
  .getRawMany();
}