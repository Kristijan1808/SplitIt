import { canManageBill } from "./bill-permissions.js";
import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { expenseActor, auditValue } from "./expense-audit.js";
import {
  prepareExpenseEdit,
  ExpenseInputError,
} from "./expense-edit.validation.js";
import { expenseDetailsInclude } from "../utils.js";
import { prisma } from "../core.js";
import { serializeExpense, serializeGroup } from "../utils.js";
import { ensureCanEditGroup, ensureCanViewGroup } from "./access.service.js";
import { groupService } from "./group.service.js";

export class ExpenseService {
  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const group = await prisma.group.findUnique({
        where: { slug: req.params.slug as string },
      });

      if (!group) {
        return res.status(404).json({ error: "Group not found" });
      }

      const access = await ensureCanViewGroup(group, req);

      if (!access.allowed) {
        return res.status(access.status).json({ error: access.error });
      }

      const expenses = await prisma.expense.findMany({
        where: { groupId: group.id },
        orderBy: { createdAt: "desc" },
        include: {
          payers: { include: { person: true } },
          items: {
            orderBy: { ordinalNumber: "asc" },
            include: { shares: { include: { person: true } } },
          },
          shares: { include: { person: true } },
        },
      });

      return res.json(expenses.map(serializeExpense));
    } catch (error) {
      next(error);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const group = await prisma.group.findUnique({
        where: { slug: req.params.slug as string },
      });

      if (!group) {
        return res.status(404).json({ error: "Group not found" });
      }

      const access = await ensureCanViewGroup(group, req);

      if (!access.allowed) {
        return res.status(access.status).json({ error: access.error });
      }

      const expense = await prisma.expense.findFirst({
        where: {
          id: req.params.expenseId as string,
          groupId: group.id,
        },
        include: {
          payers: { include: { person: true } },
          items: {
            orderBy: { ordinalNumber: "asc" },
            include: { shares: { include: { person: true } } },
          },
          shares: { include: { person: true } },
        },
      });

      if (!expense) {
        return res.status(404).json({ error: "Expense not found" });
      }

      return res.json(serializeExpense(expense));
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const group = await prisma.group.findUnique({
        where: { slug: req.params.slug as string },
      });
      if (!group) return res.status(404).json({ error: "Group not found" });
      const access = await ensureCanEditGroup(group, req);
      if (!access.allowed)
        return res.status(access.status).json({ error: access.error });
      if (group.locked)
        return res.status(423).json({ error: "Group is locked" });
      const actor = await expenseActor(req, group.id);
      const expense = await prisma.$transaction(
        async (tx) => {
          const liveGroup = await tx.group.findUniqueOrThrow({
            where: { id: group.id },
          });
          if (liveGroup.locked) throw new Error("Group is locked");
          const existing = await tx.expense.findFirst({
            where: { id: req.params.expenseId as string, groupId: group.id },
          });
          if (!existing) throw new Error("Expense not found");
          if (!canManageBill(existing, req))
            throw Object.assign(new Error("Samo autor može uređivati račun."), {
              status: 403,
            });
          const people = await tx.person.findMany({
            where: { groupId: group.id },
            select: { id: true },
          });
          const prepared = prepareExpenseEdit(
            req.body,
            people.map((p) => p.id),
          );
          if (
            existing.updatedAt.toISOString() !== prepared.body.expectedUpdatedAt
          )
            throw new Error("EXPENSE_CONFLICT");
          // Compare-and-set plus one transaction prevents partial replacements and stale overwrites.
          const updated = await tx.expense.updateMany({
            where: { id: existing.id, updatedAt: existing.updatedAt },
            data: {
              note: prepared.body.note || null,
              totalAmount: prepared.totalAmount,
              updatedAt: new Date(),
            },
          });
          if (updated.count !== 1) throw new Error("EXPENSE_CONFLICT");
          await tx.expensePayer.deleteMany({
            where: { expenseId: existing.id },
          });
          await tx.expenseItem.deleteMany({
            where: { expenseId: existing.id },
          });
          await tx.expenseShare.deleteMany({
            where: { expenseId: existing.id },
          });
          const result = await tx.expense.update({
            where: { id: existing.id },
            data: {
              payers: { create: prepared.body.payers },
              items: {
                create: prepared.items.map((i) => ({
                  ...i,
                  shares: { create: i.shares },
                })),
              },
              shares: { create: prepared.shares },
            },
            include: expenseDetailsInclude,
          });
          await tx.history.create({
            data: {
              groupId: group.id,
              action: "UPDATE",
              entity: "EXPENSE",
              entityId: existing.id,
              message: `${actor.name} updated "${result.note || "Račun"}" · €${prepared.totalAmount.toFixed(2)}`,
              oldValue: auditValue(actor, existing),
              newValue: auditValue(actor, result),
            },
          });
          return result;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return res.json(serializeExpense(expense));
    } catch (error) {
      if (error instanceof Error && error.message === "Group is locked")
        return res.status(423).json({ error: error.message });
      if (error instanceof Error && error.message === "Expense not found")
        return res.status(404).json({ error: error.message });
      if (error instanceof ExpenseInputError)
        return res.status(400).json({ error: error.message });
      if (
        (error instanceof Error && error.message === "EXPENSE_CONFLICT") ||
        (error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2034")
      )
        return res.status(409).json({
          error:
            "Račun je u međuvremenu promijenjen. Ponovno ga otvori prije uređivanja. / Expense changed; reopen before editing.",
        });
      next(error);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const group = await prisma.group.findUnique({
        where: { slug: req.params.slug as string },
      });

      if (!group) {
        return res.status(404).json({ error: "Group not found" });
      }

      const access = await ensureCanEditGroup(group, req);

      if (!access.allowed) {
        return res.status(access.status).json({ error: access.error });
      }

      const expense = await prisma.expense.findFirst({
        where: {
          id: req.params.expenseId as string,
          groupId: group.id,
        },
      });

      if (!expense) {
        return res.status(404).json({ error: "Expense not found" });
      }

      if (!canManageBill(expense, req))
        return res
          .status(403)
          .json({ error: "Samo autor može obrisati račun." });
      if (group.locked)
        return res.status(423).json({ error: "Group is locked" });
      const actor = await expenseActor(req, group.id);
      await prisma.$transaction(
        async (tx) => {
          const currentGroup = await tx.group.findUniqueOrThrow({
            where: { id: group.id },
          });
          if (currentGroup.locked) throw new Error("Group is locked");
          const current = await tx.expense.findFirstOrThrow({
            where: { id: expense.id, groupId: group.id },
          });
          await tx.expense.delete({ where: { id: expense.id } });
          await tx.history.create({
            data: {
              groupId: group.id,
              action: "DELETE",
              entity: "EXPENSE",
              entityId: expense.id,
              message: `${actor.name} deleted "${current.note || "Račun"}" · €${Number(current.totalAmount).toFixed(2)}`,
              oldValue: auditValue(actor, current),
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      const updated = await groupService.getGroupBySlug(
        req.params.slug as string,
      );

      if (!updated) {
        return res.status(404).json({ error: "Group not found" });
      }

      return res.json(serializeGroup(updated, access.user));
    } catch (error) {
      next(error);
    }
  };
}

export const expenseService = new ExpenseService();
