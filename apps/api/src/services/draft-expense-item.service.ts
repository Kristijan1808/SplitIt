import type { NextFunction, Request, Response } from "express";
import {
  buildItemShares,
  prisma
} from "../core.js";
import * as schemas from "../schemas/schemas.js";
import {
  serializeDraftExpense
} from "../utils.js";
import { ensureCanEditGroup } from "./access.service.js";

export class DraftExpenseItemService {
  updateItem = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const body =
        schemas.updateDraftExpenseItemSchema.parse(
          req.body
        );

      const group =
        await prisma.group.findUnique({
          where: {
            slug: req.params.slug as string
          }
        });

      if (!group) {
        return res.status(404).json({
          error: "Group not found"
        });
      }

      const access =
        await ensureCanEditGroup(
          group,
          req
        );

      if (!access.allowed) {
        return res
          .status(access.status)
          .json({
            error: access.error
          });
      }

      const draft =
        await prisma.expenseDraft.findFirst({
          where: {
            id: req.params.draftId as string,
            groupId: group.id
          },

          include: {
            items: true
          }
        });

      if (!draft) {
        return res.status(404).json({
          error: "Draft bill not found"
        });
      }

      const item =
        draft.items.find(
          (entry) =>
            entry.id ===
            req.params.itemId
        );

      if (!item) {
        return res.status(404).json({
          error:
            "Draft item not found"
        });
      }

      const people =
        await prisma.person.findMany({
          where: {
            groupId: group.id
          },

          select: {
            id: true
          }
        });

      const validPersonIds =
        new Set(
          people.map(
            (person) => person.id
          )
        );

      //
      // Remove duplicates.
      //
      const uniqueShares =
        [
          ...new Map(
            body.shares.map(
              (share) => [
                share.personId,
                share
              ]
            )
          ).values()
        ];

      const invalidShare =
        uniqueShares.find(
          (share) =>
            !validPersonIds.has(
              share.personId
            )
        );

      if (invalidShare) {
        return res.status(400).json({
          error:
            "Participant not found in this group"
        });
      }

      const preparedShares =
        buildItemShares({
          price: Number(item.price),
          shares: uniqueShares
        });

      //
      // Replace all existing shares.
      //
      await prisma.$transaction(
        async (tx) => {
          await tx.expenseDraftItemShare.deleteMany(
            {
              where: {
                itemId: item.id
              }
            }
          );

          if (
            preparedShares.length >
            0
          ) {
            await tx.expenseDraftItemShare.createMany(
              {
                data:
                  preparedShares.map(
                    (share) => ({
                      itemId:
                        item.id,
                      personId:
                        share.personId,
                      amount:
                        share.amount
                    })
                  )
              }
            );
          }

          await tx.expenseDraftItem.update(
            {
              where: {
                id: item.id
              },

              data: {
                updatedAt:
                  new Date()
              }
            }
          );
        }
      );

      const updatedDraft =
        await prisma.expenseDraft.findUnique(
          {
            where: {
              id: draft.id
            },

            include: {
              payers: true,

              items: {
                orderBy: {
                  ordinalNumber: "asc"
                },

                include: {
                  shares: true
                }
              }
            }
          }
        );

      res.json(
        serializeDraftExpense(
          updatedDraft!
        )
      );
    } catch (error) {
      next(error);
    }
  
  };

}

export const draftExpenseItemService = new DraftExpenseItemService();
