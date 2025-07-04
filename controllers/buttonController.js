const {
  userRoleConstant,
} = require("../config/contants");
const buttonService = require("../services/buttonService");
const { ErrorResponse, SuccessResponse } = require("../utils/response");

exports.getButton = async (req, res) => {
  try {
    const { id } = req.user;
    let type = req.query?.type;
    let where = { createBy: id };
    if (type) {
      where.type = type;
    }
    const button = await buttonService.getButtons(where, [
      "id",
      "type",
      "value",
    ]);
    if (!button) {
      return ErrorResponse(
        { statusCode: 400, message: { msg: "button.InvalidUser" } },
        req,
        res
      );
    }

    return SuccessResponse(
      {
        statusCode: 200,
        message: { msg: "fetched", keys: { type: "Button" } },
        data: button,
      },
      req,
      res
    );
  } catch (err) {
    return ErrorResponse(err, req, res);
  }
};

exports.insertButtons = async (req, res) => {
  try {
    let { id, type, value } = req.body;
    if (req.user.roleName != userRoleConstant.user) {
      return ErrorResponse(
        { statusCode: 400, message: { msg: "button.InvalidUser" } },
        req,
        res
      );
    }
    value = JSON.stringify(value);

    if (id) {
      await buttonService.updateButton({
        type,
        value,
        id,
      });
    } else {
      await buttonService.addButton({
        type,
        value,
        createBy: req.user.id,
      });
    }

    return SuccessResponse(
      {
        statusCode: 200,
        message: { msg: "created", keys: { type: "Button" } },
        data: value,
      },
      req,
      res
    );
  } catch (error) {
    return ErrorResponse(error, req, res);
  }
};
