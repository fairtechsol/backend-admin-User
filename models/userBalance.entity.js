// models/User.js
const { EntitySchema } = require('typeorm');
const { userSchema } = require('./user.entity');

const userBalanceSchema = new EntitySchema({
    name: 'userBalance',
    columns: {
        id: {
            type: 'uuid',
            primary: true,
            generated: 'uuid',
        },
        currentBalance: {
            type: 'decimal',
            nullable: false,
            default: false,
            precision: 13,
            scale: 2,
            default: 0
        },
        exposure: {
            type: 'decimal',
            nullable: false,
            default: false,
            precision: 13,
            scale: 2,
            default: 0
        },
        userId: {
            type: 'uuid',
            nullable: false,
            unique: true
        },
        profitLoss: {
            type: 'decimal',
            nullable: false,
            default: false,
            precision: 13,
            scale: 2,
            default: 0
        },
        myProfitLoss: {
            type: 'decimal',
            nullable: false,
            default: false,
            precision: 13,
            scale: 2,
            default: 0
        },
        downLevelBalance: {
            type: 'decimal',
            nullable: false,
            default: false,
            precision: 13,
            scale: 2,
            default: 0
        },
    },
    relations: {
        user: {
            type: 'one-to-one',
            target: 'user',
            joinColumn: {
                name: 'userId',
                referencedColumnName: 'id',
            },
        },
    },
    indices: [
        {
            name: 'userBalance_userId',   // index name should be start with the table name
            unique: true, // Optional: Set to true if you want a unique index
            columns: ['id', 'userId'],
        }
    ],
});

module.exports = userBalanceSchema;
