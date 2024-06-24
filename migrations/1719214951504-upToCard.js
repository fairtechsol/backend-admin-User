const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class UpToCard1719214951504 {
    name = 'UpToCard1719214951504'

    async up(queryRunner) {
        await queryRunner.query(`CREATE TABLE "racingMatchs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createBy" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "matchType" character varying(50) NOT NULL, "countryCode" character varying, "title" character varying(100) NOT NULL, "marketId" character varying NOT NULL, "eventId" character varying NOT NULL, "eventName" character varying, "venue" character varying, "raceType" character varying NOT NULL, "startAt" TIMESTAMP WITH TIME ZONE NOT NULL, "stopAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_043089c6d691284da2a39224499" UNIQUE ("marketId"), CONSTRAINT "PK_6041a3db78cb37a8bcda3dfdf4a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "racingMatch_marketId" ON "racingMatchs" ("marketId", "matchType") `);
        await queryRunner.query(`CREATE TYPE "public"."cardMatchs_type_enum" AS ENUM('dt20', 'teen20', 'card32', 'lucky7', 'abj', 'dt202', 'dtl20', 'dt6', 'lucky7eu', 'teen', 'teen9', 'teen8', 'poker', 'poker20', 'poker6', 'baccarat', 'baccarat2', 'card32eu', 'ab20', '3cardj', 'war', 'worli2', 'superover', 'cmatch20', 'aaa', 'btable', 'race20', 'cricketv3')`);
        await queryRunner.query(`CREATE TABLE "cardMatchs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createBy" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "name" character varying NOT NULL, "type" "public"."cardMatchs_type_enum" NOT NULL, "minBet" double precision NOT NULL DEFAULT '0', "maxBet" double precision NOT NULL DEFAULT '1', CONSTRAINT "PK_8c9f923b259530f9f9349f76fce" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "cardMatch_type" ON "cardMatchs" ("type") `);
        await queryRunner.query(`ALTER TABLE "users" ADD "transactionPasswordAttempts" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "betPlaceds" ADD "runnerId" character varying`);
        await queryRunner.query(`ALTER TYPE "public"."betPlaceds_marketbettype_enum" RENAME TO "betPlaceds_marketbettype_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."betPlaceds_marketbettype_enum" AS ENUM('SESSION', 'MATCHBETTING', 'RACING', 'CARD')`);
        await queryRunner.query(`ALTER TABLE "betPlaceds" ALTER COLUMN "marketBetType" TYPE "public"."betPlaceds_marketbettype_enum" USING "marketBetType"::"text"::"public"."betPlaceds_marketbettype_enum"`);
        await queryRunner.query(`DROP TYPE "public"."betPlaceds_marketbettype_enum_old"`);
    }

    async down(queryRunner) {
        await queryRunner.query(`CREATE TYPE "public"."betPlaceds_marketbettype_enum_old" AS ENUM('SESSION', 'MATCHBETTING')`);
        await queryRunner.query(`ALTER TABLE "betPlaceds" ALTER COLUMN "marketBetType" TYPE "public"."betPlaceds_marketbettype_enum_old" USING "marketBetType"::"text"::"public"."betPlaceds_marketbettype_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."betPlaceds_marketbettype_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."betPlaceds_marketbettype_enum_old" RENAME TO "betPlaceds_marketbettype_enum"`);
        await queryRunner.query(`ALTER TABLE "betPlaceds" DROP COLUMN "runnerId"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "transactionPasswordAttempts"`);
        await queryRunner.query(`DROP INDEX "public"."cardMatch_type"`);
        await queryRunner.query(`DROP TABLE "cardMatchs"`);
        await queryRunner.query(`DROP TYPE "public"."cardMatchs_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."racingMatch_marketId"`);
        await queryRunner.query(`DROP TABLE "racingMatchs"`);
    }
}
