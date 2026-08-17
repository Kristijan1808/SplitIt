-- CreateTable
CREATE TABLE "expense_draft_payers" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_draft_payers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "expense_draft_payers_draftId_personId_key" ON "expense_draft_payers"("draftId", "personId");

-- AddForeignKey
ALTER TABLE "expense_draft_payers" ADD CONSTRAINT "expense_draft_payers_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "expense_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_draft_payers" ADD CONSTRAINT "expense_draft_payers_personId_fkey" FOREIGN KEY ("personId") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;
