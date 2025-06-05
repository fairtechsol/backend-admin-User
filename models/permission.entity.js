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
     indices: [
        {
            name: 'permissions_createBy',
            unique: false,
            columns: ['createBy'],
        }
    ],
});

module.exports = permissionSchema;
