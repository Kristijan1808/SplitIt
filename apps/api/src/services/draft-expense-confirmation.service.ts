import { canManageBill } from "./bill-permissions.js";
import { expenseActor, auditValue } from "./expense-audit.js";
import type { NextFunction, Request, Response } from "express";
import {
  aggregateExpenseShares,
  moneyEqual,
  prisma,
  roundMoney,
} from "../core.js";
import { serializeExpense, serializeGroup } from "../utils.js";
import { ensureCanEditGroup } from "./access.service.js";
import { groupService } from "./group.service.js";

export class DraftExpenseConfirmationService {
  confirm = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const group = await prisma.group.findUnique({
        where: {
          slug: req.params.slug as string,
        },
      });

      if (!group) {
        return res.status(404).json({
          error: "Group not found",
        });
      }

      const access = await ensureCanEditGroup(group, req);

      if (!access.allowed) {
        return res.status(access.status).json({
          error: access.error,
        });
      }

      if (group.locked)
        return res.status(423).json({ error: "Group is locked" });
      const actor = await expenseActor(req, group.id);
      const draft = await prisma.expenseDraft.findFirst({
        where: {
          id: req.params.draftId as string,
          groupId: group.id,
        },

        include: {
          payers: true,

          items: {
            orderBy: {
              ordinalNumber: "asc",
            },

            include: {
              shares: true,
            },
          },
        },
      });

      if (!draft) {
        return res.status(404).json({
          error: "Draft bill not found",
        });
      }
      if (!canManageBill(draft, req))
        return res
          .status(403)
          .json({
            error:
              "Samo autor može uređivati i potvrditi ovaj račun. Označi svoje stavke kvačicom.",
          });

      if (draft.items.length === 0) {
        return res.status(400).json({
          error: "At least one item is required",
        });
      }

      if (draft.payers.length === 0) {
        return res.status(400).json({
          error: "At least one payer is required",
        });
      }

      //
      // Validate payer total.
      //
      const itemTotal = roundMoney(
        draft.items.reduce((sum, item) => sum + Number(item.price), 0),
      );

      const payerTotal = roundMoney(
        draft.payers.reduce((sum, payer) => sum + Number(payer.amount), 0),
      );

      if (!moneyEqual(itemTotal, payerTotal)) {
        return res.status(400).json({
          error: "The total paid amount must equal the total of all items",

          itemTotal,

          payerTotal,
        });
      }

      //
      // Every item must be assigned before confirmation.
      //
      const unassignedItems = draft.items.filter(
        (item) => item.shares.length === 0,
      );

      if (unassignedItems.length > 0) {
        return res.status(400).json({
          error:
            "All items must be assigned to at least one participant before confirming the bill",

          items: unassignedItems.map((item) => ({
            id: item.id,
            name: item.name,
          })),
        });
      }

      //
      // Verify every item has shares
      // whose total equals its price.
      //
      for (const item of draft.items) {
        const shareTotal = roundMoney(
          item.shares.reduce((sum, share) => sum + Number(share.amount), 0),
        );

        if (!moneyEqual(shareTotal, Number(item.price))) {
          return res.status(400).json({
            error: `Item "${item.name}" is not fully assigned`,

            item: {
              id: item.id,
              price: Number(item.price),
              assigned: shareTotal,
            },
          });
        }
      }

      //
      // Verify people belong to group.
      //
      const people = await prisma.person.findMany({
        where: {
          groupId: group.id,
        },

        select: {
          id: true,
        },
      });

      const validPersonIds = new Set(people.map((person) => person.id));

      const invalidPayer = draft.payers.find(
        (payer) => !validPersonIds.has(payer.personId),
      );

      if (invalidPayer) {
        return res.status(400).json({
          error: "Payer must be a participant in this group",
        });
      }

      for (const item of draft.items) {
        const invalidShare = item.shares.find(
          (share) => !validPersonIds.has(share.personId),
        );

        if (invalidShare) {
          return res.status(400).json({
            error: "Every item participant must belong to this group",
          });
        }
      }

      //
      // Calculate total owed per person.
      //
      const expenseShares = aggregateExpenseShares(draft.items);

      //
      // Create the finalized expense
      // atomically.
      //
      const expense = await prisma.$transaction(async (tx) => {
        const lock = await tx.expenseDraft.updateMany({
          where: { id: draft.id, updatedAt: draft.updatedAt },
          data: { updatedAt: new Date() },
        });
        if (lock.count !== 1)
          throw Object.assign(
            new Error("Nacrt je izmijenjen. Osvježi ga prije potvrde."),
            { status: 409 },
          );
        const createdExpense = await tx.expense.create({
          data: {
            creatorKey: draft.creatorKey,
            groupId: group.id,

            totalAmount: itemTotal,

            note: draft.note?.trim() || null,

            payers: {
              create: draft.payers.map((payer) => ({
                personId: payer.personId,
                amount: payer.amount,
              })),
            },

            items: {
              create: draft.items.map((item) => ({
                ordinalNumber: item.ordinalNumber,
                name: item.name,
                price: item.price,

                shares: {
                  create: item.shares.map((share) => ({
                    personId: share.personId,

                    amount: share.amount,
                  })),
                },
              })),
            },

            shares: {
              create: expenseShares.map((share) => ({
                personId: share.personId,

                amount: share.amount,
              })),
            },
          },

          include: {
            payers: {
              include: {
                person: true,
              },
            },

            items: {
              include: {
                shares: {
                  include: {
                    person: true,
                  },
                },
              },
            },

            shares: {
              include: {
                person: true,
              },
            },
          },
        });

        //
        // Save history.
        //
        await tx.history.create({
          data: {
            groupId: group.id,

            action: "CREATE",

            entity: "EXPENSE",

            entityId: createdExpense.id,

            message: `${actor.name} created "${createdExpense.note || "Račun"}" · €${itemTotal.toFixed(2)}`,
            newValue: auditValue(actor, createdExpense),
          },
        });

        //
        // Delete the draft.
        //
        await tx.expenseDraft.delete({
          where: {
            id: draft.id,
          },
        });

        return createdExpense;
      });

      const updated = await groupService.getGroupBySlug(
        req.params.slug as string,
      );

      res.status(201).json({
        expense: serializeExpense(expense),

        group: serializeGroup(updated!, access.user),
      });
    } catch (error) {
      next(error);
    }
  };
}

export const draftExpenseConfirmationService =
  new DraftExpenseConfirmationService();
