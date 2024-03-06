const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class Initial1709728206496 {
    name = 'Initial1709728206496'

    async up(queryRunner) {
        await queryRunner.query(`CREATE TABLE "userMatchLocks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "blockBy" uuid NOT NULL, "matchId" uuid NOT NULL, "matchLock" boolean NOT NULL DEFAULT false, "sessionLock" boolean NOT NULL DEFAULT false, "isWalletLock" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_2d306e91e74af8a15328eddb256" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "userBalances" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "currentBalance" numeric(13,2) NOT NULL DEFAULT '0', "exposure" numeric(13,2) NOT NULL DEFAULT '0', "userId" uuid NOT NULL, "profitLoss" numeric(13,2) NOT NULL DEFAULT '0', "myProfitLoss" numeric(13,2) NOT NULL DEFAULT '0', "downLevelBalance" numeric(13,2) NOT NULL DEFAULT '0', "totalCommission" numeric(13,2) NOT NULL DEFAULT '0', CONSTRAINT "UQ_e0d46cb3619d6665866b54577ed" UNIQUE ("userId"), CONSTRAINT "REL_e0d46cb3619d6665866b54577e" UNIQUE ("userId"), CONSTRAINT "PK_e7210fe11b45cc7d53a3a8d35b8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "userBalance_userId" ON "userBalances" ("userId") `);
        await queryRunner.query(`CREATE TYPE "public"."users_rolename_enum" AS ENUM('fairGameWallet', 'fairGameAdmin', 'superAdmin', 'admin', 'superMaster', 'master', 'agent', 'expert', 'user')`);
        await queryRunner.query(`CREATE TYPE "public"."users_matchcomissiontype_enum" AS ENUM('totalLoss', 'entryWise', 'settled')`);
        await queryRunner.query(`CREATE TYPE "public"."users_superparenttype_enum" AS ENUM('fairGameAdmin', 'fairGameWallet')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createBy" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "userName" character varying NOT NULL, "fullName" character varying, "password" character varying NOT NULL, "transPassword" character varying, "phoneNumber" character varying, "city" character varying, "remark" character varying, "roleName" "public"."users_rolename_enum" NOT NULL, "userBlock" boolean NOT NULL DEFAULT false, "betBlock" boolean NOT NULL DEFAULT false, "userBlockedBy" uuid, "betBlockedBy" uuid, "fwPartnership" integer NOT NULL DEFAULT '0', "faPartnership" integer NOT NULL DEFAULT '0', "saPartnership" integer NOT NULL DEFAULT '0', "aPartnership" integer NOT NULL DEFAULT '0', "smPartnership" integer NOT NULL DEFAULT '0', "mPartnership" integer NOT NULL DEFAULT '0', "agPartnership" integer NOT NULL DEFAULT '0', "exposureLimit" numeric(13,2) NOT NULL DEFAULT '0', "maxBetLimit" numeric(13,2) NOT NULL DEFAULT '0', "minBetLimit" numeric(13,2) NOT NULL DEFAULT '0', "creditRefrence" numeric(13,2) NOT NULL DEFAULT '0', "downLevelCreditRefrence" numeric(13,2) NOT NULL DEFAULT '0', "sessionCommission" double precision NOT NULL DEFAULT '0', "matchComissionType" "public"."users_matchcomissiontype_enum", "matchCommission" double precision NOT NULL DEFAULT '0', "superParentId" uuid, "superParentType" "public"."users_superparenttype_enum", "delayTime" integer NOT NULL DEFAULT '5', "loginAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_226bb9aa7aa8a69991209d58f59" UNIQUE ("userName"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "user_userName" ON "users" ("id", "userName") `);
        await queryRunner.query(`CREATE TYPE "public"."transactions_transtype_enum" AS ENUM('add', 'withDraw', 'win', 'loss', 'creditReference', 'bet')`);
        await queryRunner.query(`CREATE TABLE "transactions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createBy" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "searchId" uuid NOT NULL, "userId" uuid NOT NULL, "actionBy" uuid NOT NULL, "amount" numeric(13,2) NOT NULL DEFAULT '0', "closingBalance" numeric(13,2) NOT NULL DEFAULT '0', "transType" "public"."transactions_transtype_enum" NOT NULL, "description" character varying, "matchId" uuid, "betId" uuid, "actionByUserId" uuid, CONSTRAINT "PK_a219afd8dd77ed80f5a862f1db9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "transaction_searchId" ON "transactions" ("searchId") `);
        await queryRunner.query(`CREATE TABLE "systemTables" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createBy" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "type" character varying NOT NULL, "value" character varying, CONSTRAINT "PK_c70d94890c6018a3a4ad2d01a56" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "systemTable_type" ON "systemTables" ("type") `);
        await queryRunner.query(`CREATE TABLE "matchs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createBy" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "matchType" character varying(50) NOT NULL, "competitionId" character varying NOT NULL, "competitionName" character varying NOT NULL, "title" character varying(100) NOT NULL, "marketId" character varying NOT NULL, "eventId" character varying NOT NULL, "teamA" character varying(100) NOT NULL, "teamB" character varying(100) NOT NULL, "teamC" character varying(100), "startAt" TIMESTAMP WITH TIME ZONE NOT NULL, "stopAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_8afa35a9cde7e34e88d400dd96d" UNIQUE ("marketId"), CONSTRAINT "PK_0fdbc8e05ccfb9533008b132189" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "match_marketId" ON "matchs" ("marketId", "matchType") `);
        await queryRunner.query(`CREATE TABLE "domainDatas" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createBy" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "userName" character varying NOT NULL, "userId" character varying NOT NULL, "domain" character varying NOT NULL, "logo" character varying NOT NULL, "headerColor" character varying NOT NULL, "sidebarColor" character varying NOT NULL, "footerColor" character varying NOT NULL, CONSTRAINT "UQ_dc1771716744efdb1f7e2bc9a11" UNIQUE ("userName"), CONSTRAINT "UQ_c62ed60e7bf39701fa04e9231fb" UNIQUE ("userId"), CONSTRAINT "UQ_dddffea7d991f34ee1fec1606dc" UNIQUE ("domain"), CONSTRAINT "PK_406ca0536868a588bbdf6ea4e52" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "domainData_userName" ON "domainDatas" ("id", "userName") `);
        await queryRunner.query(`CREATE TYPE "public"."commissions_commissiontype_enum" AS ENUM('totalLoss', 'entryWise', 'settled')`);
        await queryRunner.query(`CREATE TABLE "commissions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createBy" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "matchId" uuid, "betId" uuid, "betPlaceId" uuid, "commissionAmount" numeric(13,2) NOT NULL DEFAULT '0', "commissionType" "public"."commissions_commissiontype_enum", "parentId" uuid NOT NULL, "settled" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_2701379966e2e670bb5ff0ae78e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "buttons" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createBy" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "type" character varying NOT NULL, "value" character varying NOT NULL, CONSTRAINT "PK_0b55de60f80b00823be7aff0de2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "button_createBy" ON "buttons" ("createBy") `);
        await queryRunner.query(`CREATE TYPE "public"."betPlaceds_bettype_enum" AS ENUM('YES', 'NO', 'BACK', 'LAY')`);
        await queryRunner.query(`CREATE TYPE "public"."betPlaceds_marketbettype_enum" AS ENUM('SESSION', 'MATCHBETTING')`);
        await queryRunner.query(`CREATE TABLE "betPlaceds" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createBy" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "matchId" uuid NOT NULL, "betId" uuid, "result" character varying, "teamName" character varying, "amount" numeric(13,2) NOT NULL DEFAULT '0', "odds" numeric(13,2) NOT NULL DEFAULT '0', "winAmount" numeric(13,2) NOT NULL DEFAULT '0', "lossAmount" numeric(13,2) NOT NULL DEFAULT '0', "betType" "public"."betPlaceds_bettype_enum" NOT NULL DEFAULT 'YES', "rate" numeric(13,2) NOT NULL DEFAULT '0', "marketType" character varying NOT NULL, "marketBetType" "public"."betPlaceds_marketbettype_enum", "deleteReason" character varying, "ipAddress" character varying, "browserDetail" character varying, "eventName" character varying, "eventType" character varying, "bettingName" character varying, "userId" uuid, CONSTRAINT "PK_9c485987c2b7a57f31b0c230abf" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "betPlaced_createBy" ON "betPlaceds" ("createBy") `);
        await queryRunner.query(`ALTER TABLE "userBalances" ADD CONSTRAINT "FK_e0d46cb3619d6665866b54577ed" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD CONSTRAINT "FK_6bb58f2b6e30cb51a6504599f41" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD CONSTRAINT "FK_8cd147a85d1b45cfbff10260ed1" FOREIGN KEY ("actionByUserId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "betPlaceds" ADD CONSTRAINT "FK_1ef4b3f1ca161060220e07c995f" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "betPlaceds" DROP CONSTRAINT "FK_1ef4b3f1ca161060220e07c995f"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT "FK_8cd147a85d1b45cfbff10260ed1"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT "FK_6bb58f2b6e30cb51a6504599f41"`);
        await queryRunner.query(`ALTER TABLE "userBalances" DROP CONSTRAINT "FK_e0d46cb3619d6665866b54577ed"`);
        await queryRunner.query(`DROP INDEX "public"."betPlaced_createBy"`);
        await queryRunner.query(`DROP TABLE "betPlaceds"`);
        await queryRunner.query(`DROP TYPE "public"."betPlaceds_marketbettype_enum"`);
        await queryRunner.query(`DROP TYPE "public"."betPlaceds_bettype_enum"`);
        await queryRunner.query(`DROP INDEX "public"."button_createBy"`);
        await queryRunner.query(`DROP TABLE "buttons"`);
        await queryRunner.query(`DROP TABLE "commissions"`);
        await queryRunner.query(`DROP TYPE "public"."commissions_commissiontype_enum"`);
        await queryRunner.query(`DROP INDEX "public"."domainData_userName"`);
        await queryRunner.query(`DROP TABLE "domainDatas"`);
        await queryRunner.query(`DROP INDEX "public"."match_marketId"`);
        await queryRunner.query(`DROP TABLE "matchs"`);
        await queryRunner.query(`DROP INDEX "public"."systemTable_type"`);
        await queryRunner.query(`DROP TABLE "systemTables"`);
        await queryRunner.query(`DROP INDEX "public"."transaction_searchId"`);
        await queryRunner.query(`DROP TABLE "transactions"`);
        await queryRunner.query(`DROP TYPE "public"."transactions_transtype_enum"`);
        await queryRunner.query(`DROP INDEX "public"."user_userName"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."users_superparenttype_enum"`);
        await queryRunner.query(`DROP TYPE "public"."users_matchcomissiontype_enum"`);
        await queryRunner.query(`DROP TYPE "public"."users_rolename_enum"`);
        await queryRunner.query(`DROP INDEX "public"."userBalance_userId"`);
        await queryRunner.query(`DROP TABLE "userBalances"`);
        await queryRunner.query(`DROP TABLE "userMatchLocks"`);
    }
}
