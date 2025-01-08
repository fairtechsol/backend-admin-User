const { AppDataSource } = require("../config/postGresConnection");
const virtualCasinoBetPlacedSchema = require("../models/virtualCasinoBetPlaceds.entity");
const ApiFeature = require("../utils/apiFeatures");
const VirtualCasino = AppDataSource.getRepository(virtualCasinoBetPlacedSchema);

exports.getVirtualCasinoBetPlaceds = async (where, query) => {
    let pgQuery = VirtualCasino.createQueryBuilder().where(where);

    pgQuery = new ApiFeature(
        pgQuery,
        query
    )
        .search()
        .filter()
        .sort()
        .paginate()
        .getResult();

    const [bets, count] = await pgQuery;
    return { bets, count };
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

exports.getVirtualCasinoExposureSum = async (where) => {
    const count = await VirtualCasino.createQueryBuilder().where(where).select("SUM(amount)", "totalAmount").getRawOne();
    const list = await VirtualCasino.createQueryBuilder().where(where).select("SUM(amount)", "totalAmount").addSelect(['virtualCasinoBetPlaced.gameName as "gameName"', 'virtualCasinoBetPlaced.providerName as "providerName"']).groupBy("virtualCasinoBetPlaced.gameName").addGroupBy("virtualCasinoBetPlaced.providerName").getRawMany();
    return { count, list };
}