const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class CardType1719212607436 {
    name = 'CardType1719212607436'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TYPE "public"."cardMatchs_type_enum" RENAME TO "cardMatchs_type_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."cardMatchs_type_enum" AS ENUM('dt20', 'teen20', 'card32', 'lucky7', 'abj', 'dt202', 'dtl20', 'dt6', 'lucky7eu', 'teen', 'teen9', 'teen8', 'poker', 'poker20', 'poker6', 'baccarat', 'baccarat2', 'card32eu', 'ab20', '3cardj', 'war', 'worli2', 'superover', 'cmatch20', 'aaa', 'btable', 'race20', 'cricketv3')`);
        await queryRunner.query(`ALTER TABLE "cardMatchs" ALTER COLUMN "type" TYPE "public"."cardMatchs_type_enum" USING "type"::"text"::"public"."cardMatchs_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."cardMatchs_type_enum_old"`);
    }

    async down(queryRunner) {
        await queryRunner.query(`CREATE TYPE "public"."cardMatchs_type_enum_old" AS ENUM('teen20', 'card32', 'lucky7', 'abj', 'dt20')`);
        await queryRunner.query(`ALTER TABLE "cardMatchs" ALTER COLUMN "type" TYPE "public"."cardMatchs_type_enum_old" USING "type"::"text"::"public"."cardMatchs_type_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."cardMatchs_type_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."cardMatchs_type_enum_old" RENAME TO "cardMatchs_type_enum"`);
    }
}
