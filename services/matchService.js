const { AppDataSource } = require("../config/postGresConnection");
const matchSchema = require("../models/match.entity");
const match = AppDataSource.getRepository(matchSchema);

exports.addMatchData = async (body) => {
  let insertMatchData = await match.save(body);
  return insertMatchData;
};
