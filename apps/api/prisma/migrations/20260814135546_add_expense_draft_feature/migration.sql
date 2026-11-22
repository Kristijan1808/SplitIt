-- CreateTable
CREATE TABLE "expense_drafts" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_draft_items" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "assignedPersonId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_draft_items_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "expense_drafts" ADD CONSTRAINT "expense_drafts_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_draft_items" ADD CONSTRAINT "expense_draft_items_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "expense_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_draft_items" ADD CONSTRAINT "expense_draft_items_assignedPersonId_fkey" FOREIGN KEY ("assignedPersonId") REFERENCES "people"("id") ON DELETE SET NULL ON UPDATE CASCADE;
