import type { NextFunction, Request, Response } from "express";
import { prisma } from "../core.js";
import { serializeExpense, serializeGroup } from "../utils.js";
import { ensureCanEditGroup, ensureCanViewGroup } from "./access.service.js";
import { groupService } from "./group.service.js";

export class ExpenseService {
  list = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const group = await prisma.group.findUnique({
        where: { slug: req.params.slug as string }
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
            orderBy: { createdAt: "asc" },
            include: { shares: { include: { person: true } } }
          },
          shares: { include: { person: true } }
        }
      });

      return res.json(expenses.map(serializeExpense));
    } catch (error) {
      next(error);
    }
  };

  get = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const group = await prisma.group.findUnique({
        where: { slug: req.params.slug as string }
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
          groupId: group.id
        },
        include: {
          payers: { include: { person: true } },
          items: {
            orderBy: { createdAt: "asc" },
            include: { shares: { include: { person: true } } }
          },
          shares: { include: { person: true } }
        }
      });

      if (!expense) {
        return res.status(404).json({ error: "Expense not found" });
      }

      return res.json(serializeExpense(expense));
    } catch (error) {
      next(error);
    }
  };

  remove = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const group = await prisma.group.findUnique({
        where: { slug: req.params.slug as string }
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
          groupId: group.id
        }
      });

      if (!expense) {
        return res.status(404).json({ error: "Expense not found" });
      }

      await prisma.expense.delete({ where: { id: expense.id } });

      await prisma.history.create({
        data: {
          groupId: group.id,
          action: "DELETE",
          entity: "EXPENSE",
          entityId: expense.id,
          message: `Expense of €${Number(expense.totalAmount).toFixed(2)} was deleted`,
          oldValue: String(expense.totalAmount)
        }
      });

      const updated = await groupService.getGroupBySlug(req.params.slug as string);

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
