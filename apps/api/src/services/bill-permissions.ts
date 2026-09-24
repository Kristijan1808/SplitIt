import { createHash, randomBytes } from "node:crypto";
import type { Request, RequestHandler } from "express";
import { getUserFromRequest } from "../core.js";
export function billKeys(req: Request): string[] {
  const keys: string[] = [];
  const user = getUserFromRequest(req);
  if (user) keys.push(`user:${user.id}`);
  const guest = req.get("X-SplitIt-Guest-Token");
  if (guest && /^[a-f0-9]{64}$/.test(guest))
    keys.push(`guest:${createHash("sha256").update(guest).digest("hex")}`);
  return keys;
}
export function canManageBill(
  bill: { creatorKey: string | null },
  req: Request,
) {
  return !!bill.creatorKey && billKeys(req).includes(bill.creatorKey);
}
export function creatorKey(req: Request) {
  const key = billKeys(req)[0];
  if (!key)
    throw Object.assign(
      new Error("Ponovno otvori aplikaciju za uspostavu identiteta autora."),
      { status: 401 },
    );
  return key;
}
export const guestSession: RequestHandler = (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({ token: randomBytes(32).toString("hex") });
};
// Only permissions leave the server; never expose the guest token hash or user ownership key.
export function publicBills(value: any, keys: string[]): any {
  if (Array.isArray(value)) return value.map((v) => publicBills(v, keys));
  if (!value || typeof value !== "object" || value instanceof Date)
    return value;
  const { creatorKey: owner, ...rest } = value;
  const result = Object.fromEntries(
    Object.entries(rest).map(([k, v]) => [k, publicBills(v, keys)]),
  );
  if (Object.prototype.hasOwnProperty.call(value, "creatorKey")) {
    result.canManage = !!owner && keys.includes(owner);
    result.legacyOwner = owner === null;
  }
  return result;
}
export const billPermissions: RequestHandler = (req, res, next) => {
  res.setHeader("Cache-Control", "private, no-store");
  const json = res.json.bind(res);
  res.json = (body) => json(publicBills(body, billKeys(req)));
  next();
};
