const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class Virtualcasino1732000702076 {
    name = 'Virtualcasino1732000702076'

    async up(queryRunner) {
        await queryRunner.query(`CREATE TABLE "virtualCasinoBetPlaceds" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createBy" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "betType" character varying NOT NULL, "amount" integer NOT NULL, "gameId" character varying NOT NULL, "operatorId" character varying, "reqId" character varying, "roundId" character varying, "runnerName" character varying, "token" character varying, "transactionId" character varying, "userId" uuid NOT NULL, CONSTRAINT "PK_f009fce00e88977f37066192f42" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "user_userId" ON "virtualCasinoBetPlaceds" ("id", "userId") `);
    }

    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX "public"."user_userId"`);
        await queryRunner.query(`DROP TABLE "virtualCasinoBetPlaceds"`);
    }
}
