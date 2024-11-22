const { AppDataSource } = require("../config/postGresConnection");
const virtualCasinoBetPlacedSchema = require("../models/virtualCasinoBetPlaceds.entity");
const ApiFeature = require("../utils/apiFeatures");
const VirtualCasino = AppDataSource.getRepository(virtualCasinoBetPlacedSchema);

exports.getVirtualCasinoBetPlaceds = async (where, query) => {
    let pgQuery = VirtualCasino.createQueryBuilder().where(where);

    return await new ApiFeature(
        pgQuery,
        query
    )
        .search()
        .filter()
        .sort()
        .paginate()
        .getResult();
}

exports.addVirtualCasinoBetPlaced = async (body) => {
    let userBet = await VirtualCasino.save(body);
    return userBet;
}

exports.deleteVirtualCasinoBetPlaced = async (body) => {
    let userBet = await VirtualCasino.remove(body);
    return userBet;
}

exports.updateVirtualCasinoBetPlaced = async (conditionObj, updateColumsObj) => {
    return await VirtualCasino.update(conditionObj, updateColumsObj);
}

exports.getVirtualCasinoBetPlaced = async (where, select) => {
    return await VirtualCasino.findOne({ where:where, select: select });
}
