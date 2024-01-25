const { EntitySchema } = require('typeorm');

const userMatchLockSchema = new EntitySchema({
    name: 'userMatchLock',
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
        blockBy: {
            type: 'uuid',
            nullable: false
        },
        matchId: {
            type: 'uuid',
            nullable: false,
        },
        matchLock: {
          type: 'boolean',
          nullable: false,
          default: false
        },
        sessionLock: {
          type: 'boolean',
          nullable: false,
          default: false,
        },
        isWalletLock: {
            type: 'boolean',
            nullable: false,
            default: false,
        },
    }
});

module.exports = userMatchLockSchema;
