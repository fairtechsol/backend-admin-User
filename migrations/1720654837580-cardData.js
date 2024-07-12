const { MigrationInterface, QueryRunner } = require("typeorm");
const { cardGames } = require("../config/contants");

module.exports = class CardData1720654837580 {
    name = 'InsertCard1720654099131'

    async up(queryRunner) {
        for (let game of cardGames) {
            await queryRunner.query(`INSERT INTO "cardMatchs" (name, type, "minBet", "maxBet", id) SELECT $1, $2, $3, $4, $5 FROM (VALUES (1)) AS dummy WHERE NOT EXISTS (SELECT * FROM "cardMatchs" WHERE type = $2);`,
                [game.name, game.type, 0, 1, game.id]);
        }

    }

    async down(queryRunner) {
        const cardTypes = cardGames?.map((item) => item.type);

        for (let type of cardTypes) {
            await queryRunner.query(`
                DELETE FROM "cardMatchs" WHERE type = $1
            `, [type]);
        }
    }

}
