const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class Agent1706524424057 {
    name = 'Agent1706524424057'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "users" ADD "agPartnership" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TYPE "public"."users_rolename_enum" RENAME TO "users_rolename_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."users_rolename_enum" AS ENUM('fairGameWallet', 'fairGameAdmin', 'superAdmin', 'admin', 'superMaster', 'master', 'agent', 'expert', 'user')`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "roleName" TYPE "public"."users_rolename_enum" USING "roleName"::"text"::"public"."users_rolename_enum"`);
        await queryRunner.query(`DROP TYPE "public"."users_rolename_enum_old"`);
    }

    async down(queryRunner) {
        await queryRunner.query(`CREATE TYPE "public"."users_rolename_enum_old" AS ENUM('fairGameWallet', 'fairGameAdmin', 'superAdmin', 'admin', 'superMaster', 'master', 'expert', 'user')`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "roleName" TYPE "public"."users_rolename_enum_old" USING "roleName"::"text"::"public"."users_rolename_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."users_rolename_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."users_rolename_enum_old" RENAME TO "users_rolename_enum"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "agPartnership"`);
    }
}
