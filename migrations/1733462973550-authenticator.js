const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class Authenticator1733462973550 {
    name = 'Authenticator1733462973550'

    async up(queryRunner) {
        await queryRunner.query(`CREATE TYPE "public"."userAuthenticators_type_enum" AS ENUM('1', '2')`);
        await queryRunner.query(`CREATE TABLE "userAuthenticators" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "deviceId" character varying NOT NULL, "type" "public"."userAuthenticators_type_enum" NOT NULL, CONSTRAINT "PK_7670cb8ff052fd646505f5e92cf" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "users" ADD "isAuthenticatorEnable" boolean NOT NULL DEFAULT false`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "isAuthenticatorEnable"`);
        await queryRunner.query(`DROP TABLE "userAuthenticators"`);
        await queryRunner.query(`DROP TYPE "public"."userAuthenticators_type_enum"`);
    }
}
