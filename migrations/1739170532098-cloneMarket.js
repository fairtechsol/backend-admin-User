const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class CloneMarket1739170532098 {
    name = 'CloneMarket1739170532098'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "betPlaceds" ADD "childBetId" uuid`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "betPlaceds" DROP COLUMN "childBetId"`);
    }
}
