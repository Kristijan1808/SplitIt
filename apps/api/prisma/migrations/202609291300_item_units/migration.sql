ALTER TABLE "expense_items" ADD COLUMN "splitMode" TEXT NOT NULL DEFAULT 'shared';
ALTER TABLE "expense_item_shares" ADD COLUMN "units" INTEGER;
ALTER TABLE "expense_items" ADD CONSTRAINT "expense_items_split_mode" CHECK ("splitMode" IN ('shared', 'units'));
ALTER TABLE "expense_item_shares" ADD CONSTRAINT "expense_item_shares_positive_units" CHECK ("units" IS NULL OR "units" > 0);
