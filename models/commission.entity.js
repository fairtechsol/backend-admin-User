const { EntitySchema } = require('typeorm');
const { baseColumnsSchemaPart, matchComissionTypeConstant, marketBetType } = require("../config/contants");
const { ColumnNumericTransformer } = require('../services/dbService');

const commissionSchema = new EntitySchema({
  name: 'commission',
  columns: {
    ...baseColumnsSchemaPart,
    matchId: {
      type: 'uuid',
      nullable: true
    },
    betId: {
      type: 'uuid',
      nullable: true
    },
    betPlaceId: {
      type: 'uuid',
      nullable: true,
    },
    commissionAmount: {
      type: 'decimal',
      precision: 13,
      scale: 2,
      default: 0,
      nullable: false,
      transformer: new ColumnNumericTransformer()
    },
    commissionType:{
      type: 'enum',
      enum: Object.values(matchComissionTypeConstant),
      nullable: true
    },
    parentId:{
      type: 'uuid',
      nullable: false,
    },
    settled:{
      type:Boolean,
      default:false
    },
    matchType:{
      type: 'enum',
      enum: Object.values(marketBetType),
      nullable: true
    }
  },
  indices: [ 
    {
        name: 'commission_betId',   // index name should be start with the table name
        columns: ['betId'],
    },
    {
        name: 'commission_matchId',   // index name should be start with the table name
        columns: ['matchId'],
    },
    {
      name: 'commission_createBy',   // index name should be start with the table name
      columns: ['createBy'],
    }
],
});

module.exports = commissionSchema;
