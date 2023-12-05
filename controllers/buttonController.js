const { defaultButtonValue, buttonType, userRoleConstant } = require('../config/contants');
const buttonService = require('../services/buttonService');
const { ErrorResponse, SuccessResponse } = require('../utils/response')


exports.getButton = async (req, res) => {
    try {
        const { id } = req.user
        const button = await buttonService.getButtonByUserId(id);
        if (!button) ErrorResponse({ statusCode: 400, message: { msg: "button.InvalidUser" } }, req, res)

        return SuccessResponse({ statusCode: 200, message: { msg: "login" }, data: button }, req, res)
    } catch (err) {
        return ErrorResponse(err, req, res)
    }

};

exports.insertButtons = async (req, res) => {
    try {
        let { id, type, value } = req.body;
        if (req.user.roleName != userRoleConstant.user) {
            return ErrorResponse({ statusCode: 400, message: { msg: "button.InvalidUser" } }, req, res);
        }
        value = JSON.stringify(value);
        let buttonData = {
            type,
            value
        }
        if (id) {
            buttonData.id = id;
        } else {
            buttonData.createby = req.user.id;
        }

        const button = await buttonService.addButton(buttonData);
        return SuccessResponse({ statusCode: 200, message: { msg: "login" }, data: button }, req, res);
    } catch (error) {
        return ErrorResponse(error, req, res);
    }


};

