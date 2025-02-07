const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class VerifyBet1738913417729 {
    name = 'VerifyBet1738913417729'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "betPlaceds" ADD "verifyBy" character varying`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "betPlaceds" DROP COLUMN "verifyBy"`);
    }
}
