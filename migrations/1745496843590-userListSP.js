const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class UserListSP1745496843590 {
    name = 'UserListSP1745496843590'

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
  -- Get total count of matching users
  SELECT COUNT(*) INTO total_count
  FROM users u
  WHERE u."createBy" = createBy
    AND u."roleName" <> excludeRole
    AND u."deletedAt" IS NULL;

  -- Main data query returning array of rows as JSON
  WITH RECURSIVE
  filtered AS (
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
      row_to_json(ub) AS "userBal"
    FROM users u
    LEFT JOIN "userBalances" ub ON ub."userId" = u.id
    WHERE u."createBy" = createBy
      AND u."roleName" <> excludeRole
      AND u."deletedAt" IS NULL
	  AND u."userName" ILIKE '%'||keyword||'%'
    ORDER BY u."betBlock" ASC, u."userBlock" ASC, u."userName" ASC
    OFFSET offsetVal
    LIMIT limitVal
  ),
  rec AS (
    SELECT f.id, f.id AS root_id FROM filtered f
    UNION ALL
    SELECT u2.id, rec.root_id
    FROM users u2
    JOIN rec ON u2."createBy" = rec.id AND rec.root_id <> createBy
  ),
  child_sums AS (
    SELECT
      rec.root_id AS id,
      SUM(ub2."currentBalance") AS total_child_balance
    FROM rec
    JOIN "userBalances" ub2 ON ub2."userId" = rec.id
    GROUP BY rec.root_id
  ),
  user_data AS (
    SELECT
      f.id,
      f."betBlock",
      f."createdAt",
      f."creditRefrence",
      f."exposureLimit",
      f."fullName",
      f."matchComissionType",
      f."matchCommission",
      f."userName",
      f."roleName",
      f."sessionCommission",
      f."userBlock",
      CASE
        WHEN array_length(partnership, 1) = 0 THEN f.my_pl
        ELSE (
          (f.raw_pl::numeric / 100) *
          (SELECT COALESCE(SUM((to_jsonb(f)->>col)::numeric), 0)
           FROM unnest(partnership) AS col)
        )::numeric(12, 2)
      END AS "percentProfitLoss",
      CASE
        WHEN f."roleName" <> 'user' THEN f."currentBalance"
        ELSE (f."currentBalance" - f.exposure)
      END AS "availableBalance",
      COALESCE(cb.total_child_balance, 0) AS balance,
      CASE
        WHEN array_length(partnership, 1) = 0 THEN f.raw_comm::text
        ELSE
          (f.raw_comm::numeric)::text || ' (' ||
          (SELECT COALESCE(SUM((to_jsonb(f)->>col)::numeric), 0)
           FROM unnest(partnership) AS col)::text || '%)'
      END AS commission,
      (
        SELECT COALESCE(SUM((to_jsonb(f)->>col)::numeric), 0)
        FROM unnest(partnership) AS col
      ) AS "upLinePartnership",
      f."userBal",
      f."fwPartnership",
      f."faPartnership",
      f."saPartnership",
      f."aPartnership",
      f."smPartnership",
      f."mPartnership",
      f."agPartnership",
      f.city,
      f."phoneNumber"
    FROM filtered f
    LEFT JOIN child_sums cb ON cb.id = f.id ORDER BY f."betBlock" ASC, f."userBlock" ASC, f."userName" ASC
  ),
  data_json AS (
    SELECT json_agg(row_to_json(user_data)) AS data FROM user_data
  )
  SELECT json_build_object(
    'count', total_count,
    'list', data_json.data
  )
  INTO result
  FROM data_json;
  PERFORM set_config('enable_nestloop', 'off', false);
  RETURN result;
END;
$$;
`);
    }

    async down(queryRunner) {
        await queryRunner.query(`DROP FUNCTION IF EXISTS fetchUserList(uuid, users_rolename_enum, text[], integer, integer,text);"`);
    }
}
