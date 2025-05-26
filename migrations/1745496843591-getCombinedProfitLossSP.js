const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class GetCombinedProfitLossSP1745496843593 {
  name = 'GetCombinedProfitLossSP1745496843593'

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
        partnership_sql := '100';
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
 (CASE WHEN $5 = 'user' THEN -1 ELSE 1 END) * SUM(CASE WHEN b.result = 'LOSS'                
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
      USING p_start_date, p_end_date, p_event_type_filter, P_MATCH_ID, P_ROLE_NAME;
END;
$body$ LANGUAGE PLPGSQL STABLE;
`);

    //get match wise profitloss
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
          partnership_expr := '100';
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
              (CASE WHEN $4 = 'user' THEN -1 ELSE 1 END) * ( SUM(
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
              (CASE WHEN $4 = 'user' THEN -1 ELSE 1 END) * ( SUM(
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
          USING P_START_DATE, P_END_DATE, P_EVENT_TYPE_FILTER,P_ROLE_NAME
        INTO result_json;
    
        RETURN result_json;
    END;
    $$;
    `);

    //get result bet profitloss
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
                partnership_sql := '100';
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
         (CASE WHEN $5 = 'user' THEN -1 ELSE 1 END) * (Sum(CASE WHEN b.result = 'LOSS' then ROUND(b."lossAmount" / 100 * (%s), 2) ELSE 0 END) - Sum(CASE WHEN b.result = 'WIN' then ROUND(b."winAmount" / 100 * (%s), 2) ELSE 0 END)) as "totalLoss",
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
              USING  P_DOMAIN,P_BET_ID,P_MATCH_ID,P_IS_SESSION,P_ROLE_NAME;
        END;
        $body$ LANGUAGE PLPGSQL STABLE;
        `);

    //get session bet profitloss
    await queryRunner.query(`
            CREATE OR REPLACE FUNCTION "getSessionBetProfitLoss" (
                P_USER_ID           UUID,
                P_MATCH_ID          UUID,
                P_SEARCH_ID         UUID           DEFAULT NULL,
                P_ROLE_NAME         TEXT           DEFAULT NULL
            
            ) RETURNS TABLE (
              "betId"                 UUID,
              "totalLoss"          NUMERIC,
              "eventName"             VARCHAR
             
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
                    partnership_sql := '100';
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
               b."betId" as "betId",
              (CASE WHEN $2 = 'user' THEN -1 ELSE 1 END) * (Sum(CASE WHEN b.result = 'LOSS' then ROUND(b."lossAmount" / 100 * (%s), 2) ELSE 0 END) - Sum(CASE WHEN b.result = 'WIN' then ROUND(b."winAmount" / 100 * (%s), 2) ELSE 0 END)) as "totalLoss",
                  b."eventName" as "eventName"
            FROM "betPlaceds" b
            JOIN user_tree ut ON ut.id = b."createBy"
            JOIN users u     ON u.id = ut.id
            WHERE b.result IN ('WIN','LOSS')
              AND b."deleteReason" IS NULL
              AND ($1 IS NULL OR b."matchId" = $1)
              AND  b."marketBetType" = 'SESSION'
            
            GROUP BY b."betId", b."eventName"
            $q$, user_tree_sql, partnership_sql, partnership_sql);
            
             -- Execute with optimized settings
                RETURN QUERY EXECUTE final_sql
                  USING  P_MATCH_ID, P_ROLE_NAME;
            END;
            $body$ LANGUAGE PLPGSQL STABLE;
            `);

    //get userwise profitloss
    await queryRunner.query(`
                CREATE OR REPLACE FUNCTION "getUserWiseBetProfitLoss" (
                    P_USER_ID           UUID,
                    P_MATCH_ID          UUID,
                    P_RUNNER_ID          UUID,
                    P_USER_IDS          UUID[]         DEFAULT NULL,
                    P_SEARCH_ID         UUID           DEFAULT NULL,
                    P_ROLE_NAME         TEXT           DEFAULT NULL,
                    P_USER_ROLE_NAME         TEXT           DEFAULT NULL
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
                        partnership_sql := '100';
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
                      USING  P_MATCH_ID,P_USER_IDS,P_USER_ID,P_SEARCH_ID,P_USER_ROLE_NAME;
                END;
                $body$ LANGUAGE PLPGSQL STABLE;
                `);

    //get user list
    await queryRunner.query(`
                    CREATE OR REPLACE FUNCTION fetchUserList(
                      createBy uuid,
                      excludeRole users_rolename_enum,
                      partnership text[] DEFAULT ARRAY[]::text[],
                      offsetVal integer DEFAULT 0,
                      limitVal integer DEFAULT 10,
                      keyword text DEFAULT '',
                      userBlock boolean DEFAULT NULL,
                      betBlock boolean DEFAULT NULL,
                      orVal boolean DEFAULT NULL
                    )
                    RETURNS json
                    LANGUAGE plpgsql
                    AS $$
                    DECLARE
                      total_count bigint;
                      result json;
                    BEGIN
                      PERFORM set_config('enable_nestloop', 'off', false);
                    
                      -- Get total count using efficient index scan
                      SELECT COUNT(u.id) INTO total_count
                      FROM users u
                      WHERE u."createBy" = createBy
                        AND u."roleName" <> excludeRole
                        AND (userBlock IS NULL OR u."userBlock" = userBlock)
                        AND (betBlock IS NULL OR u."betBlock" = betBlock)
                        AND (orVal IS NULL OR u."betBlock" = true OR u."userBlock" = true)
                        AND u."deletedAt" IS NULL;
                    
                      -- Main optimized query
                      WITH RECURSIVE filtered AS (
                        SELECT
                          u.id,
                          u."userName",
                          u."roleName",
                          u."betBlock",
                          u."createdAt",
                          u."creditRefrence",
                          u."exposureLimit",
                          u."fullName",
                          u."matchComissionType",
                          u."matchCommission",
                          u."sessionCommission",
                          u."userBlock",
                          u.city,
                          u."phoneNumber",
                          ub."currentBalance"::numeric,
                          ub.exposure::numeric,
                          ub."myProfitLoss"    AS my_pl,
                          ub."profitLoss"      AS raw_pl,
                          ub."totalCommission" AS raw_comm,
                          COALESCE(u."agPartnership", 0) AS "agPartnership",
                          COALESCE(u."mPartnership", 0) AS "mPartnership",
                          COALESCE(u."smPartnership", 0) AS "smPartnership",
                          COALESCE(u."aPartnership", 0) AS "aPartnership",
                          COALESCE(u."saPartnership", 0) AS "saPartnership",
                          COALESCE(u."faPartnership", 0) AS "faPartnership",
                          COALESCE(u."fwPartnership", 0) AS "fwPartnership",
                          ub AS "userBal",  -- Store entire balance record
                          -- Precompute partnership sum once
                          (
                            SELECT COALESCE(SUM(
                              CASE p
                                WHEN 'agPartnership' THEN u."agPartnership"
                                WHEN 'mPartnership' THEN u."mPartnership"
                                WHEN 'smPartnership' THEN u."smPartnership"
                                WHEN 'aPartnership' THEN u."aPartnership"
                                WHEN 'saPartnership' THEN u."saPartnership"
                                WHEN 'faPartnership' THEN u."faPartnership"
                                WHEN 'fwPartnership' THEN u."fwPartnership"
                                ELSE 0
                              END
                            ), 0)
                            FROM unnest(partnership) p
                          ) AS partnership_sum
                        FROM users u
                        LEFT JOIN "userBalances" ub ON ub."userId" = u.id
                        WHERE u."createBy" = createBy
                          AND u."roleName" <> excludeRole
                          AND (userBlock IS NULL OR u."userBlock" = userBlock)
                          AND (betBlock IS NULL OR u."betBlock" = betBlock)
                          AND (orVal IS NULL OR u."betBlock" = true OR u."userBlock" = true)
                          AND u."deletedAt" IS NULL
                          AND u."userName" ILIKE '%' || keyword || '%'
                        ORDER BY u."betBlock", u."userBlock", u."userName"
                        OFFSET offsetVal
                        LIMIT limitVal
                      ),
                      rec AS (
                        SELECT f.id, f.id AS root_id FROM filtered f
                        UNION ALL
                        SELECT u.id, r.root_id
                        FROM users u
                        JOIN rec r ON u."createBy" = r.id AND r.root_id <> createBy
                        WHERE u."createBy" <> createBy  -- Prevent infinite recursion
                      ),
                      child_sums AS (
                        SELECT
                          r.root_id AS id,
                          SUM(ub."currentBalance") AS total_child_balance
                        FROM rec r
                        JOIN "userBalances" ub ON ub."userId" = r.id
                        GROUP BY r.root_id
                      )
                      SELECT json_build_object(
                        'count', total_count,
                        'list', COALESCE(json_agg(
                          json_build_object(
                            'id', f.id,
                            'betBlock', f."betBlock",
                            'createdAt', f."createdAt",
                            'creditRefrence', f."creditRefrence",
                            'exposureLimit', f."exposureLimit",
                            'fullName', f."fullName",
                            'matchComissionType', f."matchComissionType",
                            'matchCommission', f."matchCommission",
                            'userName', f."userName",
                            'roleName', f."roleName",
                            'sessionCommission', f."sessionCommission",
                            'userBlock', f."userBlock",
                            'percentProfitLoss', CASE
                              WHEN partnership = '{}' THEN f.my_pl
                              ELSE (f.raw_pl::numeric / 100) * f.partnership_sum
                            END,
                            'availableBalance', CASE
                              WHEN f."roleName" <> 'user' THEN f."currentBalance"
                              ELSE (f."currentBalance" - f.exposure)
                            END,
                            'balance', COALESCE(c.total_child_balance, 0),
                            'commission', CASE
                              WHEN partnership = '{}' THEN f.raw_comm::text
                              ELSE f.raw_comm::text || ' (' || f.partnership_sum::text || '%)'
                            END,
                            'upLinePartnership', f.partnership_sum,
                            'userBal', row_to_json(f."userBal"),
                            'fwPartnership', f."fwPartnership",
                            'faPartnership', f."faPartnership",
                            'saPartnership', f."saPartnership",
                            'aPartnership', f."aPartnership",
                            'smPartnership', f."smPartnership",
                            'mPartnership', f."mPartnership",
                            'agPartnership', f."agPartnership",
                            'city', f.city,
                            'phoneNumber', f."phoneNumber"
                          )
                          ORDER BY f."betBlock" ASC, f."userBlock" ASC, f."userName" ASC  -- Add this line
                    
                        ), '[]')
                      ) INTO result
                      FROM filtered f
                      LEFT JOIN child_sums c ON f.id = c.id ;
                    
                      RETURN result;
                    END;
                    $$;
                    `);

    //user total balance
    await queryRunner.query(`
                        CREATE OR REPLACE FUNCTION getUserTotalBalance(p_user_id UUID, p_role_name users_rolename_enum, p_user_block BOOLEAN DEFAULT NULL, p_bet_block BOOLEAN DEFAULT NULL, p_or_val BOOLEAN DEFAULT NULL)
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
                        CASE WHEN p_user_block IS NOT NULL THEN ' AND p."userBlock" = ' || p_user_block::BOOLEAN END,
                        CASE WHEN p_bet_block IS NOT NULL THEN ' AND p."betBlock" = ' || p_bet_block::BOOLEAN END,
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
                          SUM(p."creditRefrence") as "totalCreditReference",
                          SUM(UB."profitLoss") as "profitsum",
                          SUM(UB."downLevelBalance") as "downLevelBalance",
                          SUM(UB."currentBalance") as "availableBalance",
                          SUM(UB.exposure) as "totalExposure",
                          COALESCE(SUM(ub.exposure) FILTER (WHERE p."roleName" = ''user''), 0) AS "totalExposureOnlyUser",
                          SUM(UB."totalCommission") as "totalcommission",
                          ROUND(SUM(ub."profitLoss" / 100 * (%s)), 2)  as "percentprofitloss"
                          FROM users p
                          LEFT JOIN "userBalances" UB ON p.id = UB."userId"
                          WHERE p."createBy" = $1 %s
                          AND p."roleName" <> $2
                          AND p."deletedAt" IS NULL
                        )
                        SELECT row_to_json(user_balances) FROM user_balances',
                        partnership_columns, where_conditions
                        );
                        EXECUTE query_text INTO total_balance USING p_user_id, p_role_name;

                        -- Child balance calculation
                        query_text := format(
                        'WITH RECURSIVE child AS (
                          SELECT id, "deletedAt", "createBy", "userBlock", "betBlock"  FROM users WHERE users.id = $1
                          UNION
                          SELECT p.id, p."deletedAt", p."createBy", p."userBlock", p."betBlock" FROM users p
                          JOIN child ON p."createBy" = child.id and ( (p."createBy" = $1 %s) or p."createBy" <> $1) )
                        SELECT SUM(UB."currentBalance")
                        FROM child
                        JOIN "userBalances" UB ON UB."userId" = child.id
                        WHERE child.id <> $1 AND "child"."deletedAt" IS NULL',
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
    //declare balance update
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
    await queryRunner.query(`DROP FUNCTION IF EXISTS "getCombinedProfitLoss" (UUID, UUID, TIMESTAMP, TIMESTAMP, TEXT, TEXT, UUID);`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS "getMatchWiseProfitLoss" (UUID, UUID, TIMESTAMP, TIMESTAMP, TEXT, TEXT, UUID,NUMERIC,NUMERIC);`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS "getResultBetProfitLoss" (UUID, UUID,UUID, TEXT, BOOLEAN, UUID, TEXT);`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS "getSessionBetProfitLoss" (UUID, UUID,UUID, TEXT);`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS "getUserWiseBetProfitLoss" (UUID, UUID, UUID, UUID[], UUID, TEXT,TEXT);`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS fetchUserList(uuid, users_rolename_enum, text[], integer, integer,text,boolean,boolean,boolean);`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS getUserTotalBalance(uuid, users_rolename_enum, boolean, boolean, boolean);`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS "updateUserBalancesBatch"(JSONB);`);
  }
}
