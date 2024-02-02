const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class UserTable1706788962303 {
    name = 'UserTable1706788962303'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "totalComission"`);
        await queryRunner.query(`ALTER TABLE "userBalances" ADD "totalCommission" numeric(13,2) NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "users" ADD "superParentId" uuid`);
        await queryRunner.query(`CREATE TYPE "public"."users_superparenttype_enum" AS ENUM('fairGameAdmin', 'fairGameWallet')`);
        await queryRunner.query(`ALTER TABLE "users" ADD "superParentType" "public"."users_superparenttype_enum"`);
        await queryRunner.query(`ALTER TABLE "commissions" ADD "parentId" uuid NOT NULL`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "commissions" DROP COLUMN "parentId"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "superParentType"`);
        await queryRunner.query(`DROP TYPE "public"."users_superparenttype_enum"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "superParentId"`);
        await queryRunner.query(`ALTER TABLE "userBalances" DROP COLUMN "totalCommission"`);
        await queryRunner.query(`ALTER TABLE "users" ADD "totalComission" numeric(13,2) NOT NULL DEFAULT '0'`);
    }
}
