const { EntitySchema } = require('typeorm');
const { authenticatorType } = require('../config/contants');

const userAuthenticatorSchema = new EntitySchema({
    name: 'userAuthenticator',
    columns: {
        id: {
            type: 'uuid',
            primary: true,
            generated: 'uuid',
        },
        userId: {
            type: 'uuid',
            nullable: false,
        },
        deviceId: {
            type: 'varchar',
            nullable: false
        },
        type: {
            type: 'enum',
            enum: Object.values(authenticatorType),
            nullable: false,
        },
    }
});

module.exports = userAuthenticatorSchema;
