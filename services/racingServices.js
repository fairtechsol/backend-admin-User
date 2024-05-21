const { AppDataSource } = require("../config/postGresConnection");
const matchSchema = require("../models/racingMatch.entity");
const racing = AppDataSource.getRepository(matchSchema);

exports.addRaceData = async (body) => {
  let insertMatchData = await racing.save(body);
  return insertMatchData;
};
