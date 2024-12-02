const { EntitySchema } = require('typeorm');
const { sessionBettingType, baseColumnsSchemaPart } = require("../config/contants");
const userMarketLockSchema = new EntitySchema({
    name: 'userMarketLock',
    columns: {
        ...baseColumnsSchemaPart,
        matchId: {
            type: 'uuid',
            nullable: false,
        },
        userId: {
            type: 'uuid',
            nullable: false,
        },
        betId: {
            type: 'uuid',
            nullable: true
        },
        sessionType: {
            type: 'enum',
            enum: Object.values(sessionBettingType),
            nullable: true
        },
        blockType: {
            type: 'int',
            nullable: false,
            default: 0,
        },
    }
});

module.exports = userMarketLockSchema;
