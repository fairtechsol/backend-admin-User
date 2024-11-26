const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class DemoLogin1730092877327 {
    name = 'DemoLogin1730092877327'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "users" ADD "isDemo" boolean NOT NULL DEFAULT false`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "isDemo"`);
    }
}
