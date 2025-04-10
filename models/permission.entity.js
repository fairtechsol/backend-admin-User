const { EntitySchema } = require('typeorm');
const { baseColumnsSchemaPart, permissions } = require('./../config/contants');

const permissionSchema = new EntitySchema({
    name: 'permission',
    columns: {
        ...baseColumnsSchemaPart,
        ...(Object.keys(permissions).reduce((acc, key) => {
            acc[key] = {
                type: 'boolean',
                default: false,
            };
            return acc;
        }, {}))
    },
});

module.exports = permissionSchema;
