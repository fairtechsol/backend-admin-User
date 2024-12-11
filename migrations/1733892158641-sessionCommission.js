const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class SessionCommission1733892158641 {
    name = 'SessionCommission1733892158641'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "users" ADD "sessionCommission" double precision NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "betPlaceds" ADD "isCommissionActive" boolean NOT NULL DEFAULT false`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "betPlaceds" DROP COLUMN "isCommissionActive"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "sessionCommission"`);
    }
}
