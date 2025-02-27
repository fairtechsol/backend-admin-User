const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class Indexing1740556610012 {
    name = 'Indexing1740556610012'

    async up(queryRunner) {
        await queryRunner.query(`CREATE INDEX "userMarketLock_betId" ON "userMarketLocks" ("betId") `);
        await queryRunner.query(`CREATE INDEX "userMarketLock_matchId" ON "userMarketLocks" ("matchId") `);
        await queryRunner.query(`CREATE INDEX "userMarketLock_userId" ON "userMarketLocks" ("userId") `);
        await queryRunner.query(`CREATE INDEX "commission_betId" ON "commissions" ("betId") `);
        await queryRunner.query(`CREATE INDEX "commission_matchId" ON "commissions" ("matchId") `);
        await queryRunner.query(`CREATE INDEX "commission_createBy" ON "commissions" ("createBy") `);
        await queryRunner.query(`CREATE INDEX "betPlaced_betId" ON "betPlaceds" ("betId") `);
        await queryRunner.query(`CREATE INDEX "betPlaced_matchId" ON "betPlaceds" ("matchId") `);
    }

    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX "public"."betPlaced_matchId"`);
        await queryRunner.query(`DROP INDEX "public"."betPlaced_betId"`);
        await queryRunner.query(`DROP INDEX "public"."commission_createBy"`);
        await queryRunner.query(`DROP INDEX "public"."commission_matchId"`);
        await queryRunner.query(`DROP INDEX "public"."commission_betId"`);
        await queryRunner.query(`DROP INDEX "public"."userMarketLock_userId"`);
        await queryRunner.query(`DROP INDEX "public"."userMarketLock_matchId"`);
        await queryRunner.query(`DROP INDEX "public"."userMarketLock_betId"`);
    }
}
