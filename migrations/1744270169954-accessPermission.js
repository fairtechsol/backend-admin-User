const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class AccessPermission1744270169954 {
    name = 'AccessPermission1744270169954'

    async up(queryRunner) {
        await queryRunner.query(`CREATE TABLE "permissions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createBy" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "all" boolean NOT NULL DEFAULT false, "dashboard" boolean NOT NULL DEFAULT false, "marketAnalysis" boolean NOT NULL DEFAULT false, "userList" boolean NOT NULL DEFAULT false, "insertUser" boolean NOT NULL DEFAULT false, "accountStatement" boolean NOT NULL DEFAULT false, "partyWinLoss" boolean NOT NULL DEFAULT false, "currentBets" boolean NOT NULL DEFAULT false, "casinoResult" boolean NOT NULL DEFAULT false, "liveCasinoResult" boolean NOT NULL DEFAULT false, "ourCasino" boolean NOT NULL DEFAULT false, "events" boolean NOT NULL DEFAULT false, "marketSearchAnalysis" boolean NOT NULL DEFAULT false, "loginUserCreation" boolean NOT NULL DEFAULT false, "withdraw" boolean NOT NULL DEFAULT false, "deposit" boolean NOT NULL DEFAULT false, "creditReference" boolean NOT NULL DEFAULT false, "userInfo" boolean NOT NULL DEFAULT false, "userPasswordChange" boolean NOT NULL DEFAULT false, "userLock" boolean NOT NULL DEFAULT false, "betLock" boolean NOT NULL DEFAULT false, "activeUser" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_920331560282b8bd21bb02290df" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "accessUsers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createBy" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "userName" character varying NOT NULL, "fullName" character varying, "password" character varying NOT NULL, "transPassword" character varying, "userBlock" boolean NOT NULL DEFAULT false, "userBlockedBy" uuid, "loginAt" TIMESTAMP WITH TIME ZONE, "parentId" uuid NOT NULL, "mainParentId" uuid NOT NULL, "permission" uuid NOT NULL, CONSTRAINT "UQ_e5ecd2f70ab1863ae21a94b2405" UNIQUE ("userName"), CONSTRAINT "PK_b0e30c42ae69a0d39cdab5c63a4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "access_user_userName" ON "accessUsers" ("userName") `);
        await queryRunner.query(`ALTER TABLE "accessUsers" ADD "transactionPasswordAttempts" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`CREATE INDEX "permissions_createBy" ON "permissions" ("createBy") `);
    }

    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX "public"."access_user_userName"`);
        await queryRunner.query(`DROP TABLE "accessUsers"`);
        await queryRunner.query(`DROP TABLE "permissions"`);
        await queryRunner.query(`ALTER TABLE "accessUsers" DROP COLUMN "transactionPasswordAttempts"`);
        await queryRunner.query(`DROP INDEX "public"."permissions_createBy"`);
    }
}
