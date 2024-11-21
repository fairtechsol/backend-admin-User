const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class Virtualcasino1732171361082 {
    name = 'Virtualcasino1732171361082'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "virtualCasinoBetPlaceds" ADD "settled" boolean NOT NULL DEFAULT false`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "virtualCasinoBetPlaceds" DROP COLUMN "settled"`);
    }
}
