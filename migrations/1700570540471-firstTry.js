const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class FirstTry1700570540471 {
    name = 'FirstTry1700570540471'

    async up(queryRunner) {
        await queryRunner.query(`CREATE TYPE "public"."users_rolename_enum" AS ENUM('fairGameWallet', 'fairGameAdmin', 'superAdmin', 'admin', 'superMaster', 'master', 'user', 'expert')`);
        await queryRunner.query(`CREATE TYPE "public"."users_matchcomissiontype_enum" AS ENUM('totalLoss', 'entryWise')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "userName" character varying NOT NULL, "fullName" character varying, "password" character varying NOT NULL, "transPassword" character varying, "phoneNumber" character varying, "city" character varying, "roleName" "public"."users_rolename_enum" NOT NULL, "userBlock" boolean NOT NULL DEFAULT false, "betBlock" boolean NOT NULL DEFAULT false, "fwPartnership" integer NOT NULL DEFAULT '0', "faPartnership" integer NOT NULL DEFAULT '0', "saPartnership" integer NOT NULL DEFAULT '0', "aPartnership" integer NOT NULL DEFAULT '0', "smPartnership" integer NOT NULL DEFAULT '0', "mPartnership" integer NOT NULL DEFAULT '0', "exposureLimit" numeric(13,2) NOT NULL DEFAULT '0', "maxBetLimit" numeric(13,2) NOT NULL DEFAULT '0', "minBetLimit" numeric(13,2) NOT NULL DEFAULT '0', "creditRefrence" numeric(13,2) NOT NULL DEFAULT '0', "downLevelCreditRefrence" numeric(13,2) NOT NULL DEFAULT '0', "sessionCommission" double precision NOT NULL DEFAULT '0', "matchComissionType" "public"."users_matchcomissiontype_enum", "matchCommission" double precision NOT NULL DEFAULT '0', "totalComission" numeric(13,2) NOT NULL DEFAULT '0', "delayTime" integer NOT NULL DEFAULT '5', CONSTRAINT "UQ_226bb9aa7aa8a69991209d58f59" UNIQUE ("userName"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "user_userName" ON "users" ("id", "userName") `);
        await queryRunner.query(`CREATE TABLE "userBalances" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "currentBalance" numeric(13,2) NOT NULL DEFAULT '0', "exposure" numeric(13,2) NOT NULL DEFAULT '0', "userId" uuid NOT NULL, "profitLoss" numeric(13,2) NOT NULL DEFAULT '0', "myProfitLoss" numeric(13,2) NOT NULL DEFAULT '0', "downLevelBalance" numeric(13,2) NOT NULL DEFAULT '0', CONSTRAINT "UQ_e0d46cb3619d6665866b54577ed" UNIQUE ("userId"), CONSTRAINT "REL_e0d46cb3619d6665866b54577e" UNIQUE ("userId"), CONSTRAINT "PK_e7210fe11b45cc7d53a3a8d35b8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "userBalance_userId" ON "userBalances" ("id", "userId") `);
        await queryRunner.query(`ALTER TABLE "userBalances" ADD CONSTRAINT "FK_e0d46cb3619d6665866b54577ed" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "userBalances" DROP CONSTRAINT "FK_e0d46cb3619d6665866b54577ed"`);
        await queryRunner.query(`DROP INDEX "public"."userBalance_userId"`);
        await queryRunner.query(`DROP TABLE "userBalances"`);
        await queryRunner.query(`DROP INDEX "public"."user_userName"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."users_matchcomissiontype_enum"`);
        await queryRunner.query(`DROP TYPE "public"."users_rolename_enum"`);
    }
}
