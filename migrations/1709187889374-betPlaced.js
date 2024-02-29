const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class BetPlaced1709187889374 {
    name = 'BetPlaced1709187889374'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "betPlaceds" ADD "bettingName" character varying`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "betPlaceds" DROP COLUMN "bettingName"`);
    }
}
