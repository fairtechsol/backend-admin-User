const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class Latest1701669661733 {
    name = 'Latest1701669661733'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TYPE "public"."transactions_transtype_enum" RENAME TO "transactions_transtype_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."transactions_transtype_enum" AS ENUM('add', 'withDraw', 'win', 'loss', 'creditReference')`);
        await queryRunner.query(`ALTER TABLE "transactions" ALTER COLUMN "transType" TYPE "public"."transactions_transtype_enum" USING "transType"::"text"::"public"."transactions_transtype_enum"`);
        await queryRunner.query(`DROP TYPE "public"."transactions_transtype_enum_old"`);
    }

    async down(queryRunner) {
        await queryRunner.query(`CREATE TYPE "public"."transactions_transtype_enum_old" AS ENUM('add', 'withDraw')`);
        await queryRunner.query(`ALTER TABLE "transactions" ALTER COLUMN "transType" TYPE "public"."transactions_transtype_enum_old" USING "transType"::"text"::"public"."transactions_transtype_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."transactions_transtype_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."transactions_transtype_enum_old" RENAME TO "transactions_transtype_enum"`);
    }
}
