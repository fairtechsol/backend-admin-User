const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class UserAutoBlock1711001141566 {
    name = 'UserAutoBlock1711001141566'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "users" ADD "autoBlock" boolean NOT NULL DEFAULT false`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "autoBlock"`);
    }
}
