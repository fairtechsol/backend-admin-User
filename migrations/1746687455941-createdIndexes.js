const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class CreatedIndexes1746687455941 {
    name = 'CreatedIndexes1746687455941'

    async up(queryRunner) {
        await queryRunner.query(`DROP INDEX "public"."user_userId"`);
        await queryRunner.query(`CREATE INDEX "user_userId" ON "virtualCasinoBetPlaceds" ("createdAt", "userId") `);
        await queryRunner.query(`CREATE INDEX "user_transactionId" ON "virtualCasinoBetPlaceds" ("transactionId") `);
        await queryRunner.query(`CREATE INDEX "user_createBy" ON "users" ("createBy") `);
    }

    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX "public"."user_createBy"`);
        await queryRunner.query(`DROP INDEX "public"."user_transactionId"`);
        await queryRunner.query(`DROP INDEX "public"."user_userId"`);
        await queryRunner.query(`CREATE INDEX "user_userId" ON "virtualCasinoBetPlaceds" ("id", "userId") `);
    }
}