const { EntitySchema } = require('typeorm');
const { baseColumnsSchemaPart } = require("../config/contants");

const userBlockSchema = new EntitySchema({
    name: 'userBlock',
    columns: {
        ...baseColumnsSchemaPart,
        userId: {
            type: 'uuid',
            nullable: false,
        },
        userBlock: {
          type: 'boolean',
          nullable: false,
          default: false
        },
        betBlock: {
          type: 'boolean',
          nullable: false,
          default: false,
        },
        isWalletBlock: {
          type: 'boolean',
          nullable: false,
          default: false,
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
        createByUser: {
          type: 'many-to-one',
          target: 'user',
          joinTable: {
            joinColumn: {
              name: 'createBy',
              referencedColumnName: 'id',
            },
          },
        },
    },
    indices: [
        {
            name: 'userBlock_createBy',   // index name should be start with the table name
            unique: true, // Optional: Set to true if you want a unique index
            columns: ['userId', 'createBy'],
        }
    ],
});

module.exports = userBlockSchema;