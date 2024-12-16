const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class SessionCommission1734085515421 {
    name = 'SessionCommission1734085515421'

    async up(queryRunner) {
        await queryRunner.query(`CREATE TYPE "public"."commissions_matchtype_enum" AS ENUM('SESSION', 'MATCHBETTING', 'RACING', 'CARD')`);
        await queryRunner.query(`ALTER TABLE "commissions" ADD "matchType" "public"."commissions_matchtype_enum"`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "commissions" DROP COLUMN "matchType"`);
        await queryRunner.query(`DROP TYPE "public"."commissions_matchtype_enum"`);
    }
}
