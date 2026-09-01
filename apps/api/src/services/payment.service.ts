import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import {
  calculateEqualShares,
  prisma
} from "../core.js";
import {
  serializeGroup,
  serializePaymentFromPayer
} from "../utils.js";
import { ensureCanEditGroup, ensureCanViewGroup } from "./access.service.js";
import { groupService } from "./group.service.js";

export class PaymentService {
  listPayments = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
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
        await ensureCanViewGroup(
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

      const expenses =
        await prisma.expense.findMany({
          where: {
            groupId: group.id
          },

          orderBy: {
            createdAt: "desc"
          },

          include: {
            payers: {
              include: {
                person: true
              }
            }
          }
        });

      const payments =
        expenses.flatMap(
          (expense) =>
            expense.payers.map(
              (payer) =>
                serializePaymentFromPayer(
                  {
                    ...payer,
                    expense
                  }
                )
            )
        );

      res.json(payments);
    } catch (error) {
      next(error);
    }
  
  };

  createPayment = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const body = z.object({
        personId:
          z.string().min(1),

        amount:
          z.number().positive(),

        note:
          z.string().max(200).optional()
      }).parse(req.body);

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

      const person =
        await prisma.person.findFirst({
          where: {
            id: body.personId,
            groupId: group.id
          }
        });

      if (!person) {
        return res.status(404).json({
          error:
            "Person not found"
        });
      }

      //
      // A simple payment has no item breakdown.
      //
      // We create an expense with one synthetic item
      // assigned to all group participants equally.
      //
      const allPeople =
        await prisma.person.findMany({
          where: {
            groupId: group.id
          },

          select: {
            id: true
          }
        });

      const shareAmounts =
        calculateEqualShares(
          body.amount,
          allPeople.map(
            (person) =>
              person.id
          )
        );

      const expense =
        await prisma.expense.create({
          data: {
            groupId: group.id,

            totalAmount:
              body.amount,

            note:
              body.note?.trim() ||
              null,

            payers: {
              create: {
                personId:
                  person.id,

                amount:
                  body.amount
              }
            },

            items: {
              create: {
                name:
                  body.note?.trim() ||
                  "Expense",

                price:
                  body.amount,

                shares: {
                  create:
                    allPeople.map(
                      (
                        participant,
                        index
                      ) => ({
                        personId:
                          participant.id,

                        amount:
                          shareAmounts[
                            index
                          ]
                      })
                    )
                }
              }
            },

            shares: {
              create:
                allPeople.map(
                  (
                    participant,
                    index
                  ) => ({
                    personId:
                      participant.id,

                    amount:
                      shareAmounts[
                        index
                      ]
                  })
                )
            }
          },

          include: {
            payers: {
              include: {
                person: true
              }
            },

            items: {
              include: {
                shares: {
                  include: {
                    person: true
                  }
                }
              }
            },

            shares: {
              include: {
                person: true
              }
            }
          }
        });

      await prisma.history.create({
        data: {
          groupId: group.id,
          action: "CREATE",
          entity: "EXPENSE",
          entityId: expense.id,

          message:
            `${person.name} paid €${body.amount.toFixed(
              2
            )}`,

          newValue:
            String(
              body.amount
            )
        }
      });

      const updated =
        await groupService.getGroupBySlug(
          req.params.slug as string
        );

      res.status(201).json(
        serializeGroup(
          updated!,
          access.user
        )
      );
    } catch (error) {
      next(error);
    }
  
  };

}

export const paymentService = new PaymentService();
