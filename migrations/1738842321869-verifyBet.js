const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class VerifyBet1738842321869 {
    name = 'VerifyBet1738842321869'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "betPlaceds" ADD "isVerified" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "betPlaceds" ADD "verifyBy" character varying`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "betPlaceds" DROP COLUMN "isVerified"`);
        await queryRunner.query(`ALTER TABLE "betPlaceds" DROP COLUMN "verifyBy"`);
    }
}
