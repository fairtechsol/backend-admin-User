const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class Comission1706699953712 {
    name = 'Comission1706699953712'

    async up(queryRunner) {
        await queryRunner.query(`CREATE TYPE "public"."commissions_commissiontype_enum" AS ENUM('totalLoss', 'entryWise')`);
        await queryRunner.query(`CREATE TABLE "commissions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createBy" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "matchId" uuid, "betId" uuid, "betPlaceId" uuid NOT NULL, "commissionAmount" numeric(13) NOT NULL DEFAULT '0', "commissionType" "public"."commissions_commissiontype_enum", CONSTRAINT "PK_2701379966e2e670bb5ff0ae78e" PRIMARY KEY ("id"))`);
    }

    async down(queryRunner) {
        await queryRunner.query(`DROP TABLE "commissions"`);
        await queryRunner.query(`DROP TYPE "public"."commissions_commissiontype_enum"`);
    }
}
