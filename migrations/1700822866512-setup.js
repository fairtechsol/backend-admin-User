const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class Setup1700822866512 {
    name = 'Setup1700822866512'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "users" ADD "loginAt" TIMESTAMP WITH TIME ZONE`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "loginAt"`);
    }
}
