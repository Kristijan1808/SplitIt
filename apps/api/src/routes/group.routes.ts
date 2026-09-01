import { Router, type Request, type Response, type NextFunction } from "express";
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

groupRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(201).json(await groupService.create(req));
  } catch (error) {
    next(error);
  }
});

groupRouter.post("/join", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await groupService.join(req));
  } catch (error) {
    next(error);
  }
});

groupRouter.get("/:slug", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await groupService.get(req.params.slug as string, req));
  } catch (error) {
    next(error);
  }
});

groupRouter.patch("/:slug", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await groupService.update(req.params.slug as string, req));
  } catch (error) {
    next(error);
  }
});

groupRouter.patch("/:slug/lock", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await groupService.setLock(req.params.slug as string , req));
  } catch (error) {
    next(error);
  }
});

// People

groupRouter.post("/:slug/people", personService.create);
groupRouter.patch("/:slug/people/:personId", personService.update);
groupRouter.delete("/:slug/people/:personId", personService.remove);

// Draft expenses

groupRouter.get("/:slug/draft-expenses", draftExpenseService.list);
groupRouter.post("/:slug/draft-expenses", draftExpenseService.create);
groupRouter.patch(
  "/:slug/draft-expenses/:draftId/items/:itemId",
  draftExpenseItemService.updateItem
);
groupRouter.patch(
  "/:slug/draft-expenses/:draftId/payers",
  draftExpensePayerService.updatePayers
);
groupRouter.post(
  "/:slug/draft-expenses/:draftId/confirm",
  draftExpenseConfirmationService.confirm
);

// Finalized expenses + legacy payment endpoints

groupRouter.get("/:slug/expenses", expenseService.list);
groupRouter.get("/:slug/expenses/:expenseId", expenseService.get);
groupRouter.delete("/:slug/expenses/:expenseId", expenseService.remove);
groupRouter.get("/:slug/payments", paymentService.listPayments);
groupRouter.post("/:slug/payments", paymentService.createPayment);
groupRouter.get("/:slug/settlements", settlementService.settlements);

// History

groupRouter.get("/:slug/history", historyService.list);
