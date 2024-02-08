const { AppDataSource } = require("../config/postGresConnection");
const commissionSchema = require("../models/commission.entity");
const Commission = AppDataSource.getRepository(commissionSchema);

exports.insertCommissions = (data) => {
  Commission.insert(data);
};

exports.getCombinedCommission = (betId) => {
  return Commission.createQueryBuilder().where({ betId: betId }).groupBy('"parentId"').select(['Sum(commission.commissionAmount) as amount', 'commission.parentId as "userId"']).getRawMany();
}

exports.deleteCommission = (betId) => {
  Commission.delete({ betId: betId });
}

exports.commissionReport = (userId, query) => {
  const commissionMatches = Commission.createQueryBuilder().where({ parentId: userId }).groupBy('"matchId"').addGroupBy("match.title").addGroupBy("match.startAt")
    .leftJoinAndMapOne("commission.match", "match", 'match', 'commission.matchId = match.id')
    .select(['match.title as "matchName"', 'match.startAt as "matchStartDate"', 'match.matchId as "matchId"']);

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
    .select(['user.userName as "userName"', 'betPlaced.marketBetType as "commissionType"', 'betPlaced.eventName as "name"', 'betPlaced.createdAt as "date"', 'betPlaced.teamName as "teamName"', 'betPlaced.odds as "odds"', 'betPlaced.betType as "betType"', 'betPlaced.amount as "stake"', 'commission.commissionAmount as "commissionAmount"','commission.commissionType as "commissionType"', ...(queryColumns != '' && queryColumns ? [`${queryColumns} as "partnerShip"`] : [])]);
  return commissionMatches.getRawMany();
}

exports.settleCommission = (userId) => {
  Commission.update({ parentId: userId },{
    settled:true
  });
}