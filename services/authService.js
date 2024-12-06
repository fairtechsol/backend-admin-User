const { authenticatorType } = require("../config/contants");
const { AppDataSource } = require("../config/postGresConnection");
const userSchema = require("../models/user.entity");
const userRepo = AppDataSource.getRepository(userSchema);

const authenticatorSchema = require("../models/userAuthenticator.entity");
const authenticatorRepo = AppDataSource.getRepository(authenticatorSchema);

exports.userLoginAtUpdate = async (userId) => {
  userRepo.update(userId, {
    loginAt: new Date()
  })
}

exports.addAuthenticator = async (data) => {
  await authenticatorRepo.save(data);
}

exports.deleteAuthenticator = async (where) => {
  await authenticatorRepo.delete(where);
}

exports.getAuthenticator = async (where, select) => {
  return await authenticatorRepo.findOne({
    where: where,
    select: select,
  });
}

exports.getAuthenticators = async (where, select) => {
  return await authenticatorRepo.createQueryBuilder()
  .leftJoinAndMapOne("userAuthenticator.user", "users", "user", "user.id = userAuthenticator.userId")
  .select(select)
  .where(where)
  .getMany();
}