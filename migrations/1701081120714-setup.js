const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class Setup1701081120714 {
    name = 'Setup1701081120714'

    async up(queryRunner) {
        await queryRunner.query(`DROP INDEX "public"."transaction_searchId"`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD "betId" uuid`);
        await queryRunner.query(`CREATE INDEX "transaction_searchId" ON "transactions" ("searchId") `);
    }

    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX "public"."transaction_searchId"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "betId"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "transaction_searchId" ON "transactions" ("searchId") `);
    }
}
