import { PrismaClient, Prisma } from "@prisma/client";
import "dotenv/config";


export const prisma = new PrismaClient({
  log: [{ emit: "event", level: "query" }]
});

prisma.$on("query", (event) => {
  console.info(`[db] ${event.duration}ms ${event.query}`);
});


export const calculateEqualShares = (amount: number, personIds: string[]) => {
  if (personIds.length === 0) return [];

  const cents = Math.round(amount * 100);
  return personIds.map(
    (_, index) =>
      (Math.floor(cents / personIds.length) +
        (index < cents % personIds.length ? 1 : 0)) /
      100,
  );
};

export type ItemShareInput = {
  personId: string;
  amount?: number;
};

export type ItemInput = {
  price: number;
  shares: ItemShareInput[];
};

export const buildItemShares = (item: ItemInput) => {
  if (item.shares.length === 0) return [];

  const hasExplicitAmount = item.shares.some(
    (share) => share.amount !== undefined,
  );

  if (!hasExplicitAmount) {
    const amounts = calculateEqualShares(
      item.price,
      item.shares.map((share) => share.personId),
    );

    return item.shares.map((share, index) => ({
      personId: share.personId,
      amount: amounts[index],
    }));
  }

  if (item.shares.some((share) => share.amount === undefined)) {
    throw new Error(
      "Either all item share amounts must be provided or all must be omitted",
    );
  }

  const total = item.shares.reduce(
    (sum, share) => sum + Number(share.amount),
    0,
  );

  if (!moneyEqual(total, item.price)) {
    throw new Error(
      `Item shares (${total.toFixed(2)}) must equal item price (${item.price.toFixed(2)})`,
    );
  }

  return item.shares.map((share) => ({
    personId: share.personId,
    amount: roundMoney(share.amount as number),
  }));
};

export const aggregateExpenseShares = (
  items: Array<{
    shares: Array<{
      personId: string;
      amount: number | Prisma.Decimal;
    }>;
  }>,
) => {
  const totals = new Map<string, number>();

  for (const item of items) {
    for (const share of item.shares) {
      const current = totals.get(share.personId) ?? 0;
      totals.set(share.personId, roundMoney(current + Number(share.amount)));
    }
  }

  return [...totals.entries()].map(([personId, amount]) => ({
    personId,
    amount: roundMoney(amount),
  }));
};

export const roundMoney = (value: number) => Number(value.toFixed(2));

export const moneyEqual = (a: number, b: number) => Math.abs(a - b) < 0.01;

