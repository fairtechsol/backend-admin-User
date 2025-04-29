const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class GetMatchWiseProfitLossSP1745496843592 {
    name = 'GetMatchWiseProfitLossSP1745496843592'

    async up(queryRunner) {
        await queryRunner.query(`
CREATE OR REPLACE FUNCTION "getMatchWiseProfitLoss" (
    P_USER_ID           UUID,
    P_SEARCH_ID         UUID           DEFAULT NULL,
    P_START_DATE        TIMESTAMP      DEFAULT NULL,
    P_END_DATE          TIMESTAMP      DEFAULT NULL,
    P_ROLE_NAME         TEXT           DEFAULT NULL,
    P_EVENT_TYPE_FILTER TEXT           DEFAULT 'cricket',
    P_PAGE              INT            DEFAULT 0,
    P_LIMIT             INT            DEFAULT 1000000
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    role_hierarchy   TEXT[] := ARRAY[
      'fairGameWallet','fairGameAdmin','superAdmin',
      'admin','superMaster','master','agent'
    ];
    partnership_expr TEXT := '';
    idx              INT;
    i                INT;
    user_tree_sql    TEXT;
    final_sql        TEXT;
    result_json      JSONB;
BEGIN
    -- Optional planner hint
    PERFORM set_config('enable_nestloop', 'off', false);

    -- Build partnership expression
    idx := array_position(role_hierarchy, P_ROLE_NAME);
    IF idx IS NULL THEN
      partnership_expr := '1';
    ELSE
      FOR i IN 1..idx LOOP
        partnership_expr := partnership_expr
          || format(
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
      partnership_expr := left(partnership_expr, length(partnership_expr) - 3);
    END IF;

    -- Build user_tree CTE
    user_tree_sql := CASE
      WHEN P_ROLE_NAME = 'user' THEN
        format('SELECT %L::UUID AS id', P_USER_ID)

      WHEN P_ROLE_NAME = 'fairGameWallet' AND P_SEARCH_ID IS NULL THEN
        'SELECT id FROM users WHERE "roleName" = ''user'' AND "isDemo" = false'

      WHEN P_ROLE_NAME = 'fairGameAdmin' AND P_SEARCH_ID IS NULL THEN
        format(
          'SELECT id FROM users WHERE "superParentId" = %L::UUID AND "roleName" = ''user''',
          P_USER_ID
        )

      ELSE
        format($usql$
WITH RECURSIVE p AS (
  SELECT id, "deletedAt", "roleName" FROM users WHERE id = %L::UUID
  UNION ALL
  SELECT u.id, u."deletedAt", u."roleName"
    FROM users u
    JOIN p ON u."createBy" = p.id AND u.id <> u."createBy"
  WHERE u."deletedAt" IS NULL
)
SELECT id
  FROM p
 WHERE "deletedAt" IS NULL
   AND "roleName" = 'user'
$usql$, COALESCE(P_SEARCH_ID, P_USER_ID))
    END;

    -- Build the single SQL string
    final_sql := format($f$
WITH RECURSIVE user_tree AS (%s),

     core AS MATERIALIZED (
       SELECT
         b."eventType",
         b."matchId",

         -- rateProfitLoss
         ( SUM(
             CASE
               WHEN b.result = 'LOSS'
                    AND b."marketBetType" IN ('MATCHBETTING','RACING')
               THEN ROUND(b."lossAmount"/100 * (%s), 2)
               ELSE 0
             END
           )
         - SUM(
             CASE
               WHEN b.result = 'WIN'
                    AND b."marketBetType" IN ('MATCHBETTING','RACING')
               THEN ROUND(b."winAmount"/100 * (%s), 2)
               ELSE 0
             END
           )
         ) AS "rateProfitLoss",

         -- sessionProfitLoss
         ( SUM(
             CASE
               WHEN b.result = 'LOSS'
                    AND b."marketBetType" = 'SESSION'
               THEN ROUND(b."lossAmount"/100 * (%s), 2)
               ELSE 0
             END
           )
         - SUM(
             CASE
               WHEN b.result = 'WIN'
                    AND b."marketBetType" = 'SESSION'
               THEN ROUND(b."winAmount"/100 * (%s), 2)
               ELSE 0
             END
           )
         ) AS "sessionProfitLoss",

         m."startAt",
         m.title,
         COUNT(*)   AS "totalBet",
         SUM(
           CASE
             WHEN b.result = 'WIN'
                  AND b."bettingName" = 'MATCH_ODDS'
             THEN ROUND(b."winAmount"/100, 2)
             ELSE 0
           END
         ) AS "totalDeduction"
       FROM "betPlaceds" b
       JOIN matchs   m  ON m.id = b."matchId" AND m."deletedAt" IS NULL
       JOIN user_tree ut ON ut.id = b."createBy"
       JOIN users   u  ON u.id = ut.id
       WHERE
         b.result IN ('WIN','LOSS')
         AND u."deletedAt" IS NULL
         AND u."roleName" = 'user'
         AND b."deleteReason" IS NULL
         AND ($1 IS NULL OR DATE(m."startAt") >= $1)
         AND ($2 IS NULL OR DATE(m."startAt") <= $2)
         AND ($3 IS NULL OR b."eventType" = $3)
       GROUP BY
         b."matchId", m.id, b."eventType"
     )

SELECT jsonb_build_object(
  'count', (SELECT count(*) FROM core),
  'result',
    COALESCE(
      (SELECT jsonb_agg(to_jsonb(c) ORDER BY c."startAt" DESC)
         FROM (
           SELECT * FROM core
           ORDER BY "startAt" DESC
           LIMIT %s OFFSET %s
         ) AS c
      ),
      '[]'::jsonb
    )
)
$f$,
    -- 1) user_tree
    user_tree_sql,
    -- 2–5) partnership_expr × 4
    partnership_expr, partnership_expr,
    partnership_expr, partnership_expr,
    -- 6–7) limit & offset
    P_LIMIT, P_PAGE
    );

    -- Execute with the three filter parameters in order
    EXECUTE final_sql
      USING P_START_DATE, P_END_DATE, P_EVENT_TYPE_FILTER
    INTO result_json;

    RETURN result_json;
END;
$$;
`);
    }

    async down(queryRunner) {
        await queryRunner.query(`DROP FUNCTION IF EXISTS "getMatchWiseProfitLoss" (UUID, UUID, TIMESTAMP, TIMESTAMP, TEXT, TEXT, UUID,NUMERIC,NUMERIC);`);
    }
}
