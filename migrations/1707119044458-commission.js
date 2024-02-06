const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class Commission1707119044458 {
    name = 'Commission1707119044458'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "commissions" ALTER COLUMN "betPlaceId" DROP NOT NULL`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "commissions" ALTER COLUMN "betPlaceId" SET NOT NULL`);
    }
}
