const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class TransactionPassword1714367567196 {
    name = 'TransactionPassword1714367567196'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "users" ADD "transactionPasswordAttempts" integer NOT NULL DEFAULT '0'`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "transactionPasswordAttempts"`);
    }
}
