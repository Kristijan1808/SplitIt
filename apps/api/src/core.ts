
import { PrismaClient, Prisma } from "@prisma/client";
import jwt from "jsonwebtoken";
import express from "express";
import "dotenv/config";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-me";

export const prisma = new PrismaClient();

export type AuthUser = {
  id: string;
  username: string;
};

export const calculateEqualShares = (
  amount: number,
  personIds: string[]
) => {
  if (personIds.length === 0) return [];

  const base = roundMoney(amount / personIds.length);

  return personIds.map((_, index) => {
    if (index === personIds.length - 1) {
      const previousTotal = base * (personIds.length - 1);
      return roundMoney(amount - previousTotal);
    }

    return base;
  });
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
    (share) => share.amount !== undefined
  );

  if (!hasExplicitAmount) {
    const amounts = calculateEqualShares(
      item.price,
      item.shares.map((share) => share.personId)
    );

    return item.shares.map((share, index) => ({
      personId: share.personId,
      amount: amounts[index]
    }));
  }

  if (item.shares.some((share) => share.amount === undefined)) {
    throw new Error(
      "Either all item share amounts must be provided or all must be omitted"
    );
  }

  const total = item.shares.reduce(
    (sum, share) => sum + Number(share.amount),
    0
  );

  if (!moneyEqual(total, item.price)) {
    throw new Error(
      `Item shares (${total.toFixed(2)}) must equal item price (${item.price.toFixed(2)})`
    );
  }

  return item.shares.map((share) => ({
    personId: share.personId,
    amount: roundMoney(share.amount as number)
  }));
};

export const aggregateExpenseShares = (
  items: Array<{
    shares: Array<{
      personId: string;
      amount: number  | Prisma.Decimal;
    }>;
  }>
) => {
  const totals = new Map<string, number>();

  for (const item of items) {
    for (const share of item.shares) {
      const current = totals.get(share.personId) ?? 0;
      totals.set(
        share.personId,
        roundMoney(current + Number(share.amount))
      );
    }
  }

  return [...totals.entries()].map(([personId, amount]) => ({
    personId,
    amount: roundMoney(amount)
  }));
};


export const roundMoney = (value: number) =>
  Number(value.toFixed(2));

export const moneyEqual = (a: number, b: number) =>
  Math.abs(a - b) < 0.01;


export const getUserFromRequest = (
  req: express.Request
): AuthUser | null => {
  const token = getTokenFromRequest(req);

  if (!token) {
    return null;
  }

  try {
    const payload = jwt.verify(
      token,
      JWT_SECRET
    ) as {
      userId: string;
      username: string;
    };

    return {
      id: payload.userId,
      username: payload.username
    };
  } catch {
    return null;
  }
};

const getTokenFromRequest = (req: express.Request) => {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  return header.slice("Bearer ".length);
};

export const normalizeUsername = (username: string) =>
  username.trim().toLowerCase();

export const createToken = (user: AuthUser) => {
  return jwt.sign(
    {
      userId: user.id,
      username: user.username
    },
    JWT_SECRET,
    {
      expiresIn: "30d"
    }
  );
};