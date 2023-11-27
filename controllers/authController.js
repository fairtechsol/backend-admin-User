const authService = require('../services/authService');
const {ErrorResponse,SuccessResponse} = require('../utils/response')


exports.login = async (req, res) => {

    console.log("at the controller");

    const users = await authService.getAllUsers();
    return SuccessResponse({statusCode : 200,message :{msg:"login"},data : users},req,res)   
  
};

exports.signup = async (req, res) => {
  const {email, password} = req.body
  const users = await authService.createUser(email,password);
  return SuccessResponse({statusCode : 200,message :{msg:"signup"},data : users},req,res)   
}

exports.dummyFunction = async (req, res) => {
  try {
    console.log("at the controller");
    const users = await authService.dummyFunction();
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

