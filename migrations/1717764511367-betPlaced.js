const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class BetPlaced1717764511367 {
    name = 'BetPlaced1717764511367'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TYPE "public"."betPlaceds_marketbettype_enum" RENAME TO "betPlaceds_marketbettype_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."betPlaceds_marketbettype_enum" AS ENUM('SESSION', 'MATCHBETTING', 'RACING', 'CARD')`);
        await queryRunner.query(`ALTER TABLE "betPlaceds" ALTER COLUMN "marketBetType" TYPE "public"."betPlaceds_marketbettype_enum" USING "marketBetType"::"text"::"public"."betPlaceds_marketbettype_enum"`);
        await queryRunner.query(`DROP TYPE "public"."betPlaceds_marketbettype_enum_old"`);
    }

    async down(queryRunner) {
        await queryRunner.query(`CREATE TYPE "public"."betPlaceds_marketbettype_enum_old" AS ENUM('SESSION', 'MATCHBETTING', 'RACING')`);
        await queryRunner.query(`ALTER TABLE "betPlaceds" ALTER COLUMN "marketBetType" TYPE "public"."betPlaceds_marketbettype_enum_old" USING "marketBetType"::"text"::"public"."betPlaceds_marketbettype_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."betPlaceds_marketbettype_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."betPlaceds_marketbettype_enum_old" RENAME TO "betPlaceds_marketbettype_enum"`);
    }
}
