ALTER TABLE "expenses" ADD COLUMN "creatorKey" TEXT;
ALTER TABLE "expense_drafts" ADD COLUMN "creatorKey" TEXT;

-- Backfill only known, authenticated creators recorded by the previous audit format.
-- Anonymous historical records remain unclaimed; payer identity is not authorship.
UPDATE "expenses" e
SET "creatorKey" = 'user:' || (h.meta->'actor'->>'userId')
FROM (
  SELECT DISTINCT ON ("entityId") "entityId",
    CASE WHEN "newValue" LIKE '{"version":2,%'
      THEN "newValue"::jsonb ELSE '{}'::jsonb END AS meta
  FROM "history"
  WHERE "entity" = 'EXPENSE' AND "action" = 'CREATE'
  ORDER BY "entityId", "createdAt" ASC
) h
WHERE e.id = h."entityId"
  AND h.meta->'actor'->>'kind' = 'account'
  AND COALESCE(h.meta->'actor'->>'userId', '') <> '';
