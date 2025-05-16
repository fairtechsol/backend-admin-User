const { ILike } = require("typeorm");
const { AppDataSource } = require("../config/postGresConnection");
const accessUserSchema = require("../models/accessUser.entity");
const AccessUser = AppDataSource.getRepository(accessUserSchema);

// this is the dummy function to test the functionality

exports.getAccessUserById = async (id, select) => {
    return await AccessUser.findOne({
        where: { id },
        select: select,
    });
};

exports.getAccessUsers = async (where = {}, select) => {
    return await AccessUser.createQueryBuilder()
        .leftJoinAndMapOne("accessUser.permission", "permission", "permission", "permission.id=accessUser.permission")
        .where(where).select(select).getMany();
};
exports.addAccessUser = async (body) => {
    let insertUser = await AccessUser.save(body);
    return insertUser;
};

exports.insertAccessUser = async (AccessUsers) => {
    let insertUser = await AccessUser.insert(AccessUsers);
    return insertUser;
};

exports.updateAccessUser = async (where, body) => {
    await AccessUser.update(where, body);
};


exports.deleteAccessUser = async (where) => {
    await AccessUser.delete(where);
};

exports.getAccessUserByUserName = async (userName, select) => {
    return await AccessUser.findOne({
        where: { userName: ILike(userName) },
        select: select,
    });
};


exports.getAccessUserWithPermission = async (where = {}, select) => {
    return await AccessUser.createQueryBuilder()
        .leftJoinAndMapOne("accessUser.permission", "permission", "permission", "permission.id=accessUser.permission")
        .where(where).select(select).getOne();
};

exports.accessUserPasswordAttempts = async (id) => {
  await AccessUser.query(`update "accessUsers" set "transactionPasswordAttempts" = "transactionPasswordAttempts" + 1 where "id" = $1`, [id]);

}