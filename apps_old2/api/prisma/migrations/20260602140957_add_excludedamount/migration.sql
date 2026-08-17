-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "excludedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;
