const { AppDataSource } = require("../config/postGresConnection");
const commissionSchema = require("../models/commission.entity");
const Commission = AppDataSource.getRepository(commissionSchema);

exports.insertCommissions = (data) => {
  Commission.insert(data);
};

exports.getCombinedCommission = (betId)=>{
  return Commission.createQueryBuilder().where({betId:betId}).groupBy('"parentId"').select(['Sum(commission.commissionAmount) as amount','commission.parentId as "userId"']).getRawMany();
}

exports.deleteCommission = (betId)=>{
  Commission.delete({betId:betId});
}