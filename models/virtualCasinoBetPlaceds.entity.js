const { EntitySchema } = require('typeorm');
const {  baseColumnsSchemaPart } = require("../config/contants");

const virtualCasinoBetPlacedSchema = new EntitySchema({
  name: 'virtualCasinoBetPlaced',
  columns: {
    ...baseColumnsSchemaPart,
    betType: {
      type: 'varchar',
      nullable: false,
    },
    providerName:{
      type: 'varchar',
      nullable: false,
    },
    gameName:{
      type: 'varchar',
      nullable: false,
    },
    amount: {
      type: "float",
      nullable: false
    },
    gameId: {
      type: 'varchar',
      nullable: false
    },
    operatorId: {
      type: 'varchar',
      nullable: true
    },
    reqId: {
      type: 'varchar',
      nullable: true
    },
    roundId: {
      type: 'varchar',
      nullable: true
    },
    runnerName: {
      type: 'varchar',
      nullable: true
    },
    token: {
        type: 'varchar',
        nullable: true
    },
    transactionId: {
      type: 'varchar',
      nullable: true,
    },
    userId: {
      type: 'uuid',
      nullable: false,
    },
    settled: {
      type: "boolean",
      nullable: false,
      default: false
    },
    isRollback: {
      type: "boolean",
      nullable: false,
      default: false
    }
  },
  indices: [
    {
      name: 'user_userId',   // index name should be start with the table name
      columns: ['id', 'userId'],
    }
  ],
});

module.exports = virtualCasinoBetPlacedSchema;
