import {createQuote} from "../services/fx.service.js";
import {createExpense} from "../services/create-expense.service.js";
import { joinLimit } from "../services/rate-limit.js";
import {groupGate,adminGate,workflowRouter} from "../services/workflow.service.js";
import { ownItem } from "../services/own-item.service.js";
import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { groupService } from "../services/group.service.js";
import { personService } from "../services/person.service.js";
import { draftExpenseService } from "../services/draft-expense.service.js";
import { draftExpenseItemService } from "../services/draft-expense-item.service.js";
import { draftExpensePayerService } from "../services/draft-expense-payer.service.js";
import { draftExpenseConfirmationService } from "../services/draft-expense-confirmation.service.js";
import { expenseService } from "../services/expense.service.js";
import { paymentService } from "../services/payment.service.js";
import { settlementService } from "../services/settlement.service.js";
import { historyService } from "../services/history.service.js";

export const groupRouter = Router();

// Group

groupRouter.post(
  "/",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(201).json(await groupService.create(req));
    } catch (error) {
      next(error);
    }
  },
);

groupRouter.post(
  "/join",
  joinLimit,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await groupService.join(req));
    } catch (error) {
      next(error);
    }
  },
);

groupRouter.use("/:slug",groupGate);
groupRouter.post("/:slug/fx-quote",joinLimit,createQuote);
groupRouter.post("/:slug/expenses",createExpense);
groupRouter.use("/:slug/draft-expenses",(req,res)=>{if(req.method==="GET")res.json([]);else res.status(410).json({error:"Računi se sada kreiraju izravno. Nadogradi aplikaciju i osvježi web."})});
groupRouter.use("/:slug/workflow",workflowRouter);
groupRouter.patch("/:slug",adminGate);
groupRouter.patch("/:slug/people/:personId",adminGate);
groupRouter.delete("/:slug/people/:personId",adminGate);

groupRouter.get(
  "/:slug",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await groupService.get(req.params.slug as string, req));
    } catch (error) {
      next(error);
    }
  },
);

groupRouter.patch(
  "/:slug",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await groupService.update(req.params.slug as string, req));
    } catch (error) {
      next(error);
    }
  },
);

groupRouter.patch(
  "/:slug/lock",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await groupService.setLock(req.params.slug as string, req));
    } catch (error) {
      next(error);
    }
  },
);

// People

groupRouter.post("/:slug/people", personService.create);
groupRouter.patch("/:slug/people/:personId", personService.update);
groupRouter.delete("/:slug/people/:personId", personService.remove);

groupRouter.patch(
  "/:slug/draft-expenses/:draftId/items/:itemId/mine",
  ownItem(false),
);
groupRouter.patch(
  "/:slug/expenses/:expenseId/items/:itemId/mine",
  ownItem(true),
);

// Draft expenses

groupRouter.get("/:slug/draft-expenses", draftExpenseService.list);
groupRouter.post("/:slug/draft-expenses", draftExpenseService.create);
groupRouter.patch(
  "/:slug/draft-expenses/:draftId/items/:itemId",
  draftExpenseItemService.updateItem,
);
groupRouter.patch(
  "/:slug/draft-expenses/:draftId/payers",
  draftExpensePayerService.updatePayers,
);
groupRouter.post(
  "/:slug/draft-expenses/:draftId/confirm",
  draftExpenseConfirmationService.confirm,
);

// Finalized expenses + legacy payment endpoints

groupRouter.get("/:slug/expenses", expenseService.list);
groupRouter.get("/:slug/expenses/:expenseId", expenseService.get);
groupRouter.patch("/:slug/expenses/:expenseId", expenseService.update);
groupRouter.delete("/:slug/expenses/:expenseId", expenseService.remove);
groupRouter.get("/:slug/payments", paymentService.listPayments);
groupRouter.post("/:slug/payments", paymentService.createPayment);
groupRouter.get("/:slug/settlements", settlementService.settlements);

// History

groupRouter.get("/:slug/history", historyService.list);
