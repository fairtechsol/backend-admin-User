const { AppDataSource } = require("../config/postGresConnection");
const betPlacedSchema = require("../models/betPlaced.entity");
const BetPlaced = AppDataSource.getRepository(betPlacedSchema);

// this is the dummy function to test the functionality

exports.getBetById = async(id,select) =>{
    return await BetPlaced.findOne({
        where: { id },
        select: select,
      });
}
exports.getBetByUserId = async(id,select) =>{
    return await BetPlaced.find({
        where: { createBy : id },
        select: select,
      });
}