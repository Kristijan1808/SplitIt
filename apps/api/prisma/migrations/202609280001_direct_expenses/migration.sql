BEGIN;
-- Preserve historical drafts while importing each unconfirmed draft once as an expense.
ALTER TABLE "expenses" ADD COLUMN "requestId" TEXT;
CREATE UNIQUE INDEX "expenses_requestId_key" ON "expenses"("requestId");
ALTER TABLE "expense_items" ADD COLUMN "quantity" INTEGER NOT NULL DEFAULT 1 CHECK ("quantity" >= 1);
INSERT INTO "expenses" ("id","groupId","creatorKey","sourceDraftId","requestId","totalAmount","note","createdAt","updatedAt","billDate","category")
SELECT d.id,d."groupId",d."creatorKey",d.id,d."requestId",COALESCE((SELECT SUM(i.price) FROM "expense_draft_items" i WHERE i."draftId"=d.id),0),d.note,d."createdAt",d."updatedAt",d."billDate",d.category
FROM "expense_drafts" d WHERE d."confirmedExpenseId" IS NULL;
INSERT INTO "expense_payers" (id,"expenseId","personId",amount,"createdAt","updatedAt") SELECT p.id,p."draftId",p."personId",p.amount,p."createdAt",p."updatedAt" FROM "expense_draft_payers" p JOIN "expenses" e ON e."sourceDraftId"=p."draftId" JOIN "expense_drafts" d ON d.id=p."draftId" WHERE d."confirmedExpenseId" IS NULL;
INSERT INTO "expense_items" (id,"expenseId","ordinalNumber",name,price,"createdAt","updatedAt") SELECT i.id,i."draftId",i."ordinalNumber",i.name,i.price,i."createdAt",i."updatedAt" FROM "expense_draft_items" i JOIN "expenses" e ON e."sourceDraftId"=i."draftId" JOIN "expense_drafts" d ON d.id=i."draftId" WHERE d."confirmedExpenseId" IS NULL;
INSERT INTO "expense_item_shares" (id,"itemId","personId",amount,"createdAt","updatedAt") SELECT s.id,s."itemId",s."personId",s.amount,s."createdAt",s."updatedAt" FROM "expense_draft_item_shares" s JOIN "expense_draft_items" i ON i.id=s."itemId" JOIN "expense_drafts" d ON d.id=i."draftId" WHERE d."confirmedExpenseId" IS NULL;
INSERT INTO "expense_shares" (id,"expenseId","personId",amount,"createdAt","updatedAt") SELECT 'import-'||i."draftId"||'-'||s."personId",i."draftId",s."personId",SUM(s.amount),CURRENT_TIMESTAMP,CURRENT_TIMESTAMP FROM "expense_draft_item_shares" s JOIN "expense_draft_items" i ON i.id=s."itemId" JOIN "expense_drafts" d ON d.id=i."draftId" WHERE d."confirmedExpenseId" IS NULL GROUP BY i."draftId",s."personId";
UPDATE "expense_drafts" SET "confirmedExpenseId"=id WHERE "confirmedExpenseId" IS NULL;
-- Block old server instances from creating invisible drafts during the deployment handover.
ALTER TABLE "expense_drafts" ADD CONSTRAINT "expense_drafts_archive_only" CHECK ("confirmedExpenseId" IS NOT NULL);

COMMIT;
