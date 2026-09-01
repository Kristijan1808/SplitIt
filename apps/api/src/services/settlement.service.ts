import type { NextFunction, Request, Response } from "express";
import {
  prisma,
  roundMoney
} from "../core.js";
import { ensureCanViewGroup } from "./access.service.js";


export class SettlementService {
  settlements = async (
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

      const people =
        await prisma.person.findMany({
          where: {
            groupId: group.id
          },

          orderBy: {
            createdAt: "asc"
          }
        });

      const expenses =
        await prisma.expense.findMany({
          where: {
            groupId: group.id
          },

          include: {
            payers: true,
            shares: true
          }
        });

      const balances =
        people.map((person) => {
          const paid =
            expenses.reduce(
              (sum, expense) =>
                sum +
                expense.payers
                  .filter(
                    (payer) =>
                      payer.personId ===
                      person.id
                  )
                  .reduce(
                    (
                      payerSum,
                      payer
                    ) =>
                      payerSum +
                      Number(
                        payer.amount
                      ),
                    0
                  ),
              0
            );

          const owed =
            expenses.reduce(
              (sum, expense) =>
                sum +
                expense.shares
                  .filter(
                    (share) =>
                      share.personId ===
                      person.id
                  )
                  .reduce(
                    (
                      shareSum,
                      share
                    ) =>
                      shareSum +
                      Number(
                        share.amount
                      ),
                    0
                  ),
              0
            );

          return {
            id: person.id,
            name: person.name,
            paid:
              roundMoney(paid),
            owed:
              roundMoney(owed),
            balance:
              roundMoney(
                paid - owed
              )
          };
        });

      //
      // Convert balances into settlement transactions.
      //
      const creditors =
        balances
          .filter(
            (person) =>
              person.balance > 0.009
          )
          .map((person) => ({
            id: person.id,
            name: person.name,
            amount:
              person.balance
          }));

      const debtors =
        balances
          .filter(
            (person) =>
              person.balance < -0.009
          )
          .map((person) => ({
            id: person.id,
            name: person.name,
            amount:
              -person.balance
          }));

      const settlements: Array<{
        from: string;
        fromName: string;
        to: string;
        toName: string;
        amount: number;
      }> = [];

      let creditorIndex = 0;
      let debtorIndex = 0;

      while (
        creditorIndex <
          creditors.length &&
        debtorIndex <
          debtors.length
      ) {
        const creditor =
          creditors[
            creditorIndex
          ];

        const debtor =
          debtors[
            debtorIndex
          ];

        const amount =
          roundMoney(
            Math.min(
              creditor.amount,
              debtor.amount
            )
          );

        if (amount > 0) {
          settlements.push({
            from:
              debtor.id,

            fromName:
              debtor.name,

            to:
              creditor.id,

            toName:
              creditor.name,

            amount
          });
        }

        creditor.amount =
          roundMoney(
            creditor.amount -
              amount
          );

        debtor.amount =
          roundMoney(
            debtor.amount -
              amount
          );

        if (
          creditor.amount <
          0.01
        ) {
          creditorIndex += 1;
        }

        if (
          debtor.amount <
          0.01
        ) {
          debtorIndex += 1;
        }
      }

      res.json({
        balances,
        settlements
      });
    } catch (error) {
      next(error);
    }
  
  };

}

export const settlementService = new SettlementService();
