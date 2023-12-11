const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class Initial1702281831320 {
    name = 'Initial1702281831320'

    async up(queryRunner) {
        await queryRunner.query(`CREATE TABLE "domainDatas" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createBy" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "userName" character varying NOT NULL, "userId" character varying NOT NULL, "domain" character varying NOT NULL, "logo" character varying NOT NULL, "headerColor" character varying NOT NULL, "sidebarColor" character varying NOT NULL, "footerColor" character varying NOT NULL, CONSTRAINT "UQ_dc1771716744efdb1f7e2bc9a11" UNIQUE ("userName"), CONSTRAINT "UQ_c62ed60e7bf39701fa04e9231fb" UNIQUE ("userId"), CONSTRAINT "UQ_dddffea7d991f34ee1fec1606dc" UNIQUE ("domain"), CONSTRAINT "PK_406ca0536868a588bbdf6ea4e52" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "domainData_userName" ON "domainDatas" ("id", "userName") `);
    }

    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX "public"."domainData_userName"`);
        await queryRunner.query(`DROP TABLE "domainDatas"`);
    }
}
