const { EntitySchema } = require('typeorm');
const { baseColumnsSchemaPart, betType, marketBetType } = require("../config/contants");
const { ColumnNumericTransformer } = require('../services/dbService');

const betPlacedSchema = new EntitySchema({
    name: 'betPlaced',
    columns: {
        ...baseColumnsSchemaPart,
        matchId: {
            type: 'uuid',
            nullable: false,
        },
        betId: {
            type: 'uuid',
            nullable: true,
        },
        result : {
            type: 'varchar',
            nullable: true,
        },
        teamName : {
            type: 'varchar',
            nullable: true,
        },
        amount : {
            type: 'decimal',
            nullable: false,
            precision: 13,
            scale: 2,
            default: 0,
            transformer : new ColumnNumericTransformer()
        },
        odds : {
            type: 'decimal',
            nullable: false,
            precision: 13,
            scale: 2,
            default: 0,
            transformer : new ColumnNumericTransformer()
        },
        winAmount : {
            type: 'decimal',
            nullable: false,
            precision: 13,
            scale: 2,
            default: 0,
            transformer : new ColumnNumericTransformer()
        },
        lossAmount : {
            type: 'decimal',
            nullable: false,
            precision: 13,
            scale: 2,
            default: 0,
            transformer : new ColumnNumericTransformer()
        },
        betType: {
            type: 'enum',
            enum: Object.values(betType),
            nullable: false,
            default : betType.YES
        },
        rate : {
            type: 'decimal',
            nullable: false,
            precision: 13,
            scale: 2,
            default: 0,
            transformer : new ColumnNumericTransformer()
        },
        marketType : {
            type: 'varchar',
            nullable: false
        },
        marketBetType : {
            type: 'enum',
            enum: Object.values(marketBetType),
            nullable: true
        },
        deleteReason: {
            type: 'varchar',
            nullable: true,
        },
        ipAddress: {
            type: 'varchar',
            nullable: true,
        },
        browserDetail: {
            type: 'varchar',
            nullable: true,
        },
    },
    relations: {
        user: {
            type: 'many-to-one',
          target: 'user',
          joinTable: {
            joinColumn: {
              name: 'createBy',
              referencedColumnName: 'id',
            }
          },
        },
    },
    indices: [
        {
            name: 'betPlaced_createBy',   // index name should be start with the table name
            columns: ['createBy'],
        }
    ],
});

module.exports = betPlacedSchema;
