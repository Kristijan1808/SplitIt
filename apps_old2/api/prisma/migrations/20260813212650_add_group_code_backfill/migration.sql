-- Add the column first so existing rows can be backfilled safely.
ALTER TABLE "groups"
  ADD COLUMN IF NOT EXISTS "code" TEXT;

ALTER TABLE "groups"
  ADD COLUMN IF NOT EXISTS "locked" BOOLEAN NOT NULL DEFAULT false;

-- Fill every existing row with a unique 6-character code before enforcing NOT NULL.
UPDATE "groups"
SET "code" = UPPER(SUBSTR(MD5(id::text || '-' || COALESCE("createdAt"::text, NOW()::text) || '-' || random()::text), 1, 6))
WHERE "code" IS NULL OR "code" = '';

ALTER TABLE "groups"
  ALTER COLUMN "code" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "groups_code_key"
  ON "groups"("code");
