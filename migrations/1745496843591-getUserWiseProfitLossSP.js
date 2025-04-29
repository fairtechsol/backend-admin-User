const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class GetUserWiseProfitLossSP1745496843591 {
    name = 'GetUserWiseProfitLossSP1745496843591'

    async up(queryRunner) {
        await queryRunner.query(`
CREATE OR REPLACE FUNCTION "getUserWiseBetProfitLoss" (
    P_USER_ID           UUID,
    P_MATCH_ID          UUID,
	P_RUNNER_ID          UUID,
	P_USER_IDS          UUID[]         DEFAULT NULL,
    P_SEARCH_ID         UUID           DEFAULT NULL,
    P_ROLE_NAME         TEXT           DEFAULT NULL
) RETURNS TABLE (
"matchId" UUID, 
"rateProfitLoss"  NUMERIC,
"roleName"  users_rolename_enum,
"sessionProfitLoss"  NUMERIC,
"totalLoss"   NUMERIC,
"userId"  UUID,
"userName"  VARCHAR

) AS $body$
DECLARE
    -- role hierarchy & prefix mapping
    role_hierarchy    TEXT[] := ARRAY[
        'fairGameWallet','fairGameAdmin','superAdmin',
        'admin','superMaster','master','agent'
    ];
    partnership_sql   TEXT := '';
    idx               INT;
    i                 INT;
    -- user-tree CTE text
    user_tree_sql     TEXT;
    -- full SQL to execute
    final_sql         TEXT;
BEGIN
    PERFORM set_config('enable_nestloop', 'off', false);

    -- 1) build partnership expression once
    idx := array_position(role_hierarchy, p_role_name);
    IF idx IS NULL THEN
        partnership_sql := '1';
    ELSE
        FOR i IN 1..idx LOOP
            partnership_sql := partnership_sql || format(
                'u."%sPartnership" + ',
                CASE role_hierarchy[i]
                    WHEN 'fairGameWallet' THEN 'fw'
                    WHEN 'fairGameAdmin'  THEN 'fa'
                    WHEN 'superAdmin'     THEN 'sa'
                    WHEN 'admin'          THEN 'a'
                    WHEN 'superMaster'    THEN 'sm'
                    WHEN 'master'         THEN 'm'
                    WHEN 'agent'          THEN 'ag'
                END
            );
        END LOOP;
        partnership_sql := left(partnership_sql, length(partnership_sql)-3);
    END IF;

    -- 2) build user_tree CTE text based on roleName/searchId logic
    user_tree_sql := format(
	$q$
	WITH RECURSIVE sub_children AS (
  -- Anchor: pick rows based on parameters
  SELECT
    u.id           AS direct_user_id,
    u.id           AS current_id,
    u."roleName",
    u."userName"
  FROM users u
  WHERE u."deletedAt" IS NULL
    AND (
      -- Case 1: specific search ID
      ($4 IS NOT NULL       AND u.id = $4)
      -- Case 2: list of user IDs
      OR ($4 IS NULL        AND $2 IS NOT NULL
          AND u.id = ANY ($2))              -- = ANY is equivalent to IN :contentReference[oaicite:0]{index=0}          
      -- Case 3: fairGame roles special logic
      OR ($4 IS NULL        AND $2 IS NULL
          AND $5 IN ('fairGameWallet','fairGameAdmin')
          AND u."superParentId" = $3
          AND u."isDemo"     = false
          AND u.id           = u."createBy")
      -- Case 4: default createBy logic
      OR ($4 IS NULL        AND $2 IS NULL
          AND $5 NOT IN ('fairGameWallet','fairGameAdmin')
          AND u."createBy"  = $3
          AND u.id <> $3)
    )
  
  UNION ALL
  
  -- Recursive step: unchanged
  SELECT
    sc.direct_user_id,
    u.id           AS current_id,
    u."roleName",
    u."userName"
  FROM users u
  JOIN sub_children sc
    ON u."createBy" = sc.current_id
  WHERE u."deletedAt" IS NULL
    AND u."createBy" <> u.id
)
SELECT
  sc.direct_user_id,
  u0."roleName"  AS direct_user_role,
  u0."userName"  AS direct_user_name,
  ARRAY_AGG(sc.current_id ORDER BY sc.current_id)
    FILTER (WHERE sc."roleName" = 'user') AS user_ids
FROM sub_children sc
JOIN users u0
  ON sc.direct_user_id = u0.id
WHERE sc.direct_user_id <> $3
GROUP BY sc.direct_user_id, u0."roleName", u0."userName"
ORDER BY sc.direct_user_id
$q$
);

    -- 3) static query template: partnership_sql & user_tree_sql injected
    final_sql :=format(
	$q$
 WITH RECURSIVE user_tree AS (%s)
SELECT
   b."matchId" as "matchId",
   (Sum(CASE WHEN b.result = 'LOSS' and (b."marketBetType" = 'MATCHBETTING' or b."marketBetType" = 'RACING') then ROUND(b."lossAmount" / 100 * (%s), 2) ELSE 0 END) - Sum(CASE WHEN b.result = 'WIN' and (b."marketBetType" = 'MATCHBETTING' or b."marketBetType" = 'RACING') then ROUND(b."winAmount" / 100 * (%s), 2) ELSE 0 END)) as "rateProfitLoss",
   ut.direct_user_role,
   (Sum(CASE WHEN b.result = 'LOSS' and (b."marketBetType" = 'SESSION') then ROUND(b."lossAmount" / 100 * (%s), 2) ELSE 0 END) - Sum(CASE WHEN b.result = 'WIN' and (b."marketBetType" = 'SESSION') then ROUND(b."winAmount" / 100 * (%s), 2) ELSE 0 END)) as "sessionProfitLoss",
 (Sum(CASE WHEN b.result = 'LOSS' then ROUND(b."lossAmount" / 100 * (%s), 2) ELSE 0 END) - Sum(CASE WHEN b.result = 'WIN' then ROUND(b."winAmount" / 100 * (%s), 2) ELSE 0 END)) as "totalLoss",
 ut.direct_user_id,
 ut.direct_user_name
FROM "betPlaceds" b
JOIN user_tree ut ON b."createBy" = ANY(ut.user_ids)
JOIN users u     ON u.id = ut.direct_user_id
WHERE b.result IN ('WIN','LOSS')
  AND b."deleteReason" IS NULL
  AND ($1 IS NULL OR b."matchId" = $1)


GROUP BY ut.direct_user_id, b."matchId",ut.direct_user_role,ut.direct_user_name
$q$, user_tree_sql, partnership_sql, partnership_sql,partnership_sql,partnership_sql,partnership_sql,partnership_sql);

 -- Execute with optimized settings
    RETURN QUERY EXECUTE final_sql
      USING  P_MATCH_ID,P_USER_IDS,P_USER_ID,P_SEARCH_ID,P_ROLE_NAME;
END;
$body$ LANGUAGE PLPGSQL STABLE;
`);
    }

    async down(queryRunner) {
        await queryRunner.query(`DROP FUNCTION IF EXISTS "getUserWiseBetProfitLoss" (UUID, UUID, UUID, UUID[], UUID, TEXT);`);
    }
}
