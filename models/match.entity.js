const { EntitySchema } = require("typeorm");
const { baseColumnsSchemaPart } = require("../config/contants");

const matchSchema = new EntitySchema({
  name: "match",
  columns: {
    ...baseColumnsSchemaPart,
    matchType: {
      type: "varchar",
      nullable: false,
      length: 50,
    },
    competitionId: {
      type: "varchar",
      nullable: true,
    },
    competitionName: {
      type: "varchar",
      nullable: true,
    },
    title: {
      type: "varchar",
      nullable: false,
      length: 100,
    },
    marketId: {
      type: "varchar",
      nullable: false,
      unique:true
    },
    eventId: {
      type: "varchar",
      nullable: false,
    },
    teamA: {
      type: "varchar",
      nullable: false,
      length: 100,
    },
    teamB: {
      type: "varchar",
      nullable: true,
      length: 100,
    },
    teamC: {
      type: "varchar",
      nullable: true,
      length: 100,
    },
    startAt: {
      type: "timestamp with time zone",
      nullable: false,
    },
    stopAt: {
      type: "timestamp with time zone",
      nullable: true,
    },
    isTv: {
      type: "boolean",
      default: false,
      nullable: false
    },
    isFancy:{
      type: "boolean",
      default: false,
      nullable: false
    },
    isBookmaker:{
      type: "boolean",
      default: false,
      nullable: false
    }
  },
  orderBy: {
    startAt: "DESC",
  },
  indices: [
    {
      name: "match_marketId", // index name should be start with the table name
      unique: true, // Optional: Set to true if you want a unique index
      columns: ["marketId", "matchType"],
    },
  ]
});

module.exports = matchSchema;
