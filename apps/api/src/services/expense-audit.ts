import { billKeys } from "./bill-permissions.js";
import type { Request } from "express";
import { prisma, getUserFromRequest } from "../core.js";

// Participant identity is self-selected for guests; it is attribution, never authorization.
export async function expenseActor(
  req: Request,
  groupId: string,
  participant?: { id: string; name: string },
) {
  if (participant)
    return { name: participant.name, participantId: participant.id, kind: "participant" };
  const id = req.get("X-SplitIt-Participant-Id");
  // Sudionik se prepoznaje po uređaju (gost) ili po prijavljenom računu; prije se račun nije
  // gledao pa je u povijesti pisalo "Gost" za prijavljene korisnike.
  const user = getUserFromRequest(req);
  const person = id
    ? await prisma.person.findFirst({
        where: { id, groupId, OR: [{ identityKey: { in: billKeys(req) } }, ...(user ? [{ userId: user.id }] : [])] },
        select: { id: true, name: true },
      })
    : user
      ? await prisma.person.findFirst({ where: { groupId, userId: user.id, inactive: false }, select: { id: true, name: true } })
      : null;
  return person
    ? { name: person.name, participantId: person.id, kind: "participant" }
    : { name: "Gost", kind: "guest" };
}
export function auditValue(
  actor: Awaited<ReturnType<typeof expenseActor>>,
  expense: { id: string; note?: string | null; totalAmount: unknown },
  extra: object = {},
) {
  return JSON.stringify({
    version: 2,
    actor,
    expenseId: expense.id,
    title: expense.note?.trim() || "Račun",
    total: Number(expense.totalAmount),
    ...extra,
  });
}
