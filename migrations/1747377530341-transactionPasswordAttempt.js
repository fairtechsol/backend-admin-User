const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class TransactionPasswordAttempt1747377530341 {
    name = 'TransactionPasswordAttempt1747377530341'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "accessUsers" ADD "transactionPasswordAttempts" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "virtualCasinoBetPlaceds" DROP COLUMN "amount"`);
        await queryRunner.query(`ALTER TABLE "virtualCasinoBetPlaceds" ADD "amount" numeric(13,2) NOT NULL DEFAULT '0'`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "virtualCasinoBetPlaceds" DROP COLUMN "amount"`);
        await queryRunner.query(`ALTER TABLE "virtualCasinoBetPlaceds" ADD "amount" double precision NOT NULL`);
        await queryRunner.query(`ALTER TABLE "accessUsers" DROP COLUMN "transactionPasswordAttempts"`);
    }
}
