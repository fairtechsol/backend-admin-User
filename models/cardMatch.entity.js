const { EntitySchema } = require("typeorm");
const { baseColumnsSchemaPart, cardGames } = require("../config/contants");
const { ColumnNumericTransformer } = require('../services/dbService')

const cardMatchSchema = new EntitySchema({
    name: "cardMatch",
    columns: {
        ...baseColumnsSchemaPart,
        name: {
            type: "varchar",
            nullable: false
        },
        type: {
            type: "enum",
            nullable: false,
            enum: cardGames?.map((item) => item.type)
        },
        minBet: {
            type: 'float',
            nullable: false,
            default: 0,
            transformer: new ColumnNumericTransformer()
        },
        maxBet: {
            type: 'float',
            nullable: false,
            default: 1,
            transformer: new ColumnNumericTransformer()
        },
    },
    indices: [
        {
            name: "cardMatch_type", // index name should be start with the table name
            unique: false, // Optional: Set to true if you want a unique index
            columns: ["type"],
        },
    ]
});

module.exports = cardMatchSchema;
