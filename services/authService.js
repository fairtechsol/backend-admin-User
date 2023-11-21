
const { AppDataSource } = require("../config/postGresConnection");
const userSchema = require('../models/user.entity');
const user = AppDataSource.getRepository(userSchema);

exports.getAllUsers = async () => {
  return await user.find();
};

