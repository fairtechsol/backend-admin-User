const { AppDataSource } = require("../config/postGresConnection");
const buttonSchema = require("../models/button.entity");
const Button = AppDataSource.getRepository(buttonSchema);

// this is the dummy function to test the functionality

exports.getButtonById = async(id) =>{
    return await Button.findOne({id})
}

exports.getButtons = async(id) =>{
    return await Button.find()
}

exports.addButton = async(body) =>{
        let insertUser = await Button.save(body);
        return insertUser;
}

exports.insertButton = async(buttons) =>{
    let insertUser = await Button.insert(buttons);
    return insertUser;
}
