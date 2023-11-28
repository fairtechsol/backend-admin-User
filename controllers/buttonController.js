const { defaultButtonValue, buttonType, userRoleConstant } = require('../config/contants');
const buttonService = require('../services/buttonService');
const {ErrorResponse,SuccessResponse} = require('../utils/response')


exports.getAllButtons = async (req, res) => {

    const button = await buttonService.getButtons();
    return SuccessResponse({statusCode : 200,message :{msg:"login"},data : button},req,res)   
  
};

exports.insertButtons = async (req, res) => {
try {
    let {id,type,value} = req.body
    if(req.user.roleName != userRoleConstant.user) {
        return ErrorResponse({ statusCode: 400, message: { msg: "button.InvalidUser" } }, req, res)
    }
    const buttonData =
        {
            id,
            type,
            value,
            createBy : req.user.id
        }
    const button = await buttonService.addButton(buttonData);
    return SuccessResponse({statusCode : 200,message :{msg:"login"},data : button},req,res);   
} catch (error) {
    return ErrorResponse(error, req, res)
}
    
  
};

