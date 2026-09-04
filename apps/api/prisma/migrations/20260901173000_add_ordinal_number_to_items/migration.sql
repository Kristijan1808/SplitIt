-- Add stable ordinal numbers to draft and finalized expense items.
ALTER TABLE "expense_draft_items"
ADD COLUMN "ordinalNumber" INTEGER;

WITH numbered AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "draftId"
      ORDER BY "createdAt" ASC, "id" ASC
    )::INTEGER AS ordinal_number
  FROM "expense_draft_items"
)
UPDATE "expense_draft_items" AS item
SET "ordinalNumber" = numbered.ordinal_number
FROM numbered
WHERE item."id" = numbered."id";

ALTER TABLE "expense_draft_items"
ALTER COLUMN "ordinalNumber" SET NOT NULL;

ALTER TABLE "expense_draft_items"
ADD CONSTRAINT "expense_draft_items_draftId_ordinalNumber_key"
UNIQUE ("draftId", "ordinalNumber");

ALTER TABLE "expense_items"
ADD COLUMN "ordinalNumber" INTEGER;

WITH numbered AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "expenseId"
      ORDER BY "createdAt" ASC, "id" ASC
    )::INTEGER AS ordinal_number
  FROM "expense_items"
)
UPDATE "expense_items" AS item
SET "ordinalNumber" = numbered.ordinal_number
FROM numbered
WHERE item."id" = numbered."id";

ALTER TABLE "expense_items"
ALTER COLUMN "ordinalNumber" SET NOT NULL;

ALTER TABLE "expense_items"
ADD CONSTRAINT "expense_items_expenseId_ordinalNumber_key"
UNIQUE ("expenseId", "ordinalNumber");
