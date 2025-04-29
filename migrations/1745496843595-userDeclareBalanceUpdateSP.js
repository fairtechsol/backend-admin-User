const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class UserDeclareBalanceUpdateSP1745496843595 {
    name = 'UserDeclareBalanceUpdateSP1745496843595'

    async up(queryRunner) {
        await queryRunner.query(`
CREATE OR REPLACE FUNCTION "updateUserBalancesBatch"(pUpdates JSONB)
RETURNS VOID
LANGUAGE SQL
AS $$
  UPDATE "userBalances" ub
  SET
    "currentBalance"  = COALESCE(ub."currentBalance", 0) + d.balanceDelta,
    "profitLoss"      = COALESCE(ub."profitLoss", 0) + d.profitLossDelta,
    "myProfitLoss"    = COALESCE(ub."myProfitLoss", 0) + d.myProfitLossDelta,
    "exposure"        = GREATEST(COALESCE(ub."exposure", 0) + d.exposureDelta, 0),
    "totalCommission" = COALESCE(ub."totalCommission", 0) + d.commissionDelta
  FROM (
    SELECT
      key::UUID AS userId,
      COALESCE((value->>'balance')::NUMERIC,(value->>'profitLoss')::NUMERIC, 0)        AS balanceDelta,
      COALESCE((value->>'profitLoss')::NUMERIC, 0)     AS profitLossDelta,
      COALESCE((value->>'myProfitLoss')::NUMERIC, 0)   AS myProfitLossDelta,
      COALESCE((value->>'exposure')::NUMERIC, 0)      AS exposureDelta,
      COALESCE((value->>'totalCommission')::NUMERIC, 0) AS commissionDelta
    FROM jsonb_each(pUpdates)
  ) AS d
  WHERE ub."userId" = d.userId;
$$;
`);
    }

    async down(queryRunner) {
        await queryRunner.query(`DROP FUNCTION IF EXISTS "updateUserBalancesBatch"(JSONB);`);
    }
}
