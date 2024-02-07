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
            type: 'one-to-one',
            target: 'user',
            joinColumn: {
                name: 'createBy',
                referencedColumnName: 'id',
            },
        },
    },
 
});

module.exports = buttonSchema;
