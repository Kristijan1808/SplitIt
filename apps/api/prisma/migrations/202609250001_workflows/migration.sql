ALTER TABLE "groups" ADD COLUMN "ownerKey" TEXT, ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "avatar" TEXT NOT NULL DEFAULT '👥';
UPDATE "groups" SET "ownerKey" = 'user:' || "ownerUserId" WHERE "ownerUserId" IS NOT NULL;
ALTER TABLE "people" ADD COLUMN "identityKey" TEXT, ADD COLUMN "inactive" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "expenses" ADD COLUMN "sourceDraftId" TEXT, ADD COLUMN "deletedAt" TIMESTAMP(3), ADD COLUMN "billDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, ADD COLUMN "category" TEXT NOT NULL DEFAULT 'other';
UPDATE "expenses" SET "billDate" = "createdAt";
CREATE UNIQUE INDEX "expenses_sourceDraftId_key" ON "expenses"("sourceDraftId");
ALTER TABLE "expense_drafts" ADD COLUMN "requestId" TEXT, ADD COLUMN "confirmedExpenseId" TEXT, ADD COLUMN "billDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, ADD COLUMN "category" TEXT NOT NULL DEFAULT 'other', ADD COLUMN "requireResponses" BOOLEAN NOT NULL DEFAULT false;
UPDATE "expense_drafts" SET "billDate" = "createdAt";
CREATE UNIQUE INDEX "expense_drafts_requestId_key" ON "expense_drafts"("requestId");
CREATE TABLE "group_sessions" ("id" TEXT PRIMARY KEY, "groupId" TEXT NOT NULL REFERENCES "groups"("id") ON DELETE CASCADE, "key" TEXT NOT NULL, "role" TEXT NOT NULL DEFAULT 'MEMBER');
CREATE UNIQUE INDEX "group_sessions_groupId_key_key" ON "group_sessions"("groupId","key");
INSERT INTO "group_sessions" ("id","groupId","key","role") SELECT "id", "groupId", 'user:' || "userId", "role"::text FROM "group_members";
CREATE TABLE "draft_selections" ("id" TEXT PRIMARY KEY, "draftId" TEXT NOT NULL REFERENCES "expense_drafts"("id") ON DELETE CASCADE, "personId" TEXT NOT NULL, "status" TEXT NOT NULL, "updatedAt" TIMESTAMP(3) NOT NULL);
CREATE UNIQUE INDEX "draft_selections_draftId_personId_key" ON "draft_selections"("draftId","personId");
CREATE TABLE "settlement_transfers" ("id" TEXT PRIMARY KEY, "requestId" TEXT NOT NULL UNIQUE, "groupId" TEXT NOT NULL REFERENCES "groups"("id") ON DELETE CASCADE, "fromId" TEXT NOT NULL, "toId" TEXT NOT NULL, "amount" DECIMAL(12,2) NOT NULL CHECK ("amount">0), "note" TEXT, "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "creatorKey" TEXT NOT NULL, "voidedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CHECK ("fromId" <> "toId"));

CREATE UNIQUE INDEX "people_groupId_identityKey_key" ON "people"("groupId", "identityKey");
