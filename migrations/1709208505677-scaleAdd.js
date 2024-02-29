const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class ScaleAdd1709208505677 {
    name = 'ScaleAdd1709208505677'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "commissions" ALTER COLUMN "commissionAmount" TYPE numeric(13,2)`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "commissions" ALTER COLUMN "commissionAmount" TYPE numeric(13,0)`);
    }
}
