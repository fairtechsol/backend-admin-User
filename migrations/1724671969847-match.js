const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class Match1724671969847 {
    name = 'Match1724671969847'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "matchs" ADD "isTv" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "matchs" ADD "isFancy" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "matchs" ADD "isBookmaker" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "matchs" ALTER COLUMN "competitionId" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "matchs" ALTER COLUMN "competitionName" DROP NOT NULL`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "matchs" ALTER COLUMN "competitionName" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "matchs" ALTER COLUMN "competitionId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "matchs" DROP COLUMN "isBookmaker"`);
        await queryRunner.query(`ALTER TABLE "matchs" DROP COLUMN "isFancy"`);
        await queryRunner.query(`ALTER TABLE "matchs" DROP COLUMN "isTv"`);
    }
}
