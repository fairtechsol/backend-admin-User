const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class Tournament1726207684541 {
    name = 'Tournament1726207684541'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "matchs" ALTER COLUMN "teamB" DROP NOT NULL`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "matchs" ALTER COLUMN "teamB" SET NOT NULL`);
    }
}
