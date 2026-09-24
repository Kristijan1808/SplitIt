import type { Request } from "express";
import { getUserFromRequest, prisma } from "../core.js";

// Participant identity is self-selected for guests; it is attribution, never authorization.
export async function expenseActor(req: Request, groupId: string) {
  const user = getUserFromRequest(req);
  if (user) return { name: user.username, userId: user.id, kind: "account" };
  const id = req.get("X-SplitIt-Participant-Id");
  const person = id
    ? await prisma.person.findFirst({
        where: { id, groupId },
        select: { id: true, name: true },
      })
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
