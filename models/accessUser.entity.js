const { EntitySchema } = require('typeorm');
const { baseColumnsSchemaPart } = require("./../config/contants");

const accessUserSchema = new EntitySchema({
    name: 'accessUser',
    columns: {
        ...baseColumnsSchemaPart,
        userName: {
            type: 'varchar',
            nullable: false,
            unique: true
        },
        fullName: {
            type: 'varchar',
            nullable: true
        },
        password: {
            type: 'varchar',
            nullable: false
        },
        transPassword: {
            type: 'varchar',
            nullable: true
        },
        userBlock: {
            type: 'boolean',
            nullable: false,
            default: false
        },
        userBlockedBy: {
            type: "uuid",
            nullable: true
        },
        loginAt: {
            type: 'timestamp with time zone',
            nullable: true,
            default: null
        },
        parentId: {
            type: "uuid",
            nullable: false
        },
        mainParentId: {
            type: "uuid",
            nullable: false
        },
        permission: {
            type: "uuid",
            nullable: false
        },
        transactionPasswordAttempts: {
            type: "int",
            nullable: false,
            default: 0,
        },
    },
    orderBy: {
        "userBlock": "ASC",
        "userName": "ASC",
    },
    indices: [
        {
            name: 'access_user_userName',   // index name should be start with the table name
            unique: true, // Optional: Set to true if you want a unique index
            columns: ['id', 'userName'],
        }
    ],
});

module.exports = accessUserSchema;
