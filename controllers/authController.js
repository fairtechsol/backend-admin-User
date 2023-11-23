const authService = require('../services/authService');
const {ErrorResponse,SuccessResponse} = require('../utils/response')
const {AUTH_MESSAGES} = require('../config/globalMessage');

exports.login = async (req, res) => {

    console.log("at the controller");

    const users = await authService.getAllUsers();
    return SuccessResponse({statusCode : 200,message :AUTH_MESSAGES.LOGIN_SUCCESS,data : users},req,res)   
  
};

exports.signup = async (req, res) => {
  const {email, password} = req.body
  const users = await authService.createUser(email,password);
  return SuccessResponse({statusCode : 200,message :AUTH_MESSAGES.SIGNUP_SUCCESS,data : users},req,res)   

};

