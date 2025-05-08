const { userRoleConstant, betResultStatus, matchBettingType, marketBetType } = require("../config/contants");
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

exports.getBetCountData = async (where) => {
  return await BetPlaced.count({
    where: where
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

exports.getBet = async (where, query, roleName, select, superParentId, isTeamNameAllow = true, isCurrentBets) => {
  let pgQuery = BetPlaced.createQueryBuilder('betPlaced').where(where);
  if (roleName == userRoleConstant.fairGameAdmin) {
    pgQuery.innerJoinAndMapOne(
      "betPlaced.user",
      "user",
      "user",
      `betPlaced.createBy = user.id AND user.superParentId = '${superParentId}'`
    )
  }
  else {
    pgQuery.leftJoinAndMapOne(
      "betPlaced.user",
      "user",
      "user",
      "betPlaced.createBy = user.id"
    )
  }

  if (isCurrentBets) {
    pgQuery.leftJoinAndMapOne(
      "betPlaced.racingMatch",
      "racingMatch",
      "racingMatch",
      "betPlaced.matchId = racingMatch.id"
    )
  }

  pgQuery.leftJoinAndMapOne(
    "betPlaced.match",
    "match",
    "match",
    "betPlaced.matchId = match.id"
  ).select(select).orderBy("betPlaced.createdAt", 'DESC')

  // if (isTeamNameAllow) {
  //   pgQuery.addSelect(`CASE
  //   WHEN "betPlaced"."marketType" IN (:...bettingType) THEN "betPlaced"."teamName"  || ' ' || REGEXP_REPLACE("betPlaced"."marketType", '[^0-9.]+', '', 'g')
  //   ELSE "betPlaced"."teamName"
  // END`, `${pgQuery.alias}_teamName`)
  //     .setParameter("bettingType", [...(Array.from({ length: 20 }, (_, index) => index).map((_, index) => `overUnder${index}.5`)), ...(Array.from({ length: 20 }, (_, index) => index).map((_, index) => `firstHalfGoal${index}.5`))]);
  // }

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


exports.getAccountStatBet = async (where, query, select) => {
  let pgQuery = BetPlaced.createQueryBuilder('betPlaced').where(where).leftJoinAndMapOne(
    "betPlaced.user",
    "user",
    "user",
    "betPlaced.createBy = user.id"
  )
    .leftJoinAndMapOne(
      "user.createBy",
      "user",
      "createBy",
      "user.createBy = createBy.id"
    )
    .leftJoinAndMapOne(
      "betPlaced.racingMatch",
      "racingMatch",
      "racingMatch",
      "betPlaced.matchId = racingMatch.id"
    ).leftJoinAndMapOne(
      "betPlaced.match",
      "match",
      "match",
      "betPlaced.matchId = match.id"
    ).addSelect(`CASE
              WHEN "betPlaced"."marketType" IN (:...bettingType) THEN "betPlaced"."teamName"  || ' ' || REGEXP_REPLACE("betPlaced"."marketType", '[^0-9.]+', '', 'g')
              ELSE "betPlaced"."teamName"
              END`, `betPlaced_teamName`)
    .setParameter("bettingType", [...(Array.from({ length: 20 }, (_, index) => index).map((_, index) => `overUnder${index}.5`)), ...(Array.from({ length: 20 }, (_, index) => index).map((_, index) => `firstHalfGoal${index}.5`))])
    .select(select).orderBy("betPlaced.createdAt", 'DESC');
  const [data, count] = await new ApiFeature(
    pgQuery,
    query
  )
    .search()
    .filter()
    .sort()
    .paginate()
    .getResult();

  const totalAmountData = await new ApiFeature(
    BetPlaced.createQueryBuilder('betPlaced').where(where).select([`SUM(CASE WHEN result = :winStatus THEN "winAmount" ELSE 0 END) - SUM(CASE WHEN result = :lossStatus THEN "lossAmount" ELSE 0 END) AS "amount"`, "COUNT(*) as soda", 'COUNT(DISTINCT "userId") as "totalCount"'])
      .setParameter('winStatus', betResultStatus.WIN)
      .setParameter('lossStatus', betResultStatus.LOSS)
    ,
    query
  )
    .filter().query.getRawOne();


  return { count, data, totalAmountData };
}

exports.getMatchBetPlaceWithUser = async (betId, select) => {
  let betPlaced = await BetPlaced.createQueryBuilder()
    .where({ betId: In(betId), result: betResultStatus.PENDING, deleteReason: IsNull() })
    .leftJoinAndMapOne("betPlaced.user", "user", 'user', 'betPlaced.createBy = user.id')
    .leftJoinAndMapOne("betPlaced.userBalance", "userBalance", 'balance', 'betPlaced.createBy = balance.userId')
    .select(select)
    .getMany()
  return betPlaced;
};

exports.getMatchBetPlaceWithUserCard = async (where, select) => {
  let betPlaced = await BetPlaced.createQueryBuilder()
    .where({ ...where, deleteReason: IsNull() })
    .leftJoinAndMapOne("betPlaced.user", "user", 'user', 'betPlaced.createBy = user.id')
    .leftJoinAndMapOne("betPlaced.userBalance", "userBalance", 'balance', 'betPlaced.createBy = balance.userId')
    .select(select)
    .getMany()
  return betPlaced;
};

exports.getMultipleAccountProfitLoss = async (betId, userId) => {
  let betPlaced = await BetPlaced.query(`SELECT Sum(CASE result WHEN '${betResultStatus.WIN}' then "winAmount" ELSE 0 END) AS winAmount, Sum(CASE result WHEN '${betResultStatus.LOSS}' then "lossAmount" ELSE 0 END) AS lossAmount, Sum(amount) AS "totalStack" from "betPlaceds" where "betId" ='${betId}' AND "userId"='${userId}' AND "deleteReason" IS NULL`)
  return betPlaced;
};

exports.getMultipleAccountMatchProfitLoss = async (betId, userId) => {

  const matchTypes = [
    [matchBettingType.bookmaker, matchBettingType.bookmaker2, matchBettingType.quickbookmaker1, matchBettingType.quickbookmaker2, matchBettingType.quickbookmaker3, matchBettingType.matchOdd],
    [matchBettingType.tiedMatch1, matchBettingType.tiedMatch2, matchBettingType.tiedMatch3],
    [matchBettingType.completeMatch, matchBettingType.completeManual, matchBettingType.completeMatch1],
  ];

  const betPlaced = await BetPlaced.createQueryBuilder().select([
    'SUM(CASE WHEN result = :winStatus AND "marketType" IN (:...matchTypes1) THEN "winAmount" ELSE 0 END) AS "winAmount"',
    'SUM(CASE WHEN result = :lossStatus AND "marketType" IN (:...matchTypes1) THEN "lossAmount" ELSE 0 END) AS "lossAmount"',
    'SUM(CASE WHEN result = :winStatus AND "marketType" IN (:...matchTypes1) AND "isCommissionActive"= true THEN "winAmount" ELSE 0 END) AS "winAmountCommission"',
    'SUM(CASE WHEN result = :lossStatus AND "marketType" IN (:...matchTypes1) AND "isCommissionActive"= true THEN "lossAmount" ELSE 0 END) AS "lossAmountCommission"',
    'SUM(CASE WHEN result = :winStatus AND "marketType" IN (:...matchTypes2) THEN "winAmount" ELSE 0 END) AS "winAmountTied"',
    'SUM(CASE WHEN result = :lossStatus AND "marketType" IN (:...matchTypes2) THEN "lossAmount" ELSE 0 END) AS "lossAmountTied"',
    'SUM(CASE WHEN result = :winStatus AND "marketType" IN (:...matchTypes2) AND "isCommissionActive"= true THEN "winAmount" ELSE 0 END) AS "winAmountTiedCommission"',
    'SUM(CASE WHEN result = :lossStatus AND "marketType" IN (:...matchTypes2) AND "isCommissionActive"= true THEN "lossAmount" ELSE 0 END) AS "lossAmountTiedCommission"',
    'SUM(CASE WHEN result = :winStatus AND "marketType" IN (:...matchTypes3) THEN "winAmount" ELSE 0 END) AS "winAmountComplete"',
    'SUM(CASE WHEN result = :lossStatus AND "marketType" IN (:...matchTypes3) THEN "lossAmount" ELSE 0 END) AS "lossAmountComplete"',
    'SUM(CASE WHEN result = :winStatus AND "marketType" IN (:...matchTypes3) AND "isCommissionActive"= true THEN "winAmount" ELSE 0 END) AS "winAmountCompleteCommission"',
    'SUM(CASE WHEN result = :lossStatus AND "marketType" IN (:...matchTypes3) AND "isCommissionActive"= true THEN "lossAmount" ELSE 0 END) AS "lossAmountCompleteCommission"',
    'SUM(CASE WHEN result = :winStatus AND "marketType" IN (:...matchTypes4) THEN "winAmount" ELSE 0 END) AS "winAmountMatchOdd"',
    'SUM(CASE WHEN "marketType" IN (:...matchTypes1) THEN 1 ELSE 0 END) AS "matchOddBetsCount"',
    'SUM(CASE WHEN "marketType" IN (:...matchTypes2) THEN 1 ELSE 0 END) AS "tiedBetsCount"',
    'SUM(CASE WHEN "marketType" IN (:...matchTypes3) THEN 1 ELSE 0 END) AS "completeBetsCount"',
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

exports.getMultipleAccountOtherMatchProfitLoss = async (betId, userId) => {

  const betPlaced = await BetPlaced.createQueryBuilder().select([
    'SUM(CASE WHEN result = :winStatus THEN "winAmount" ELSE 0 END) AS "winAmount"',
    'SUM(CASE WHEN result = :lossStatus THEN "lossAmount" ELSE 0 END) AS "lossAmount"',
    'SUM(CASE WHEN result = :winStatus AND "marketType" IN (:...matchOdd) THEN "winAmount" ELSE 0 END) AS "winAmountMatchOdd"',
    'SUM(CASE WHEN result = :lossStatus AND "marketType" IN (:...matchOdd) THEN "lossAmount" ELSE 0 END) AS "lossAmountMatchOdd"',
    'SUM(CASE WHEN result = :lossStatus AND "isCommissionActive"= true THEN "lossAmount" ELSE 0 END) AS "lossAmountCommission"',
    'SUM(CASE WHEN result = :winStatus AND "isCommissionActive"= true THEN "winAmount" ELSE 0 END) AS "winAmountCommission"',

  ])
    .setParameter('winStatus', betResultStatus.WIN)
    .setParameter('lossStatus', betResultStatus.LOSS)
    .setParameter('matchOdd', [matchBettingType.matchOdd])
    .andWhere('"betId" IN (:...betIds)', { betIds: betId })
    .andWhere('"userId" = :userId', { userId: userId })
    .andWhere('"deleteReason" IS NULL')
    .getRawOne();

  return betPlaced;
};

exports.getMultipleAccountCardMatchProfitLoss = async (runnerId, userId) => {

  const betPlaced = await BetPlaced.createQueryBuilder().select([
    'SUM(CASE WHEN result = :winStatus THEN "winAmount" ELSE 0 END) AS "winAmount"',
    'SUM(CASE WHEN result = :lossStatus THEN "lossAmount" ELSE 0 END) AS "lossAmount"',
  ])
    .setParameter('winStatus', betResultStatus.WIN)
    .setParameter('lossStatus', betResultStatus.LOSS)
    .andWhere('"runnerId" = :runnerId', { runnerId: runnerId })
    .andWhere('"userId" = :userId', { userId: userId })
    .andWhere('"deleteReason" IS NULL')
    .getRawOne();

  return betPlaced;
};

exports.findAllPlacedBet = async (whereObj, select) => {
  return await BetPlaced.find({
    where: whereObj,
    select: select
  });
}

exports.findAllPlacedBetWithUserIdAndBetId = async (userId, betId, where) => {
  return await BetPlaced.find({
    where: {
      betId: betId,
      createBy: userId,
      deleteReason: IsNull(),
      ...(where || {})
    }
  });
}

exports.updatePlaceBet = async (conditionObj, updateColumsObj) => {
  return await BetPlaced.update(conditionObj, updateColumsObj);
}

exports.getDistinctUserBetPlaced = async (betId) => {
  let betPlaced = await BetPlaced.createQueryBuilder()
    .where({ betId: betId, deleteReason: IsNull() })
    .innerJoinAndMapOne("betPlaced.user", "user", 'user', 'betPlaced.createBy = user.id')
    .leftJoinAndMapOne("user.userBalance", "userBalance", 'userBalance', 'user.id = userBalance.userId')
    .distinctOn(['user.id'])
    .getMany()
  return betPlaced;
}

exports.getUserDistinctBets = async (userId, where) => {
  let betPlaced = await BetPlaced.createQueryBuilder()
    .where({ createBy: userId, result: In([betResultStatus.PENDING]), deleteReason: IsNull(), ...(where || {}) })
    .select(["betPlaced.betId", "betPlaced.matchId", "betPlaced.marketBetType", "betPlaced.marketType", "betPlaced.eventType"])
    .distinctOn(['betPlaced.betId'])
    .getMany()
  return betPlaced;
}

exports.getBetsWithUserRole = async (ids, where) => {
  let betPlaced = await BetPlaced.createQueryBuilder()
    .leftJoinAndMapOne("betPlaced.user", "user", 'user', 'betPlaced.createBy = user.id')
    .where({ createBy: In(ids), result: betResultStatus.PENDING, deleteReason: IsNull(), ...(where || {}) })
    .getMany()
  return betPlaced;
}

exports.allChildsProfitLoss = async (where, startDate, endDate, page, limit, keyword, select) => {
  let profitLoss = BetPlaced.createQueryBuilder()
    .innerJoinAndMapOne("betPlaced.user", 'user', 'user', `betPlaced.createBy = user.id`)
    .where(where);
  if (startDate) {
    profitLoss.andWhere(`"betPlaced"."createdAt" >= :startDate`, { startDate: startDate });
  }
  if (endDate) {
    profitLoss.andWhere(`"betPlaced"."createdAt" <= :endDate`, { endDate: endDate });
  }
  if (keyword) {
    profitLoss.andWhere(`betPlaced.eventType ILIKE :search`, { search: `%${keyword}%` });
  }
  const count = await profitLoss.select("COUNT(DISTINCT(betPlaced.marketType, betPlaced.eventType))", "count").getRawOne();
  profitLoss = profitLoss.select([
    `"marketType"`,
    `"eventType"`,
    ...select
  ])
    .groupBy([
      `"marketType"`,
      `"eventType"`,
    ]).orderBy('betPlaced.eventType', 'ASC');

  if (page) {
    profitLoss = profitLoss.offset((parseInt(page) - 1) * parseInt(limit || 10)).limit(parseInt(limit || 10));
  }
  let profitLossData = await profitLoss.getRawMany();
  return { profitLossData, count }
}

exports.getTotalProfitLoss = async (where, startDate, endDate, totalLoss, subQuery) => {
  let query = BetPlaced.createQueryBuilder('placeBet')
    .innerJoinAndMapOne("placeBet.user", 'user', 'user', `placeBet.createBy = user.id and placeBet.createBy in (${subQuery})`)
    .innerJoinAndMapOne("placeBet.match", "match", 'match', 'placeBet.matchId = match.id')
    .where(where)
    .andWhere({
      result: In([betResultStatus.WIN, betResultStatus.LOSS]),
      deleteReason: IsNull(),
    });
  if (startDate) {
    query = query.andWhere('match.startAt >= :from', { from: new Date(startDate) })
  }
  if (endDate) {
    let newDate = new Date(endDate);
    newDate.setHours(23, 59, 59, 999);
    query = query.andWhere('match.startAt <= :to', { to: newDate })
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

exports.getTotalProfitLossRacing = async (where, startDate, endDate, totalLoss, subQuery) => {
  let query = BetPlaced.createQueryBuilder('placeBet')
    .innerJoinAndMapOne("placeBet.user", 'user', 'user', `placeBet.createBy = user.id and placeBet.createBy in (${subQuery})`)
    .innerJoinAndMapOne("placeBet.match", "racingMatch", 'match', 'placeBet.matchId = match.id')
    .where(where)
    .andWhere({
      result: In([betResultStatus.WIN, betResultStatus.LOSS]),
      deleteReason: IsNull(),
    });
  if (startDate) {
    query = query.andWhere('match.startAt >= :from', { from: new Date(startDate) })
  }
  if (endDate) {
    let newDate = new Date(endDate);
    newDate.setHours(23, 59, 59, 999);
    query = query.andWhere('match.startAt <= :to', { to: newDate })
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

exports.getTotalProfitLossCard = async (where, startDate, endDate, totalLoss, subQuery) => {
  let query = BetPlaced.createQueryBuilder('placeBet')
    .innerJoinAndMapOne("placeBet.user", 'user', 'user', `placeBet.createBy = user.id and placeBet.createBy in (${subQuery})`)
    .innerJoinAndMapOne("placeBet.match", "cardMatch", 'match', 'placeBet.matchId = match.id')
    .where(where)
    .andWhere({
      result: In([betResultStatus.WIN, betResultStatus.LOSS]),
      deleteReason: IsNull(),
      marketBetType: marketBetType.CARD
    });
  if (startDate) {
    query = query.andWhere('placeBet.createdAt >= :from', { from: new Date(startDate) })
  }
  if (endDate) {
    let newDate = new Date(endDate);
    newDate.setHours(23, 59, 59, 999);
    query = query.andWhere('placeBet.createdAt <= :to', { to: newDate })
  }
  query = query
    .select([
      totalLoss,
      'match.id as "matchId"',
      'match.name as "name"',
      'match.type as "type"',
      'COUNT(placeBet.id) as "totalBet"'
    ])
    .groupBy('match.id').addGroupBy("match.name").addGroupBy("match.type")
  let result = await query.getRawMany();
  return result;
}

exports.getAllMatchTotalProfitLoss = async (where, startDate, endDate, selectArray, page, limit, subQuery) => {
  let query = BetPlaced.createQueryBuilder('placeBet')
    .leftJoinAndMapOne("placeBet.match", "match", 'match', 'placeBet.matchId = match.id')
    .innerJoinAndMapOne("placeBet.user", 'user', 'user', `placeBet.createBy = user.id and placeBet.createBy in (${subQuery})`)
    .where(where)
    .andWhere({ result: In([betResultStatus.WIN, betResultStatus.LOSS]), deleteReason: IsNull() })

  if (startDate) {
    query = query.andWhere('match.startAt >= :from', { from: new Date(startDate) })
  }
  if (endDate) {
    let newDate = new Date(endDate);
    newDate.setHours(23, 59, 59, 999);
    query = query.andWhere('match.startAt <= :to', { to: newDate })
  }

  const count = (await query.select(["match.id"]).groupBy("match.id").getRawMany())?.length;

  query = query
    .select([
      ...selectArray,
      'placeBet.eventType as "eventType"',
      'COUNT(placeBet.id) as "totalBet"',
      'match.startAt as "startAt"',
      'match.title as title',
      'match.id as "matchId"'
    ])
    .groupBy('placeBet.matchId, match.id, placeBet.eventType').orderBy('match.startAt', 'DESC');

  if (page) {
    query.offset((parseInt(page) - 1) * parseInt(limit || 10)).limit(parseInt(limit || 10));
  }

  let result = await query.getRawMany();

  return { result, count };
}

exports.getAllRacinMatchTotalProfitLoss = async (where, startDate, endDate, selectArray, page, limit, subQuery) => {
  let query = BetPlaced.createQueryBuilder('placeBet')
    .leftJoinAndMapOne("placeBet.match", "racingMatch", 'match', 'placeBet.matchId = match.id')
    .innerJoinAndMapOne("placeBet.user", 'user', 'user', `placeBet.createBy = user.id and placeBet.createBy in (${subQuery})`)
    .where(where)
    .andWhere({ result: In([betResultStatus.WIN, betResultStatus.LOSS]), deleteReason: IsNull() })

  if (startDate) {
    query = query.andWhere('match.startAt >= :from', { from: new Date(startDate) })
  }
  if (endDate) {
    let newDate = new Date(endDate);
    newDate.setHours(23, 59, 59, 999);
    query = query.andWhere('match.startAt <= :to', { to: newDate })
  }

  const count = (await query.select(["match.id"]).groupBy("match.id").getRawMany())?.length;

  query = query
    .select([
      ...selectArray,
      'placeBet.eventType as "eventType"',
      'COUNT(placeBet.id) as "totalBet"',
      'match.startAt as "startAt"',
      'match.title as title',
      'match.id as "matchId"'
    ])
    .groupBy('placeBet.matchId, match.id, placeBet.eventType').orderBy('match.startAt', 'DESC');

  if (page) {
    query.offset((parseInt(page) - 1) * parseInt(limit || 10)).limit(parseInt(limit || 10));
  }

  let result = await query.getRawMany();

  return { result, count };
}

exports.getAllCardMatchTotalProfitLoss = async (where, startDate, endDate, selectArray, subQuery) => {
  let query = BetPlaced.createQueryBuilder('placeBet')
    .innerJoinAndMapOne("placeBet.match", "cardMatch", 'match', 'placeBet.matchId = match.id')
    .innerJoinAndMapOne("placeBet.user", 'user', 'user', `placeBet.createBy = user.id and placeBet.createBy in (${subQuery})`)
    .where(where)
    .andWhere({
      result: In([betResultStatus.WIN, betResultStatus.LOSS]), deleteReason: IsNull(),
      marketBetType: marketBetType.CARD
    });

  if (startDate) {
    query = query.andWhere('placeBet.createdAt >= :from', { from: new Date(startDate) })
  }
  if (endDate) {
    let newDate = new Date(endDate);
    newDate.setHours(23, 59, 59, 999);
    query = query.andWhere('placeBet.createdAt <= :to', { to: newDate })
  }

  query = query
    .select([
      ...selectArray,
      'COUNT(placeBet.id) as "totalBet"',
      'placeBet.runnerId as "runnerId"',
      "match.type as type"
    ])
    .groupBy('placeBet.runnerId, match.type').orderBy('MAX(placeBet.createdAt)', 'DESC');

  let result = await query.getRawMany();

  return { result };
}

exports.getBetsProfitLoss = async (where, totalLoss, subQuery, domain) => {
  let query = BetPlaced.createQueryBuilder('placeBet')
    .innerJoinAndMapOne("placeBet.user", 'user', 'user', `placeBet.createBy = user.id and placeBet.createBy in (${subQuery})`)
    // .leftJoinAndMapOne("placeBet.match", "match", 'match', 'placeBet.matchId = match.id')
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
      'placeBet.deleteReason as "deleteReason"',
      'placeBet.bettingName  as "bettingName"',
      'placeBet.isCommissionActive  as "isCommissionActive"',
    ])
    .addSelect(`'${domain}'`, `domain`)
    .groupBy('placeBet.id, user.userName').orderBy('placeBet.createdAt', 'DESC');
  let result = await query.getRawMany();

  return result;
}

exports.getSessionsProfitLoss = async (where, totalLoss, subQuery) => {
  let query = BetPlaced.createQueryBuilder('placeBet')
    .innerJoinAndMapOne("placeBet.user", 'user', 'user', `placeBet.createBy = user.id and placeBet.createBy in (${subQuery})`)
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

exports.getUserWiseProfitLoss = async (where, select) => {
  let query = BetPlaced.createQueryBuilder('placeBet')
    .leftJoinAndMapOne("placeBet.user", 'user', 'user', 'placeBet.createBy = user.id')
    .where(where)
    .andWhere({ result: In([betResultStatus.WIN, betResultStatus.LOSS]), deleteReason: IsNull() })

  query = query
    .select(select);

  let result = await query.getRawOne();
  return result;
}

exports.getUserSessionsProfitLoss = async (where, select) => {
  let query = BetPlaced.createQueryBuilder('placeBet')
    .leftJoinAndMapOne("placeBet.user", 'user', 'user', 'placeBet.createBy = user.id')
    .where(where)
    .andWhere({ result: In([betResultStatus.WIN, betResultStatus.LOSS]), deleteReason: IsNull() })
    .groupBy("user.id")
    .addGroupBy("user.userName")
  query = query
    .select(select);

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
      'betPlaced.marketType AS "marketType"',
      "betPlaced.bettingName AS groupedMarketType",
    ])
    .where({
      createBy: userId, result: betResultStatus.PENDING, deleteReason: IsNull(), marketBetType
        : marketBetType.MATCHBETTING
    })
    .groupBy('betPlaced.bettingName, betPlaced.matchId, betPlaced.eventName, betPlaced.eventType, betPlaced.marketType')
    .orderBy('MAX(betPlaced.createdAt)', 'DESC');

  const data = await query.getRawMany();

  const query2 = BetPlaced.createQueryBuilder()
    .leftJoinAndMapOne("betPlaced.match", "match", "match", "betPlaced.matchId=match.id")
    .select([
      'COUNT(*) AS "trade"',
      'betPlaced.eventType AS "eventType"',
      'betPlaced.matchId AS "matchId"',
      'betPlaced.marketType AS "marketType"',
      'match.title AS "eventName"',
    ])
    .where({
      createBy: userId, result: betResultStatus.PENDING, deleteReason: IsNull(), marketBetType
        : marketBetType.SESSION
    })
    .groupBy('betPlaced.matchId, match.title, betPlaced.eventType, betPlaced.marketType')
    .orderBy('MAX(betPlaced.createdAt)', 'DESC');

  const data2 = await query2.getRawMany();

  return [...data, ...data2];
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

exports.getBetsWithMatchId = (where, betCondition = {}) => {

  return BetPlaced.createQueryBuilder()
    .leftJoinAndMapOne("betPlaced.user", "user", 'user', 'betPlaced.createBy = user.id' + (where ?? ""))
    .where({ deleteReason: IsNull(), result: In([betResultStatus.PENDING]), ...betCondition })
    .andWhere("user.id IS NOT NULL")
    .groupBy("betPlaced.matchId")
    .select(['betPlaced.matchId as "matchId"', "COUNT(betPlaced.matchId) as count"])
    .getRawMany();
}


exports.getChildUsersPlaceBets = (id, matchId) => {

  return BetPlaced.query(`WITH RECURSIVE RoleHierarchy AS (
    SELECT id, "roleName", "createBy"
    FROM public.users
    WHERE id = $1
    UNION
    SELECT ur.id, ur."roleName", ur."createBy"
    FROM public.users ur
    JOIN RoleHierarchy rh ON ur."createBy" = rh.id
  ) select distinct "betId","marketBetType","eventType", "matchId","eventName",match."title",match."startAt","bettingName","marketType" from "betPlaceds" join matchs as match on match.id = "betPlaceds"."matchId" 
  join RoleHierarchy rh on rh.id = "betPlaceds"."createBy" 
  where "betPlaceds".result = 'PENDING' and "marketBetType" != 'CARD' ${matchId ? 'and "matchId"=$2' : ""}`, [id, ...(matchId ? [matchId] : [])]);
}

exports.pendingCasinoResult = () => {

  return BetPlaced.query(`select distinct "runnerId" , "eventType" from "betPlaceds" where result = 'PENDING' and "marketBetType" = 'CARD';`);
}

exports.getChildUsersSinglePlaceBet = (id) => {

  return BetPlaced.query(`WITH RECURSIVE RoleHierarchy AS (
    SELECT id, "roleName", "createBy"
    FROM public.users
    WHERE id = $1
    UNION
    SELECT ur.id, ur."roleName", ur."createBy"
    FROM public.users ur
    JOIN RoleHierarchy rh ON ur."createBy" = rh.id
  ) select id from "betPlaceds" where "betPlaceds"."createBy" IN (SELECT id FROM RoleHierarchy) and "betPlaceds".result = 'PENDING' and "marketBetType" != 'CARD' limit 1`, [id]);
}

exports.deleteBet = async (where) => {
  await BetPlaced.delete(where);
}

exports.getChildUsersPlaceBetsByBetId = (id, betIds) => {

  return BetPlaced.query(`WITH RECURSIVE RoleHierarchy AS (
    SELECT id, "roleName", "createBy", "userName"
    FROM public.users
    WHERE id = $1
    UNION
    SELECT ur.id, ur."roleName", ur."createBy", ur."userName"
    FROM public.users ur
    JOIN RoleHierarchy rh ON ur."createBy" = rh.id
  ) select "betPlaceds".* , rh.id , rh."userName" from "betPlaceds" 
  join RoleHierarchy rh on rh.id = "betPlaceds"."createBy" where "betPlaceds".result = 'PENDING' and "marketBetType" != 'CARD' and "betPlaceds"."betId" In ('${betIds.join("','")}')`, [id]);
}

exports.getChildUsersAllPlaceBets = (id) => {

  return BetPlaced.query(`WITH RECURSIVE RoleHierarchy AS (
    SELECT id, "roleName", "createBy", "userName"
    FROM public.users
    WHERE id = $1
    UNION
    SELECT ur.id, ur."roleName", ur."createBy", ur."userName"
    FROM public.users ur
    JOIN RoleHierarchy rh ON ur."createBy" = rh.id
  ) select "betPlaceds".* , rh.id , rh."userName" from "betPlaceds" 
  join RoleHierarchy rh on rh.id = "betPlaceds"."createBy" where "betPlaceds".result = 'PENDING' ${matchId ? 'and "matchId"=$2' : ""}`, [id, matchId]);
}
