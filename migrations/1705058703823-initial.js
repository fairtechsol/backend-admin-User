const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class Initial1705058703823 {
    name = 'Initial1705058703823'

    async up(queryRunner) {
        await queryRunner.query(`CREATE TYPE "public"."betPlaceds_bettype_enum" AS ENUM('YES', 'NO', 'BACK', 'LAY')`);
        await queryRunner.query(`CREATE TYPE "public"."betPlaceds_marketbettype_enum" AS ENUM('SESSION', 'MATCHBETTING')`);
        await queryRunner.query(`CREATE TABLE "betPlaceds" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createBy" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "matchId" uuid NOT NULL, "betId" uuid, "result" character varying, "teamName" character varying, "amount" numeric(13,2) NOT NULL DEFAULT '0', "odds" numeric(13,2) NOT NULL DEFAULT '0', "winAmount" numeric(13,2) NOT NULL DEFAULT '0', "lossAmount" numeric(13,2) NOT NULL DEFAULT '0', "betType" "public"."betPlaceds_bettype_enum" NOT NULL DEFAULT 'YES', "rate" numeric(13,2) NOT NULL DEFAULT '0', "marketType" character varying NOT NULL, "marketBetType" "public"."betPlaceds_marketbettype_enum", "deleteReason" character varying, "ipAddress" character varying, "browserDetail" character varying, "eventName" character varying, "eventType" character varying, "userId" uuid, CONSTRAINT "PK_9c485987c2b7a57f31b0c230abf" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "betPlaced_createBy" ON "betPlaceds" ("createBy") `);
        await queryRunner.query(`CREATE TABLE "buttons" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createBy" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "type" character varying NOT NULL, "value" character varying NOT NULL, CONSTRAINT "REL_1b57705131901411bf9ad8f965" UNIQUE ("createBy"), CONSTRAINT "PK_0b55de60f80b00823be7aff0de2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "button_createBy" ON "buttons" ("createBy") `);
        await queryRunner.query(`CREATE TABLE "domainDatas" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createBy" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "userName" character varying NOT NULL, "userId" character varying NOT NULL, "domain" character varying NOT NULL, "logo" character varying NOT NULL, "headerColor" character varying NOT NULL, "sidebarColor" character varying NOT NULL, "footerColor" character varying NOT NULL, CONSTRAINT "UQ_dc1771716744efdb1f7e2bc9a11" UNIQUE ("userName"), CONSTRAINT "UQ_c62ed60e7bf39701fa04e9231fb" UNIQUE ("userId"), CONSTRAINT "UQ_dddffea7d991f34ee1fec1606dc" UNIQUE ("domain"), CONSTRAINT "PK_406ca0536868a588bbdf6ea4e52" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "domainData_userName" ON "domainDatas" ("id", "userName") `);
        await queryRunner.query(`CREATE TABLE "systemTables" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createBy" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "type" character varying NOT NULL, "value" character varying, CONSTRAINT "PK_c70d94890c6018a3a4ad2d01a56" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "systemTable_type" ON "systemTables" ("type") `);
        await queryRunner.query(`CREATE TYPE "public"."transactions_transtype_enum" AS ENUM('add', 'withDraw', 'win', 'loss', 'creditReference', 'bet')`);
        await queryRunner.query(`CREATE TABLE "transactions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createBy" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "searchId" uuid NOT NULL, "userId" uuid NOT NULL, "actionBy" uuid NOT NULL, "amount" numeric(13,2) NOT NULL DEFAULT '0', "closingBalance" numeric(13,2) NOT NULL DEFAULT '0', "transType" "public"."transactions_transtype_enum" NOT NULL, "description" character varying, "matchId" uuid, "betId" uuid, "actionByUserId" uuid, CONSTRAINT "PK_a219afd8dd77ed80f5a862f1db9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "transaction_searchId" ON "transactions" ("searchId") `);
        await queryRunner.query(`CREATE TYPE "public"."users_rolename_enum" AS ENUM('fairGameWallet', 'fairGameAdmin', 'superAdmin', 'admin', 'superMaster', 'master', 'expert', 'user')`);
        await queryRunner.query(`CREATE TYPE "public"."users_matchcomissiontype_enum" AS ENUM('totalLoss', 'entryWise')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createBy" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "userName" character varying NOT NULL, "fullName" character varying, "password" character varying NOT NULL, "transPassword" character varying, "phoneNumber" character varying, "city" character varying, "roleName" "public"."users_rolename_enum" NOT NULL, "userBlock" boolean NOT NULL DEFAULT false, "betBlock" boolean NOT NULL DEFAULT false, "userBlockedBy" uuid, "betBlockedBy" uuid, "fwPartnership" integer NOT NULL DEFAULT '0', "faPartnership" integer NOT NULL DEFAULT '0', "saPartnership" integer NOT NULL DEFAULT '0', "aPartnership" integer NOT NULL DEFAULT '0', "smPartnership" integer NOT NULL DEFAULT '0', "mPartnership" integer NOT NULL DEFAULT '0', "exposureLimit" numeric(13,2) NOT NULL DEFAULT '0', "maxBetLimit" numeric(13,2) NOT NULL DEFAULT '0', "minBetLimit" numeric(13,2) NOT NULL DEFAULT '0', "creditRefrence" numeric(13,2) NOT NULL DEFAULT '0', "downLevelCreditRefrence" numeric(13,2) NOT NULL DEFAULT '0', "sessionCommission" double precision NOT NULL DEFAULT '0', "matchComissionType" "public"."users_matchcomissiontype_enum", "matchCommission" double precision NOT NULL DEFAULT '0', "totalComission" numeric(13,2) NOT NULL DEFAULT '0', "delayTime" integer NOT NULL DEFAULT '5', "loginAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_226bb9aa7aa8a69991209d58f59" UNIQUE ("userName"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "user_userName" ON "users" ("id", "userName") `);
        await queryRunner.query(`CREATE TABLE "userBalances" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "currentBalance" numeric(13,2) NOT NULL DEFAULT '0', "exposure" numeric(13,2) NOT NULL DEFAULT '0', "userId" uuid NOT NULL, "profitLoss" numeric(13,2) NOT NULL DEFAULT '0', "myProfitLoss" numeric(13,2) NOT NULL DEFAULT '0', "downLevelBalance" numeric(13,2) NOT NULL DEFAULT '0', CONSTRAINT "UQ_e0d46cb3619d6665866b54577ed" UNIQUE ("userId"), CONSTRAINT "REL_e0d46cb3619d6665866b54577e" UNIQUE ("userId"), CONSTRAINT "PK_e7210fe11b45cc7d53a3a8d35b8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "userBalance_userId" ON "userBalances" ("userId") `);
        await queryRunner.query(`CREATE TABLE "userBlocks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createBy" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "userId" uuid NOT NULL, "userBlock" boolean NOT NULL DEFAULT false, "betBlock" boolean NOT NULL DEFAULT false, "isWalletBlock" boolean NOT NULL DEFAULT false, "createByUserId" uuid, CONSTRAINT "PK_52e8dd5bce8498aa217cd00d231" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "userBlock_createBy" ON "userBlocks" ("userId", "createBy") `);
        await queryRunner.query(`ALTER TABLE "betPlaceds" ADD CONSTRAINT "FK_1ef4b3f1ca161060220e07c995f" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "buttons" ADD CONSTRAINT "FK_1b57705131901411bf9ad8f9658" FOREIGN KEY ("createBy") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD CONSTRAINT "FK_6bb58f2b6e30cb51a6504599f41" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD CONSTRAINT "FK_8cd147a85d1b45cfbff10260ed1" FOREIGN KEY ("actionByUserId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "userBalances" ADD CONSTRAINT "FK_e0d46cb3619d6665866b54577ed" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "userBlocks" ADD CONSTRAINT "FK_dc964badd00bdb1f7db17b13ad8" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "userBlocks" ADD CONSTRAINT "FK_c480b9fc061f8fe2eb1192f929d" FOREIGN KEY ("createByUserId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "userBlocks" DROP CONSTRAINT "FK_c480b9fc061f8fe2eb1192f929d"`);
        await queryRunner.query(`ALTER TABLE "userBlocks" DROP CONSTRAINT "FK_dc964badd00bdb1f7db17b13ad8"`);
        await queryRunner.query(`ALTER TABLE "userBalances" DROP CONSTRAINT "FK_e0d46cb3619d6665866b54577ed"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT "FK_8cd147a85d1b45cfbff10260ed1"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT "FK_6bb58f2b6e30cb51a6504599f41"`);
        await queryRunner.query(`ALTER TABLE "buttons" DROP CONSTRAINT "FK_1b57705131901411bf9ad8f9658"`);
        await queryRunner.query(`ALTER TABLE "betPlaceds" DROP CONSTRAINT "FK_1ef4b3f1ca161060220e07c995f"`);
        await queryRunner.query(`DROP INDEX "public"."userBlock_createBy"`);
        await queryRunner.query(`DROP TABLE "userBlocks"`);
        await queryRunner.query(`DROP INDEX "public"."userBalance_userId"`);
        await queryRunner.query(`DROP TABLE "userBalances"`);
        await queryRunner.query(`DROP INDEX "public"."user_userName"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."users_matchcomissiontype_enum"`);
        await queryRunner.query(`DROP TYPE "public"."users_rolename_enum"`);
        await queryRunner.query(`DROP INDEX "public"."transaction_searchId"`);
        await queryRunner.query(`DROP TABLE "transactions"`);
        await queryRunner.query(`DROP TYPE "public"."transactions_transtype_enum"`);
        await queryRunner.query(`DROP INDEX "public"."systemTable_type"`);
        await queryRunner.query(`DROP TABLE "systemTables"`);
        await queryRunner.query(`DROP INDEX "public"."domainData_userName"`);
        await queryRunner.query(`DROP TABLE "domainDatas"`);
        await queryRunner.query(`DROP INDEX "public"."button_createBy"`);
        await queryRunner.query(`DROP TABLE "buttons"`);
        await queryRunner.query(`DROP INDEX "public"."betPlaced_createBy"`);
        await queryRunner.query(`DROP TABLE "betPlaceds"`);
        await queryRunner.query(`DROP TYPE "public"."betPlaceds_marketbettype_enum"`);
        await queryRunner.query(`DROP TYPE "public"."betPlaceds_bettype_enum"`);
    }
}
