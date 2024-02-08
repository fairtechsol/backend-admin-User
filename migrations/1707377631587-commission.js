const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class Commission1707377631587 {
    name = 'Commission1707377631587'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "commissions" ADD "settled" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TYPE "public"."users_matchcomissiontype_enum" RENAME TO "users_matchcomissiontype_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."users_matchcomissiontype_enum" AS ENUM('totalLoss', 'entryWise', 'settled')`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "matchComissionType" TYPE "public"."users_matchcomissiontype_enum" USING "matchComissionType"::"text"::"public"."users_matchcomissiontype_enum"`);
        await queryRunner.query(`DROP TYPE "public"."users_matchcomissiontype_enum_old"`);
        await queryRunner.query(`ALTER TYPE "public"."commissions_commissiontype_enum" RENAME TO "commissions_commissiontype_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."commissions_commissiontype_enum" AS ENUM('totalLoss', 'entryWise', 'settled')`);
        await queryRunner.query(`ALTER TABLE "commissions" ALTER COLUMN "commissionType" TYPE "public"."commissions_commissiontype_enum" USING "commissionType"::"text"::"public"."commissions_commissiontype_enum"`);
        await queryRunner.query(`DROP TYPE "public"."commissions_commissiontype_enum_old"`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "buttons" DROP CONSTRAINT "FK_1b57705131901411bf9ad8f9658"`);
        await queryRunner.query(`ALTER TABLE "buttons" DROP CONSTRAINT "UQ_1b57705131901411bf9ad8f9658"`);
        await queryRunner.query(`CREATE TYPE "public"."commissions_commissiontype_enum_old" AS ENUM('totalLoss', 'entryWise')`);
        await queryRunner.query(`ALTER TABLE "commissions" ALTER COLUMN "commissionType" TYPE "public"."commissions_commissiontype_enum_old" USING "commissionType"::"text"::"public"."commissions_commissiontype_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."commissions_commissiontype_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."commissions_commissiontype_enum_old" RENAME TO "commissions_commissiontype_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."users_matchcomissiontype_enum_old" AS ENUM('totalLoss', 'entryWise')`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "matchComissionType" TYPE "public"."users_matchcomissiontype_enum_old" USING "matchComissionType"::"text"::"public"."users_matchcomissiontype_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."users_matchcomissiontype_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."users_matchcomissiontype_enum_old" RENAME TO "users_matchcomissiontype_enum"`);
        await queryRunner.query(`ALTER TABLE "commissions" DROP COLUMN "settled"`);
    }
}
