import type { RequestHandler } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma, aggregateExpenseShares } from "../core.js";
import {
  serializeDraftExpense,
  serializeExpense,
  expenseDetailsInclude,
} from "../utils.js";
import { ensureCanEditGroup } from "./access.service.js";
import { billKeys } from "./bill-permissions.js";
import { expenseActor, auditValue } from "./expense-audit.js";
const fail = (message: string, status = 400) =>
  Object.assign(new Error(message), { status });
export function ownShares(
  price: number,
  current: { personId: string }[],
  personId: string,
  selected: boolean,
  finalized: boolean,
) {
  const ids = [
    ...new Set(current.map((s) => s.personId).filter((id) => id !== personId)),
  ];
  if (selected) ids.push(personId);
  ids.sort();
  if (finalized && !ids.length)
    throw fail(
      "Potvrđena stavka mora imati barem jednu osobu. Najprije neka je označi drugi sudionik.",
    );
  const cents = Math.round(price * 100);
  return ids.map((id, i) => ({
    personId: id,
    amount:
      (Math.floor(cents / ids.length) + (i < cents % ids.length ? 1 : 0)) / 100,
  }));
}
export const ownItem =
  (finalized: boolean): RequestHandler =>
  async (req, res, next) => {
    try {
      const { selected } = z
        .object({ selected: z.boolean() })
        .strict()
        .parse(req.body);
      const group = await prisma.group.findUnique({
        where: { slug: req.params.slug as string },
      });
      if (!group) throw fail("Group not found", 404);
      const access = await ensureCanEditGroup(group, req);
      if (!access.allowed)
        return res.status(access.status).json({ error: access.error });
      if (!billKeys(req).length) throw fail("Ponovno otvori aplikaciju.", 401);
      // Guest groups intentionally use a self-selected participant, as in the existing group identity flow.
      const personId = req.get("X-SplitIt-Participant-Id");
      if (
        !personId ||
        !(await prisma.person.findFirst({
          where: { id: personId, groupId: group.id },
        }))
      )
        throw fail("Najprije odaberi sebe u Sudionicima.");
      const actor = await expenseActor(req, group.id);
      const result = await prisma.$transaction(
        async (tx) => {
          const currentGroup = await tx.group.findUniqueOrThrow({
            where: { id: group.id },
          });
          if (currentGroup.locked) throw fail("Grupa je zaključana.", 423);
          const id = (
            finalized ? req.params.expenseId : req.params.draftId
          ) as string;
          if (finalized) {
            const bill = await tx.expense.findFirst({
              where: { id, groupId: group.id },
            });
            if (!bill) throw fail("Expense not found", 404);
            await tx.expense.update({
              where: { id },
              data: { updatedAt: new Date() },
            });
            const item = await tx.expenseItem.findFirst({
              where: { id: req.params.itemId as string, expenseId: id },
              include: { shares: true },
            });
            if (!item) throw fail("Item not found", 404);
            if (item.shares.some((s) => s.personId === personId) === selected)
              return serializeExpense(
                await tx.expense.findUniqueOrThrow({
                  where: { id },
                  include: expenseDetailsInclude,
                }),
              );
            const shares = ownShares(
              Number(item.price),
              item.shares,
              personId,
              selected,
              true,
            );
            await tx.expenseItemShare.deleteMany({
              where: { itemId: item.id },
            });
            await tx.expenseItemShare.createMany({
              data: shares.map((s) => ({ ...s, itemId: item.id })),
            });
            const items = await tx.expenseItem.findMany({
              where: { expenseId: id },
              include: { shares: true },
            });
            await tx.expenseShare.deleteMany({ where: { expenseId: id } });
            await tx.expenseShare.createMany({
              data: aggregateExpenseShares(items).map((s) => ({
                ...s,
                expenseId: id,
              })),
            });
            const updated = await tx.expense.findUniqueOrThrow({
              where: { id },
              include: expenseDetailsInclude,
            });
            await tx.history.create({
              data: {
                groupId: group.id,
                entity: "EXPENSE",
                entityId: id,
                action: "UPDATE",
                message: `${actor.name}: ${item.name}`,
                newValue: auditValue(actor, updated, {
                  selection: { personId, itemId: item.id, selected },
                }),
              },
            });
            return serializeExpense(updated);
          }
          const draft = await tx.expenseDraft.findFirst({
            where: { id, groupId: group.id },
          });
          if (!draft) throw fail("Draft not found", 404);
          await tx.expenseDraft.update({
            where: { id },
            data: { updatedAt: new Date() },
          });
          const item = await tx.expenseDraftItem.findFirst({
            where: { id: req.params.itemId as string, draftId: id },
            include: { shares: true },
          });
          if (!item) throw fail("Item not found", 404);
          if (item.shares.some((s) => s.personId === personId) === selected)
            return serializeDraftExpense(
              await tx.expenseDraft.findUniqueOrThrow({
                where: { id },
                include: {
                  payers: true,
                  items: {
                    orderBy: { ordinalNumber: "asc" },
                    include: { shares: true },
                  },
                },
              }),
            );
          const shares = ownShares(
            Number(item.price),
            item.shares,
            personId,
            selected,
            false,
          );
          await tx.expenseDraftItemShare.deleteMany({
            where: { itemId: item.id },
          });
          if (shares.length)
            await tx.expenseDraftItemShare.createMany({
              data: shares.map((s) => ({ ...s, itemId: item.id })),
            });
          return serializeDraftExpense(
            await tx.expenseDraft.findUniqueOrThrow({
              where: { id },
              include: {
                payers: true,
                items: {
                  orderBy: { ordinalNumber: "asc" },
                  include: { shares: true },
                },
              },
            }),
          );
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      res.json(result);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        ["P2034", "P2025"].includes(e.code)
      )
        return res
          .status(409)
          .json({
            error:
              "Račun je upravo izmijenjen. Osvježi i ponovno označi stavku.",
          });
      next(e);
    }
  };
