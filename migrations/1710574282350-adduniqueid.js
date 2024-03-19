const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class Adduniqueid1710574282350 {
    name = 'Adduniqueid1710574282350'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "transactions" ADD "uniqueId" integer`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "uniqueId"`);
    }
}
