const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class UserTotalBalanceSP1745496843590 {
    name = 'UserTotalBalanceSP1745496843590'

    async up(queryRunner) {
        await queryRunner.query(`
CREATE OR REPLACE FUNCTION getUserTotalBalance(
  p_user_id UUID,
  p_role_name users_rolename_enum,
  p_user_block BOOLEAN DEFAULT NULL,
  p_bet_block BOOLEAN DEFAULT NULL,
  p_or_val BOOLEAN DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  total_balance JSON;
  child_balance NUMERIC;
  where_conditions TEXT := '';
  partnership_columns TEXT;
BEGIN
  PERFORM set_config('enable_nestloop', 'off', false);

  -- Build WHERE conditions using parameterized format
  WHERE_CONDITIONS := CONCAT(
    CASE WHEN p_user_block IS NOT NULL THEN ' AND p."userBlock" = $3' END,
    CASE WHEN p_bet_block IS NOT NULL THEN ' AND p."betBlock" = $4' END,
    CASE WHEN p_or_val THEN ' AND (p."betBlock" OR p."userBlock")' END
  );

  -- Precompute partnership columns using a lookup pattern
  partnership_columns := CASE p_role_name
    WHEN 'fairGameWallet' THEN '"fwPartnership"'
    WHEN 'fairGameAdmin' THEN '"faPartnership" + "fwPartnership"'
    WHEN 'superAdmin' THEN '"saPartnership" + "faPartnership" + "fwPartnership"'
    WHEN 'admin' THEN '"aPartnership" + "saPartnership" + "faPartnership" + "fwPartnership"'
    WHEN 'superMaster' THEN '"smPartnership" + "aPartnership" + "saPartnership" + "faPartnership" + "fwPartnership"'
    WHEN 'master' THEN '"mPartnership" + "smPartnership" + "aPartnership" + "saPartnership" + "faPartnership" + "fwPartnership"'
    WHEN 'agent' THEN '"agPartnership" + "mPartnership" + "smPartnership" + "aPartnership" + "saPartnership" + "faPartnership" + "fwPartnership"'
    ELSE '0'
  END;

  -- Single query execution with parallel safe operations
  EXECUTE format(
    $SQL$
    WITH balance_summary AS (
      SELECT
        jsonb_build_object(
          'totalCreditReference', SUM(u."creditRefrence"),
          'profitSum', SUM(ub."profitLoss"),
          'downLevelBalance', SUM(ub."downLevelBalance"),
          'availableBalance', SUM(ub."currentBalance"),
          'totalExposure', SUM(ub.exposure),
          'totalExposureOnlyUser', SUM(ub.exposure) FILTER (WHERE u."roleName" = 'user'),
          'totalCommission', SUM(ub."totalCommission"),
          'percentProfitLoss', ROUND(SUM(ub."profitLoss" / 100 * (%1$s)), 2
        ) AS data
      FROM users u
      LEFT JOIN "userBalances" ub USING (id)
      WHERE u."createBy" = $1
        AND u."roleName" <> $2
        AND u."deletedAt" IS NULL
    ),
    child_balance AS (
      WITH RECURSIVE hierarchy AS (
        SELECT id FROM users WHERE id = $1
        UNION ALL
        SELECT u.id FROM users u
        JOIN hierarchy h ON u."createBy" = h.id
        WHERE u."deletedAt" IS NULL
      )
      SELECT
        COALESCE(SUM(ub."currentBalance"), 0) AS balance
      FROM hierarchy h
      JOIN "userBalances" ub ON h.id = ub."userId"
      WHERE h.id <> $1 %2$s
    )
    SELECT jsonb_pretty(jsonb_set(
      bs.data,
      '{currBalance,availableBalance}',
      jsonb_build_object(
        'availableBalance', (bs.data->>'availableBalance')::numeric - (bs.data->>'totalExposureOnlyUser')::numeric,
        'currBalance', cb.balance
      )
    ))
    FROM balance_summary bs, child_balance cb
    $SQL$,
    partnership_columns,
    where_conditions
  ) INTO total_balance
  USING p_user_id, p_role_name, p_user_block, p_bet_block;

  RETURN total_balance;
END;
$$;
`);
    }

    async down(queryRunner) {
        await queryRunner.query(`DROP FUNCTION IF EXISTS getUserTotalBalance(uuid, users_rolename_enum, boolean, boolean, boolean);"`);
    }
}
