const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class RemoveUnique1707299246208 {
    name = 'RemoveUnique1707299246208'

    async up(queryRunner) {
        await queryRunner.query(`DROP INDEX "public"."button_createBy"`);
        await queryRunner.query(`CREATE INDEX "button_createBy" ON "buttons" ("createBy") `);
    }

    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX "public"."button_createBy"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "button_createBy" ON "buttons" ("createBy") `);
    }
}
