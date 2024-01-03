const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class AddMarketBetType1704261125883 {
    name = 'AddMarketBetType1704261125883'

    async up(queryRunner) {
        await queryRunner.query(`CREATE TYPE "public"."betPlaceds_marketbettype_enum" AS ENUM('SESSION', 'MATCHBETTING')`);
        await queryRunner.query(`ALTER TABLE "betPlaceds" ADD "marketBetType" "public"."betPlaceds_marketbettype_enum"`);
        await queryRunner.query(`ALTER TABLE "betPlaceds" DROP COLUMN "marketType"`);
        await queryRunner.query(`DROP TYPE "public"."betPlaceds_markettype_enum"`);
        await queryRunner.query(`ALTER TABLE "betPlaceds" ADD "marketType" character varying NOT NULL`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "betPlaceds" DROP COLUMN "marketType"`);
        await queryRunner.query(`CREATE TYPE "public"."betPlaceds_markettype_enum" AS ENUM('SESSION', 'MATCHBETTING')`);
        await queryRunner.query(`ALTER TABLE "betPlaceds" ADD "marketType" "public"."betPlaceds_markettype_enum" NOT NULL DEFAULT 'MATCHBETTING'`);
        await queryRunner.query(`ALTER TABLE "betPlaceds" DROP COLUMN "marketBetType"`);
        await queryRunner.query(`DROP TYPE "public"."betPlaceds_marketbettype_enum"`);
    }
}
