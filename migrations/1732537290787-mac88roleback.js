const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class Mac88roleback1732537290787 {
    name = 'Mac88roleback1732537290787'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "virtualCasinoBetPlaceds" ADD "isRollback" boolean NOT NULL DEFAULT false`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "virtualCasinoBetPlaceds" DROP COLUMN "isRollback"`);
    }
}
