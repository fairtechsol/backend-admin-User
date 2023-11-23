
const { AppDataSource } = require("../config/postGresConnection");
const userSchema = require('../models/user.entity');
const user = AppDataSource.getRepository(userSchema);

exports.getAllUsers = async () => {
  return await user.find();
};


exports.createUser = async () => {
  let userCreate = user.create({
    userName : "uniqueUser",
    fullName : "unique user",
    password : "123456",
    "transPassword" : "1234556",
    phoneNumber : "9876544321",
    city : "mohali",
    roleName  :"admin",
    matchComissionType : 'totalLoss',
  })
  return  userCreate;
};