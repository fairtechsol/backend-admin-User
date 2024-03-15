const { EntitySchema } = require('typeorm');
const { baseColumnsSchemaPart, transType } = require("../config/contants");
const { ColumnNumericTransformer } = require('../services/dbService');

const transactionSchema = new EntitySchema({
    name: 'transaction',
    columns: {
        ...baseColumnsSchemaPart,
        searchId: {
            type: 'uuid',
            nullable: false,
        },
        userId: {
            type: 'uuid',
            nullable: false,
        },
        actionBy: {
            type: 'uuid',
            nullable: false,
        },
        amount: {
            type: 'decimal',
            nullable: false,
            precision: 13,
            scale: 2,
            default: 0,
            transformer: new ColumnNumericTransformer()
        },
        closingBalance: {
            type: 'decimal',
            nullable: false,
            precision: 13,
            scale: 2,
            default: 0,
            transformer: new ColumnNumericTransformer()
        },
        transType: {
            type: 'enum',
            enum: Object.values(transType),
            nullable: false,
        },
        description: {
            type: 'varchar',
            nullable: true
        },
        matchId: {      // will add the relation in the future while add the match table
            type: 'uuid',
            nullable: true
        },
        betId : {      // will add the relation in the future while add the match table
            type: 'uuid',
            nullable: true
        },
        uniqueId: {
            type: 'int',
            nullable: false,
            generated: 'increment'
        },
    },
   
    relations: {
        user: {
          type: 'many-to-one',
          target: 'user',
          joinTable: {
            joinColumn: {
              name: 'userId',
              referencedColumnName: 'id',
            }
          },
        },
        actionByUser: {
          type: 'many-to-one',
          target: 'user',
          joinTable: {
            joinColumn: {
              name: 'actionBy',
              referencedColumnName: 'id',
            },
          },
        },
    },
    indices: [
        {
            name: 'transaction_searchId',   // index name should be start with the table name
            unique: false, // Optional: Set to true if you want a unique index
            columns: ['searchId'],
        }
    ],
});

module.exports = transactionSchema;