const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class Card1717654147127 {
    name = 'Card1717654147127'

    async up(queryRunner) {
        await queryRunner.query(`CREATE TYPE "public"."cardMatchs_type_enum" AS ENUM('teen20', 'card32', 'lucky7', 'abj', 'dt20')`);
        await queryRunner.query(`CREATE TABLE "cardMatchs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createBy" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "name" character varying NOT NULL, "type" "public"."cardMatchs_type_enum" NOT NULL, "minBet" double precision NOT NULL DEFAULT '0', "maxBet" double precision NOT NULL DEFAULT '1', CONSTRAINT "PK_8c9f923b259530f9f9349f76fce" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "cardMatch_type" ON "cardMatchs" ("type") `);
    }

    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX "public"."cardMatch_type"`);
        await queryRunner.query(`DROP TABLE "cardMatchs"`);
        await queryRunner.query(`DROP TYPE "public"."cardMatchs_type_enum"`);
    }
}
