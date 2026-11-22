ALTER TABLE "expenses" ADD COLUMN "rateDate" TEXT, ADD COLUMN "rateSource" TEXT;
CREATE TABLE "fx_quotes" (
 "id" TEXT PRIMARY KEY, "groupId" TEXT NOT NULL, "base" TEXT NOT NULL, "quote" TEXT NOT NULL,
 "rate" DECIMAL(18,8) NOT NULL CHECK ("rate" > 0), "rateDate" TEXT NOT NULL,
 "source" TEXT NOT NULL, "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "expiresAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "fx_quotes_expiresAt_idx" ON "fx_quotes"("expiresAt");
