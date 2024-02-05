const { EntitySchema } = require('typeorm');
const { baseColumnsSchemaPart, matchComissionTypeConstant } = require("../config/contants");
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
    }
  }
});

module.exports = commissionSchema;
