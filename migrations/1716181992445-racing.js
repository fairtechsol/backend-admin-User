const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class Racing1716181992445 {
    name = 'Racing1716181992445'

    async up(queryRunner) {
        await queryRunner.query(`CREATE TABLE "racingMatchs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createBy" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "matchType" character varying(50) NOT NULL, "countryCode" character varying, "title" character varying(100) NOT NULL, "marketId" character varying NOT NULL, "eventId" character varying NOT NULL, "eventName" character varying, "venue" character varying, "raceType" character varying NOT NULL, "startAt" TIMESTAMP WITH TIME ZONE NOT NULL, "stopAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_043089c6d691284da2a39224499" UNIQUE ("marketId"), CONSTRAINT "PK_6041a3db78cb37a8bcda3dfdf4a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "racingMatch_marketId" ON "racingMatchs" ("marketId", "matchType") `);
        await queryRunner.query(`ALTER TYPE "public"."betPlaceds_marketbettype_enum" RENAME TO "betPlaceds_marketbettype_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."betPlaceds_marketbettype_enum" AS ENUM('SESSION', 'MATCHBETTING', 'RACING')`);
        await queryRunner.query(`ALTER TABLE "betPlaceds" ALTER COLUMN "marketBetType" TYPE "public"."betPlaceds_marketbettype_enum" USING "marketBetType"::"text"::"public"."betPlaceds_marketbettype_enum"`);
        await queryRunner.query(`DROP TYPE "public"."betPlaceds_marketbettype_enum_old"`);
    }

    async down(queryRunner) {
        await queryRunner.query(`CREATE TYPE "public"."betPlaceds_marketbettype_enum_old" AS ENUM('SESSION', 'MATCHBETTING')`);
        await queryRunner.query(`ALTER TABLE "betPlaceds" ALTER COLUMN "marketBetType" TYPE "public"."betPlaceds_marketbettype_enum_old" USING "marketBetType"::"text"::"public"."betPlaceds_marketbettype_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."betPlaceds_marketbettype_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."betPlaceds_marketbettype_enum_old" RENAME TO "betPlaceds_marketbettype_enum"`);
        await queryRunner.query(`DROP INDEX "public"."racingMatch_marketId"`);
        await queryRunner.query(`DROP TABLE "racingMatchs"`);
    }
}
