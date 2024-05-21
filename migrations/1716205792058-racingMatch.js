const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class RacingMatch1716205792058 {
    name = 'RacingMatch1716205792058'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "betPlaceds" ADD "runnerId" character varying`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "betPlaceds" DROP COLUMN "runnerId"`);
    }
}
