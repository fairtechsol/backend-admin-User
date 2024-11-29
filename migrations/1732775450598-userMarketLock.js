const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class UserMarketLock1732775450598 {
    name = 'UserMarketLock1732775450598'

    async up(queryRunner) {
        await queryRunner.query(`CREATE TYPE "public"."userMarketLocks_sessiontype_enum" AS ENUM('session', 'overByover', 'ballByBall', 'oddEven', 'cricketCasino', 'fancy1', 'khado', 'meter')`);
        await queryRunner.query(`CREATE TABLE "userMarketLocks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createBy" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "matchId" uuid NOT NULL, "userId" uuid NOT NULL, "blockBy" uuid NOT NULL, "betId" uuid, "sessionType" "public"."userMarketLocks_sessiontype_enum", "blockType" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_762fcb35332bddc1e879ea6f249" PRIMARY KEY ("id"))`);
    }

    async down(queryRunner) {
        await queryRunner.query(`DROP TABLE "userMarketLocks"`);
        await queryRunner.query(`DROP TYPE "public"."userMarketLocks_sessiontype_enum"`);
    }
}
