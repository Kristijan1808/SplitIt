ALTER TABLE "groups" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'EUR';
ALTER TABLE "expenses" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'EUR', ADD COLUMN "exchangeRate" DECIMAL(18,8) NOT NULL DEFAULT 1, ADD COLUMN "originalTotal" DECIMAL(12,2);
ALTER TABLE "expenses" ADD CONSTRAINT "expense_exchange_rate_positive" CHECK ("exchangeRate" > 0);
