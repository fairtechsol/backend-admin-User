const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class UserTotalBalanceSP1745496843591 {
    name = 'UserTotalBalanceSP1745496843591'

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
PARALLEL SAFE  -- Enable parallel execution
AS $$
DECLARE
  total_balance JSON;
  child_balance NUMERIC;
  query_text TEXT;
  where_conditions TEXT := '';
  partnership_columns TEXT;
BEGIN
 -- Set parallel-friendly settings
  PERFORM set_config('enable_nestloop', 'off', true);
  PERFORM set_config('enable_parallel_hash', 'on', true);

 -- Build WHERE conditions using parameterized format
  where_conditions := CONCAT(
    CASE WHEN p_user_block IS NOT NULL THEN ' AND p."userBlock" = ' || p_user_block::TEXT END,
    CASE WHEN p_bet_block IS NOT NULL THEN ' AND p."betBlock" = ' || p_bet_block::TEXT END,
    CASE WHEN p_or_val THEN ' AND (p."betBlock" OR p."userBlock")' END
  );

  -- Determine percentage calculation based on role
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

  -- Main balance query
  query_text := format(
   'WITH user_balances AS (
      SELECT
        SUM(u."creditRefrence") as "totalCreditReference",
        SUM(UB."profitLoss") as "profitsum",
        SUM(UB."downLevelBalance") as "downLevelBalance",
        SUM(UB."currentBalance") as "availableBalance",
        SUM(UB.exposure) as "totalExposure",
        SUM(ub.exposure) FILTER (WHERE u."roleName" = ''user'') AS "totalExposureOnlyUser",
        SUM(UB."totalCommission") as "totalcommission",
        ROUND(SUM(ub."profitLoss" / 100 * (%s)), 2)  as "percentprofitloss"
      FROM users u
      LEFT JOIN "userBalances" UB ON u.id = UB."userId"
      WHERE u."createBy" = $1
        AND u."roleName" <> $2
        AND u."deletedAt" IS NULL
    )
    SELECT row_to_json(user_balances) FROM user_balances',
	partnership_columns
  );

  EXECUTE query_text INTO total_balance USING p_user_id, p_role_name;

  -- Child balance calculation
  query_text := format(
   'WITH RECURSIVE p AS (
      SELECT * FROM users WHERE users.id = $1
      UNION
      SELECT lowerU.* FROM users lowerU
      JOIN p ON lowerU."createBy" = p.id
    )
    SELECT SUM(UB."currentBalance")
    FROM p
    JOIN "userBalances" UB ON UB."userId" = p.id
    WHERE p.id <> $1 %s AND "p"."deletedAt" IS NULL',
    where_conditions
  );

  EXECUTE query_text INTO child_balance USING p_user_id;

  -- Final result construction
  total_balance := jsonb_set(
    total_balance::jsonb,
    '{availableBalance}',
    to_jsonb(
      (total_balance->>'availableBalance')::numeric - 
      (total_balance->>'totalExposureOnlyUser')::numeric
    )
  );

  total_balance := jsonb_set(
    total_balance::jsonb,
    '{currBalance}',
    to_jsonb(child_balance)
  );
  RETURN total_balance;
END;
$$;
`);
    }

    async down(queryRunner) {
        await queryRunner.query(`DROP FUNCTION IF EXISTS getUserTotalBalance(uuid, users_rolename_enum, boolean, boolean, boolean);`);
    }
}
