const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class GetCombinedProfitLossSP1745496843592 {
    name = 'GetCombinedProfitLossSP1745496843592'

    async up(queryRunner) {
        await queryRunner.query(`
CREATE OR REPLACE FUNCTION "getCombinedProfitLoss" (
    P_USER_ID UUID,
    P_SEARCH_ID UUID DEFAULT NULL,
    P_START_DATE TIMESTAMP DEFAULT NULL,
    P_END_DATE TIMESTAMP DEFAULT NULL,
    P_ROLE_NAME TEXT DEFAULT NULL,
    P_EVENT_TYPE_FILTER TEXT DEFAULT NULL,
	P_MATCH_ID UUID DEFAULT NULL

) RETURNS TABLE (
    "eventType" VARCHAR,
	"totalDeduction" NUMERIC,
    "totalLoss" NUMERIC,
    "totalBet" BIGINT
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
    user_tree_sql := CASE
        WHEN p_role_name = 'user' THEN
            format('SELECT %L::UUID AS id', p_user_id)

        WHEN p_role_name = 'fairGameWallet' AND p_search_id IS NULL THEN
            'SELECT id FROM users WHERE "roleName" = ''user'' AND "isDemo" = false'

        WHEN p_role_name = 'fairGameAdmin' AND p_search_id IS NULL THEN
            format('SELECT id FROM users WHERE "superParentId" = %L::UUID AND "roleName" = ''user''', p_user_id)

        ELSE
            format($usql$
SELECT id FROM (
  WITH RECURSIVE p AS (
    SELECT id, "deletedAt", "roleName" FROM users WHERE id = %L::UUID
    UNION ALL
    SELECT u.id, u."deletedAt", u."roleName" FROM users u 
    JOIN p ON u."createBy" = p.id and u.id <> u."createBy"
    WHERE u."deletedAt" IS NULL
  )
  SELECT id FROM p WHERE "deletedAt" IS NULL AND "roleName" = 'user'
) sub
$usql$, COALESCE(p_search_id, p_user_id))
    END;

    -- 3) static query template: partnership_sql & user_tree_sql injected
    final_sql :=  format($q$
WITH RECURSIVE user_tree AS (%s)
SELECT
  b."eventType",
    SUM(CASE WHEN b.result = 'WIN' AND b."bettingName" = 'MATCH_ODDS'
           THEN ROUND(b."winAmount"/100,2) ELSE 0 END)      AS total_deduction,
  SUM(CASE WHEN b.result = 'LOSS'                
           THEN ROUND(b."lossAmount"/100 * (%s),2)
           WHEN b.result = 'WIN'
           THEN -ROUND(b."winAmount"/100 * (%s),2)
           ELSE 0 END)                             AS total_loss,
  COUNT(*)                                        AS total_bet
FROM "betPlaceds" b
JOIN matchs m    ON m.id = b."matchId" AND m."deletedAt" IS NULL
JOIN user_tree ut ON ut.id = b."createBy"
JOIN users u     ON u.id = ut.id
WHERE b.result IN ('WIN','LOSS') AND  u."deletedAt" IS NULL AND u."roleName" = 'user'
  AND b."deleteReason" IS NULL
  AND ($1 IS NULL OR DATE(m."startAt") >= $1)
  AND ($2 IS NULL OR DATE(m."startAt") <= $2)
  AND ($3 IS NULL OR b."eventType" = $3)
  AND ($4 IS NULL OR b."matchId" = $4)

GROUP BY b."eventType"
$q$, user_tree_sql, partnership_sql, partnership_sql);

 -- Execute with optimized settings
    PERFORM set_config('enable_nestloop', 'off', false);
    RETURN QUERY EXECUTE final_sql
      USING p_start_date, p_end_date, p_event_type_filter, P_MATCH_ID;
END;
$body$ LANGUAGE PLPGSQL STABLE;
`);
    }

    async down(queryRunner) {
        await queryRunner.query(`DROP FUNCTION IF EXISTS "getCombinedProfitLoss" (UUID, UUID, TIMESTAMP, TIMESTAMP, TEXT, TEXT, UUID);`);
    }
}
