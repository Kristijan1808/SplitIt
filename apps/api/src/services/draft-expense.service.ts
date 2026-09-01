import type { NextFunction, Request, Response } from "express";
import {
  buildItemShares,
  prisma
} from "../core.js";
import {
  createDraftExpenseSchema
} from "../schemas/schemas.js";
import { serializeDraftExpense } from "../utils.js";
import { ensureCanEditGroup, ensureCanViewGroup } from "./access.service.js";

export class DraftExpenseService {
  list = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const group = await prisma.group.findUnique({
        where: { slug: req.params.slug as string },
        include: {
          draftExpenses: {
            orderBy: { createdAt: "desc" },
            include: {
              payers: true,
              items: {
                orderBy: { createdAt: "asc" },
                include: { shares: true }
              }
            }
          }
        }
      });

      if (!group) {
        return res.status(404).json({ error: "Group not found" });
      }

      const access = await ensureCanViewGroup(group, req);

      if (!access.allowed) {
        return res.status(access.status).json({ error: access.error });
      }

      return res.json(group.draftExpenses.map(serializeDraftExpense));
    } catch (error) {
      next(error);
    }
  };

  create = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const body = createDraftExpenseSchema.parse(req.body);
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

      const people = await prisma.person.findMany({
        where: { groupId: group.id },
        select: { id: true }
      });
      const validPersonIds = new Set(people.map((person) => person.id));

      const payerIds = body.payers.map((payer) => payer.personId);

      if (new Set(payerIds).size !== payerIds.length) {
        return res.status(400).json({
          error: "A participant can only be added as a payer once"
        });
      }

      const invalidPayer = body.payers.find(
        (payer) => !validPersonIds.has(payer.personId)
      );

      if (invalidPayer) {
        return res.status(400).json({
          error: "Payer must be a participant in this group"
        });
      }

      const preparedItems = body.items.map((item) => {
        const name = item.name.trim();

        if (!name) {
          throw new Error("Item name cannot be empty");
        }

        if (!Number.isFinite(item.price) || item.price < 0) {
          throw new Error(`Invalid price for item "${name}"`);
        }

        const uniqueShares = [
          ...new Map(item.shares.map((share) => [share.personId, share])).values()
        ];

        const invalidShare = uniqueShares.find(
          (share) => !validPersonIds.has(share.personId)
        );

        if (invalidShare) {
          throw new Error(
            `Participant ${invalidShare.personId} is not in this group`
          );
        }

        return {
          name,
          price: item.price,
          shares: buildItemShares({
            price: item.price,
            shares: uniqueShares
          })
        };
      });

      const nextDraft = await prisma.expenseDraft.create({
        data: {
          groupId: group.id,
          note: body.note?.trim() || null,
          payers: {
            create: body.payers.map((payer) => ({
              personId: payer.personId,
              amount: payer.amount
            }))
          },
          items: {
            create: preparedItems.map((item) => ({
              name: item.name,
              price: item.price,
              shares: item.shares.length > 0
                ? {
                    create: item.shares.map((share) => ({
                      personId: share.personId,
                      amount: share.amount
                    }))
                  }
                : undefined
            }))
          }
        },
        include: {
          payers: true,
          items: {
            orderBy: { createdAt: "asc" },
            include: { shares: true }
          }
        }
      });

      return res.status(201).json(serializeDraftExpense(nextDraft));
    } catch (error) {
      next(error);
    }
  };
}

export const draftExpenseService = new DraftExpenseService();
