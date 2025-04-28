const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class GetResultBetProfitLossSP1745496843591 {
    name = 'GetResultBetProfitLossSP1745496843591'

    async up(queryRunner) {
        await queryRunner.query(`
CREATE OR REPLACE FUNCTION "getResultBetProfitLoss" (
    P_USER_ID           UUID,
    P_MATCH_ID          UUID,
    P_BET_ID            UUID,
	P_DOMAIN            TEXT,
    P_IS_SESSION        BOOLEAN        DEFAULT false,
    P_SEARCH_ID         UUID           DEFAULT NULL,
    P_ROLE_NAME         TEXT           DEFAULT NULL

) RETURNS TABLE (
  "id"                 UUID,
  "totalLoss"          NUMERIC,
  "userId"             UUID,
  "matchId"            UUID,
  "result"             VARCHAR,
  "teamName"           VARCHAR,
  "betType"            "betPlaceds_bettype_enum",
  "marketType"         VARCHAR,
  "marketBetType"      "betPlaceds_marketbettype_enum",
  "rate"               NUMERIC,
  "amount"             NUMERIC,
  "odds"               NUMERIC,
  "createdAt"          TIMESTAMP WITH TIME ZONE,
  "userName"           VARCHAR,
  "deleteReason"       VARCHAR,
  "bettingName"        VARCHAR,
  "isCommissionActive" BOOLEAN,
  "domain"             TEXT
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
   b.id as "id",
 (Sum(CASE WHEN b.result = 'LOSS' then ROUND(b."lossAmount" / 100 * (%s), 2) ELSE 0 END) - Sum(CASE WHEN b.result = 'WIN' then ROUND(b."winAmount" / 100 * (%s), 2) ELSE 0 END)) as "totalLoss",
      b."createBy" as "userId",
      b."matchId" as "matchId",
      b."result"  as "result",
      b."teamName"  as "teamName",
      b."betType"  as "betType",
      b."marketType"  as "marketType",
      b."marketBetType"  as "marketBetType",
      b."rate"  as "rate",
      b.amount as "amount",
      b."odds" as "odds",
      b."createdAt" as "createdAt",
      u."userName" as "userName",
      b."deleteReason" as "deleteReason",
      b."bettingName"  as "bettingName",
      b."isCommissionActive"  as "isCommissionActive",
	  $1 as "domain"
FROM "betPlaceds" b
JOIN user_tree ut ON ut.id = b."createBy"
JOIN users u     ON u.id = ut.id
WHERE b.result <> 'PENDING'
  AND ($2 IS NULL OR b."betId" = $2)
  AND ($3 IS NULL OR b."matchId" = $3)
AND (
      ($4     AND b."marketBetType" = 'SESSION')
   OR (NOT $4 AND b."marketBetType" IN ('MATCHBETTING','RACING'))
)

GROUP BY b.id, u."userName" ORDER BY b."createdAt" DESC
$q$, user_tree_sql, partnership_sql, partnership_sql);

 -- Execute with optimized settings
    RETURN QUERY EXECUTE final_sql
      USING  P_DOMAIN,P_BET_ID,P_MATCH_ID,P_IS_SESSION;
END;
$body$ LANGUAGE PLPGSQL STABLE;
`);
    }

    async down(queryRunner) {
        await queryRunner.query(`DROP FUNCTION IF EXISTS "getResultBetProfitLoss" (UUID, UUID,UUID, TEXT, BOOLEAN, UUID, TEXT);`);
    }
}
