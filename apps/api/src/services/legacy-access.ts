import jwt from "jsonwebtoken";
import type { Request } from "express";
import { getJwtSecret } from "../core.js";

// Upgrade bridge only: a previously signed credential may prove ownership of
// existing group capabilities. It never loads a User, grants account access,
// creates membership or supplies ownerUserId for new groups.
export function legacyAccessKey(req: Request): string | null {
  const guest = req.get("X-SplitIt-Guest-Token");
  if (!guest || !/^[a-f0-9]{64}$/.test(guest)) return null;
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) return null;
  try {
    const payload = jwt.verify(authorization.slice(7), getJwtSecret(), { algorithms: ["HS256"] });
    if (typeof payload === "string" || typeof payload.userId !== "string" || !payload.userId) return null;
    return `user:${payload.userId}`;
  } catch { return null; }
}
