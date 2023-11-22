const { EntitySchema } = require('typeorm');
const { baseColumnsSchemaPart } = require("../config/contants");

const systemTableSchema = new EntitySchema({
    name: 'systemTable',
    columns: {
        ...baseColumnsSchemaPart,
        type: {
            type: 'varchar',
            nullable: false,
        },
        value: {
            type: 'varchar',
            nullable: true,
        },
    },
    indices: [
        {
            name: 'systemTable_type',   // index name should be start with the table name
            unique: true, // Optional: Set to true if you want a unique index
            columns: ['type'],
        }
    ],
    relations: {
    }
});

module.exports = systemTableSchema;
