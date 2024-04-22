const { Not, IsNull } = require("typeorm");
const { AppDataSource } = require("../config/postGresConnection");
const commissionSchema = require("../models/commission.entity");
const Commission = AppDataSource.getRepository(commissionSchema);

exports.insertCommissions = async (data) => {
  await Commission.insert(data);
};

exports.getCombinedCommission = (betId) => {
  return Commission.createQueryBuilder().where({ betId: betId }).groupBy('"parentId"').select(['Sum(commission.commissionAmount) as amount', 'commission.parentId as "userId"']).getRawMany();
}

exports.deleteCommission = (betId) => {
  Commission.delete({ betId: betId });
}

exports.commissionReport = (userId, query,queryColumns) => {
  const commissionMatches = Commission.createQueryBuilder().where({ parentId: userId ,matchId : Not(IsNull()) }).groupBy("match.id").addGroupBy("match.title").addGroupBy("match.startAt")
    .leftJoinAndMapOne("commission.match", "match", 'match', 'commission.matchId = match.id')
    .leftJoinAndMapOne("commission.parentuser", "user", 'parentuser', 'commission.createBy = parentuser.id')
  .select(['match.title as "matchName"', 'match.startAt as "matchStartDate"', 'match.id as "matchId"',`ROUND((Sum(commission.commissionAmount * (${queryColumns}))  / 100)::numeric, 2) as amount`])
  .orderBy('match.startAt', 'DESC');

  if (query.page) {
    commissionMatches.skip((parseInt(query.page) - 1) * parseInt(query.limit || 10)).take(parseInt(query?.limit || 10));
  }
  return commissionMatches.getRawMany();
}

exports.commissionMatchReport = (userId, matchId,queryColumns) => {
  const commissionMatches = Commission.createQueryBuilder().where({ parentId: userId, matchId: matchId })
  .leftJoinAndMapOne("commission.match", "match", 'match', 'commission.matchId = match.id')
  .leftJoinAndMapOne("commission.betPlaced", "betPlaced", 'betPlaced', 'commission.betPlaceId = betPlaced.id')
  .leftJoinAndMapOne("commission.user", "user", 'user', 'commission.createBy = user.id')
  .leftJoinAndMapOne("commission.parentuser", "user", 'parentuser', 'commission.createBy = parentuser.id')
    .select(['user.userName as "userName"', 'betPlaced.marketBetType as "commissionType"', 'betPlaced.eventName as "name"', 'betPlaced.createdAt as "date"', 'betPlaced.teamName as "teamName"', 'betPlaced.odds as "odds"', 'betPlaced.betType as "betType"', 'betPlaced.amount as "stake"', 'commission.commissionAmount as "commissionAmount"', 'commission.commissionType as "commissionType"', 'commission.settled as "settled"', ...(queryColumns != '' && queryColumns ? [`${queryColumns} as "partnerShip"`] : [])]);
  return commissionMatches.getRawMany();
}

exports.settleCommission = async (userId) => {
  await Commission.update({ parentId: userId },{
    settled:true
  });
}