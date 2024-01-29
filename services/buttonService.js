const { AppDataSource } = require("../config/postGresConnection");
const buttonSchema = require("../models/button.entity");
const Button = AppDataSource.getRepository(buttonSchema);

// this is the dummy function to test the functionality

exports.getButtonById = async (id, select) => {
  return await Button.findOne({
    where: { id },
    select: select,
  });
};
exports.getButtonByUserId = async (id, select) => {
  return await Button.find({
    where: { createBy: id },
    select: select,
  });
};

exports.getButtons = async (where = {}, select) => {
  return await Button.find({
    where,
    select: select,
  });
};
exports.addButton = async (body) => {
  let insertUser = await Button.save(body);
  return insertUser;
};

exports.insertButton = async (buttons) => {
  let insertUser = await Button.insert(buttons);
  return insertUser;
};

exports.updateButton = async (buttons) => {
  await Button.update(buttons?.id, buttons);
};
