import type { NextFunction, Request, Response } from "express";
import {
  prisma
} from "../core.js";
import * as schemas from "../schemas/schemas.js";
import {
  serializeDraftExpense
} from "../utils.js";
import { ensureCanEditGroup } from "./access.service.js";

export class DraftExpensePayerService {
  updatePayers = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const body =
        schemas.updateDraftExpensePayersSchema.parse(
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
          }
        });

      if (!draft) {
        return res.status(404).json({
          error: "Draft bill not found"
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

      const duplicateIds =
        new Set(
          body.payers.map(
            (payer) =>
              payer.personId
          )
        );

      if (
        duplicateIds.size !==
        body.payers.length
      ) {
        return res.status(400).json({
          error:
            "A participant can only be added as a payer once"
        });
      }

      const invalid =
        body.payers.find(
          (payer) =>
            !validPersonIds.has(
              payer.personId
            )
        );

      if (invalid) {
        return res.status(400).json({
          error:
            "Payer must be a participant in this group"
        });
      }

      await prisma.$transaction(
        async (tx) => {
          await tx.expenseDraftPayer.deleteMany(
            {
              where: {
                draftId: draft.id
              }
            }
          );

          if (body.payers.length > 0) {
            await tx.expenseDraftPayer.createMany(
              {
                data:
                  body.payers.map(
                    (payer) => ({
                      draftId:
                        draft.id,
                      personId:
                        payer.personId,
                      amount:
                        payer.amount
                    })
                  )
              }
            );
          }

          await tx.expenseDraft.update({
            where: {
              id: draft.id
            },

            data: {
              updatedAt:
                new Date()
            }
          });
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

export const draftExpensePayerService = new DraftExpensePayerService();
