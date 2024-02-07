const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class Removeindice1707309512202 {
    name = 'Removeindice1707309512202'

    async up(queryRunner) {
        await queryRunner.query(`DROP INDEX "public"."button_createBy"`);
        await queryRunner.query(`ALTER TABLE "buttons" ADD COLUMN "createBy1" uuid`);
        await queryRunner.query(`UPDATE "buttons" SET "createBy1" = "createBy"`);
        await queryRunner.query(`ALTER TABLE "buttons" DROP COLUMN "createBy"`);
        await queryRunner.query(`ALTER TABLE "buttons" ADD COLUMN "createBy" uuid`);
        await queryRunner.query(`UPDATE "buttons" SET "createBy" = "createBy1"`);
        await queryRunner.query(`ALTER TABLE "buttons" DROP COLUMN "createBy1"`);
        
    }

    async down(queryRunner) {
        await queryRunner.query(`CREATE INDEX "button_createBy" ON "buttons" ("createBy") `);
    }
}
