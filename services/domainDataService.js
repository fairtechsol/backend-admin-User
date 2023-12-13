const { AppDataSource } = require("../config/postGresConnection");
const domainSchema = require("../models/domainData.entity");
const domain = AppDataSource.getRepository(domainSchema);

exports.addDomainData = async (body) => {
  let insertDomainData = await domain.save(body);
  return insertDomainData;
};

exports.getDomainDataById = async (id, select) => {
  return await domain.findOne({ where: { id : id }, select: select });
};

exports.getDomainDataByDomain = async (domainName, select) => {
    return await domain.findOne({ where: { domain:domainName }, select: select });
  };
  
  exports.getDomainDataByUserId = async (userId, select) => {
    return await domain.findOne({ where: { userId : userId }, select: select });
  };

exports.updateDomainData = async (id, body) => {
  let domainData = await domain.update(id, body);
  return domainData;
};
