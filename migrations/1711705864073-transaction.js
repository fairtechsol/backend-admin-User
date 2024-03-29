const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class Transaction1711705864073 {
    name = 'Transaction1711705864073'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "betId"`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD "betId" uuid array`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "betId"`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD "betId" uuid`);
    }
}