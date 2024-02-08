const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class ButtonIndex1707393816258 {
    name = 'ButtonIndex1707393816258'

    async up(queryRunner) {
        await queryRunner.query(`CREATE INDEX "button_createBy" ON "buttons" ("createBy") `);
    }

    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX "public"."button_createBy"`);
    }
}
