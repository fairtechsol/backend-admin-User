const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class Virtualcasino1732167290225 {
    name = 'Virtualcasino1732167290225'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "virtualCasinoBetPlaceds" ADD "providerName" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "virtualCasinoBetPlaceds" ADD "gameName" character varying NOT NULL`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "virtualCasinoBetPlaceds" DROP COLUMN "gameName"`);
        await queryRunner.query(`ALTER TABLE "virtualCasinoBetPlaceds" DROP COLUMN "providerName"`);
    }
}
