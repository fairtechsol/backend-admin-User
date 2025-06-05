const { AppDataSource } = require("../config/postGresConnection");
const permissionSchema = require("../models/permission.entity");
const Permission = AppDataSource.getRepository(permissionSchema);

// this is the dummy function to test the functionality

exports.getPermissionById = async (id, select) => {
  return await Permission.findOne({
    where: { id },
    select: select,
  });
};

exports.getPermissions = async (where = {}, select) => {
  return await Permission.find({
    where,
    select: select,
  });
};
exports.addPermission = async (body) => {
  let insertUser = await Permission.save(body);
  return insertUser;
};

exports.insertPermission = async (body) => {
  let insertUser = await Permission.insert(body);
  return insertUser;
};

exports.updatePermission = async (where,body) => {
  await Permission.update(where,body);
};


exports.deletePermission = async (where) => {
  await Permission.delete(where);
};
