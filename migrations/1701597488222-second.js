const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class Second1701597488222 {
    name = 'Second1701597488222'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "users" ADD "userBlockedBy" uuid`);
        await queryRunner.query(`ALTER TABLE "users" ADD "betBlockedBy" uuid`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "betBlockedBy"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "userBlockedBy"`);
    }
}
