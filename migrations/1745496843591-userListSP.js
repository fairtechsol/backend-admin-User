const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class UserListSP1745496843591 {
    name = 'UserListSP1745496843591'

    async up(queryRunner) {
        await queryRunner.query(`
CREATE OR REPLACE FUNCTION fetchUserList(
  createBy uuid,
  excludeRole users_rolename_enum,
  partnership text[] DEFAULT ARRAY[]::text[],
  offsetVal integer DEFAULT 0,
  limitVal integer DEFAULT 10,
  keyword text DEFAULT ''
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
    }

    async down(queryRunner) {
        await queryRunner.query(`DROP FUNCTION IF EXISTS fetchUserList(uuid, users_rolename_enum, text[], integer, integer,text);"`);
    }
}
