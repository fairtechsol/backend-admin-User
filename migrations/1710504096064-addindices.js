const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class Addindices1710504096064 {
    name = 'Addindices1710504096064'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "transactions" ADD "uniqueId" SERIAL NOT NULL`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "uniqueId"`);
    }
}
