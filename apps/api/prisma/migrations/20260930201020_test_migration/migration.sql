-- DropForeignKey
ALTER TABLE "draft_selections" DROP CONSTRAINT "draft_selections_draftId_fkey";

-- DropForeignKey
ALTER TABLE "group_sessions" DROP CONSTRAINT "group_sessions_groupId_fkey";

-- DropForeignKey
ALTER TABLE "settlement_transfers" DROP CONSTRAINT "settlement_transfers_groupId_fkey";

-- AddForeignKey
ALTER TABLE "group_sessions" ADD CONSTRAINT "group_sessions_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft_selections" ADD CONSTRAINT "draft_selections_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "expense_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement_transfers" ADD CONSTRAINT "settlement_transfers_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
