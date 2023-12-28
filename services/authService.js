const { AppDataSource } = require("../config/postGresConnection");
const userSchema = require("../models/user.entity");
const userRepo = AppDataSource.getRepository(userSchema);


exports.userLoginAtUpdate=async (userId)=>{
  userRepo.update(userId,{
    loginAt:new Date()
  })
}
