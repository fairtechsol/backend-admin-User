const { AppDataSource } = require("../config/postGresConnection");
const cardMatchSchema = require("../models/cardMatch.entity");
const cardMatch = AppDataSource.getRepository(cardMatchSchema);

exports.getCardMatch = async (where, select) => {
    let cardMatchData = await cardMatch.findOne({
        where: where,
        select: select
    });
    return cardMatchData;
};