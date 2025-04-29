const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class GetUserWiseProfitLossSP1745496843591 {
    name = 'GetUserWiseProfitLossSP1745496843591'

    async up(queryRunner) {
        await queryRunner.query(`
CREATE OR REPLACE FUNCTION "getUserWiseBetProfitLoss"(
    pUserId       UUID,
    pMatchId      UUID,
    pRunnerId     UUID,
    pUserIds      UUID[] DEFAULT NULL,
    pSearchId     UUID   DEFAULT NULL,
    pRoleName     TEXT   DEFAULT NULL
)
RETURNS TABLE (
    matchId           UUID,
    rateProfitLoss    NUMERIC,
    roleName          users_rolename_enum,
    sessionProfitLoss NUMERIC,
    totalLoss         NUMERIC,
    userId            UUID,
    userName          VARCHAR
) LANGUAGE plpgsql STABLE AS $$
DECLARE
    roleHierarchy   TEXT[] := ARRAY[
        'fairGameWallet', 'fairGameAdmin', 'superAdmin',
        'admin', 'superMaster', 'master', 'agent'
    ];
    partnershipFactor TEXT := '';
    idx               INT;
    i                 INT;
    userTreeSql       TEXT;
    finalSql          TEXT;
BEGIN
    PERFORM set_config('enable_nestloop','off',false);

    -- Build partnershipFactor expression
    idx := array_position(roleHierarchy, pRoleName);
    IF idx IS NULL THEN
        partnershipFactor := '1';
    ELSE
        FOR i IN 1..idx LOOP
            partnershipFactor := partnershipFactor || format(
                'u.%sPartnership + ',
                CASE roleHierarchy[i]
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
        partnershipFactor := left(partnershipFactor, length(partnershipFactor) - 3);
    END IF;

    -- CTE for user hierarchy
    userTreeSql := format($ct$
WITH RECURSIVE userTree AS (
  SELECT
    u.id         AS directUserId,
    u.id         AS currentId,
    u.roleName,
    u.userName
  FROM users u
  WHERE u.deletedAt IS NULL
    AND (
      ($4 IS NOT NULL AND u.id = $4)
      OR ($4 IS NULL AND $2 IS NOT NULL AND u.id = ANY($2))
      OR ($4 IS NULL AND $2 IS NULL AND $5 IN ('fairGameWallet','fairGameAdmin')
          AND u.superParentId = $3 AND NOT u.isDemo AND u.id = u.createBy)
      OR ($4 IS NULL AND $2 IS NULL AND $5 NOT IN ('fairGameWallet','fairGameAdmin')
          AND u.createBy = $3 AND u.id <> $3)
    )
  UNION ALL
  SELECT
    ut.directUserId,
    u.id,
    u.roleName,
    u.userName
  FROM users u
  JOIN userTree ut ON u.createBy = ut.currentId
  WHERE u.deletedAt IS NULL AND u.createBy <> u.id
)
SELECT directUserId,
       roleName    AS directUserRole,
       userName    AS directUserName,
       ARRAY_AGG(currentId ORDER BY currentId)
         FILTER (WHERE roleName = 'user') AS userIds
FROM userTree
WHERE directUserId <> $3
GROUP BY directUserId, roleName, userName
ORDER BY directUserId
$ct$);

    -- Final dynamic query
    finalSql := format($dq$
%s
SELECT
  b.matchId,
  (SUM(CASE WHEN b.result = 'LOSS' AND b.marketBetType IN('MATCHBETTING','RACING')
     THEN ROUND(b.lossAmount/100*(%s),2) ELSE 0 END)
   - SUM(CASE WHEN b.result = 'WIN' AND b.marketBetType IN('MATCHBETTING','RACING')
     THEN ROUND(b.winAmount/100*(%s),2) ELSE 0 END)
  ) AS rateProfitLoss,
  ut.directUserRole AS roleName,
  (SUM(CASE WHEN b.result = 'LOSS' AND b.marketBetType='SESSION'
     THEN ROUND(b.lossAmount/100*(%s),2) ELSE 0 END)
   - SUM(CASE WHEN b.result = 'WIN' AND b.marketBetType='SESSION'
     THEN ROUND(b.winAmount/100*(%s),2) ELSE 0 END)
  ) AS sessionProfitLoss,
  (SUM(CASE WHEN b.result='LOSS' THEN ROUND(b.lossAmount/100*(%s),2) ELSE 0 END)
   - SUM(CASE WHEN b.result='WIN' THEN ROUND(b.winAmount/100*(%s),2) ELSE 0 END)
  ) AS totalLoss,
  ut.directUserId AS userId,
  ut.directUserName AS userName
FROM betPlaceds b
JOIN ( %s ) AS ut ON b.createBy = ANY(ut.userIds)
JOIN users u ON u.id = ut.directUserId
WHERE b.result IN('WIN','LOSS')
  AND b.deleteReason IS NULL
  AND ($1 IS NULL OR b.matchId = $1)
  AND ($6 IS NULL OR b.runnerId = $6)
GROUP BY ut.directUserId, b.matchId, ut.directUserRole, ut.directUserName
$dq$, userTreeSql,
      partnershipFactor, partnershipFactor,
      partnershipFactor, partnershipFactor,
      partnershipFactor, partnershipFactor,
      userTreeSql
    );

    RETURN QUERY EXECUTE finalSql
      USING pMatchId, pUserIds, pUserId, pSearchId, pRoleName,pRunnerId;
END;
$$;
`);
    }

    async down(queryRunner) {
        await queryRunner.query(`DROP FUNCTION IF EXISTS "getUserWiseBetProfitLoss" (UUID, NUMERIC, users_rolename_enum, NUMERIC, NUMERIC, UUID, VARCHAR);`);
    }
}
