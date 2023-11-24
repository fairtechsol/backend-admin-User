const { userRoleConstant } = require('../config/contants');
const { getUserById, addUser } = require('../services/userService');
const { ErrorResponse, SuccessResponse } = require('../utils/response')


exports.createUser = async (req, res) => {
    try {
        const {userName,fullName,password,phoneNumber,city,roleName,myPartnership,createdBy} = req.body;
        let creator = req.user || await getUserById(createdBy);
        if(!creator) return ErrorResponse({statusCode : 400,message : {msg:"invalidData"}},req,res);
        creator.myPartnership = myPartnership
        userName = userName.toUpperCase();
        let userExist = await getUserByUserName(userName);
        if(userExist) return ErrorResponse({statusCode : 400,message : {msg:"userExist"}},req,res);
        let userData = {
            userName,
            fullName,
            password,
            phoneNumber,
            city,
            roleName,
            userBlock : creator.userBlock,
            betBlock : creator.betBlock,
            createdBy
        }

        let partnerships = await calculatePartnership(userData,creator)
        let insertUser = await addUser(req.body);
        return SuccessResponse({ statusCode: 200, message: { msg: "login" }, data: insertUser }, req, res)
    } catch (err) {
        return ErrorResponse(err, req, res);
    }
};

const calculatePartnership =async (reqParamsy, createUserRole) =>{
  
 

}