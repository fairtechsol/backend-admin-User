const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class AddEventName1704356037296 {
    name = 'AddEventName1704356037296'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "betPlaceds" ADD "eventName" character varying`);
        await queryRunner.query(`ALTER TABLE "betPlaceds" ADD "eventType" character varying`);
        await queryRunner.query(`ALTER TABLE "betPlaceds" ALTER COLUMN "marketType" DROP DEFAULT`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "betPlaceds" ALTER COLUMN "marketType" SET DEFAULT 'quickbookmaker1'`);
        await queryRunner.query(`ALTER TABLE "betPlaceds" DROP COLUMN "eventType"`);
        await queryRunner.query(`ALTER TABLE "betPlaceds" DROP COLUMN "eventName"`);
    }
}
