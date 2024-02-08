const { EntitySchema } = require('typeorm');
const { baseColumnsSchemaPart } = require("../config/contants");

const buttonSchema = new EntitySchema({
    name: 'button',
    columns: {
        ...baseColumnsSchemaPart,
        // use the createBy colum for the user id for which user is this data 
        type: {
            type: 'varchar',
            nullable: false,
        },
        value: {
            type: 'varchar',
            nullable: false,
        },
    },
    relations: {
        user: {
            type: 'one-to-many',
            target: 'user',
            joinColumn: {
                name: 'createBy',
                referencedColumnName: 'id',
            },
        },
    },
    indices: [
        {
            name: 'button_createBy',   // index name should be start with the table name
            unique: false, // Optional: Set to true if you want a unique index
            columns: ['createBy'],
        }
    ],
 
});

module.exports = buttonSchema;
