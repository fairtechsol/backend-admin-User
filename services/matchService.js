const { AppDataSource } = require("../config/postGresConnection");
const matchSchema = require("../models/match.entity");
const match = AppDataSource.getRepository(matchSchema);

exports.addMatchData = async (body) => {
  let insertMatchData = await match.save(body);
  return insertMatchData;
};

exports.updateMatchData = async (where, body) => {
  await match.update(where, body);
};

exports.getMatchData = async (where, select) => {
  return await match.findOne({ where:where, select: select });
};

exports.getMatchList = async (where, select) => {
  return await match.find({ where:where, select: select });
};

exports.listMatch = async (keyword) => {
  let matchList = await match.query(`SELECT title, "matchType", "startAt", "id" FROM matchs where "stopAt" is NULL AND title ILIKE $1
  UNION
  SELECT CONCAT(venue, ' | ', title) as title, "matchType", "startAt", "id" FROM "racingMatchs"  where "stopAt" is NULL AND ( title ILIKE $1 OR venue ILIKE $1) ORDER BY "startAt";`, [`%${keyword}%`]);
  return matchList;
};