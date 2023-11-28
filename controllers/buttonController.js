const { defaultButtonValue, buttonType } = require('../config/contants');
const buttonService = require('../services/buttonService');
const {ErrorResponse,SuccessResponse} = require('../utils/response')


exports.getAllButtons = async (req, res) => {

    const button = await buttonService.getButtons();
    return SuccessResponse({statusCode : 200,message :{msg:"login"},data : button},req,res)   
  
};

exports.insertButtons = async (req, res) => {

    const buttons = [
        {
            type : buttonType.MATCH,
            value : defaultButtonValue.buttons,
            createBy : '6f6f9466-25ca-4fa9-af12-271beedc8a17'
            }
    ]
    const button = await buttonService.insertButton(buttons);
    return SuccessResponse({statusCode : 200,message :{msg:"login"},data : button},req,res);   
  
};

