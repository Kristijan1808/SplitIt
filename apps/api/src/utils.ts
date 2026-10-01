import { expenseAllocation } from "./services/allocation.js";
import type { Prisma } from "@prisma/client";

export const groupDetailsInclude = {
  people: {
    orderBy: { createdAt: "asc" },
  },
  expenses: {
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      payers: { include: { person: true } },
      items: {
        orderBy: { ordinalNumber: "asc" },
        include: {
          shares: { include: { person: true } },
        },
      },
      shares: { include: { person: true } },
    },
  },
  history: {
    orderBy: { createdAt: "desc" },
  },
  draftExpenses: {
    where: { confirmedExpenseId: null },
    orderBy: { createdAt: "desc" },
    include: {
      payers: true,
      items: {
        orderBy: { ordinalNumber: "asc" },
        include: { shares: true },
      },
    },
  },
} satisfies Prisma.GroupInclude;

export type GroupWithDetails = Prisma.GroupGetPayload<{
  include: typeof groupDetailsInclude;
}>;

export const expenseDetailsInclude = {
  payers: { include: { person: true } },
  items: {
    orderBy: { ordinalNumber: "asc" },
    include: {
      shares: { include: { person: true } },
    },
  },
  shares: { include: { person: true } },
} satisfies Prisma.ExpenseInclude;

export type ExpenseWithDetails = Prisma.ExpenseGetPayload<{
  include: typeof expenseDetailsInclude;
}>;

export const draftExpenseDetailsInclude = {
  payers: true,
  items: {
    orderBy: { ordinalNumber: "asc" },
    include: { shares: true },
  },
} satisfies Prisma.ExpenseDraftInclude;

export type DraftExpenseWithDetails = Prisma.ExpenseDraftGetPayload<{
  include: typeof draftExpenseDetailsInclude;
}>;

export type PaymentPayer = Prisma.ExpensePayerGetPayload<{
  include: { expense: true };
}>;

export const serializePaymentFromPayer = (payer: PaymentPayer) => ({
  id: payer.id,
  expenseId: payer.expenseId,
  personId: payer.personId,
  amount: Number(payer.amount),
  note: payer.expense?.note ?? null,
  createdAt: payer.expense?.createdAt ?? payer.createdAt,
  updatedAt: payer.expense?.updatedAt ?? payer.updatedAt,
});

export const serializeDraftExpense = (draft: DraftExpenseWithDetails) => ({
  creatorKey: draft.creatorKey,
  billDate: draft.billDate,
  category: draft.category,
  requireResponses: draft.requireResponses,
  id: draft.id,
  groupId: draft.groupId,
  note: draft.note ?? null,
  createdAt: draft.createdAt,
  updatedAt: draft.updatedAt,
  payers: draft.payers.map((payer) => ({
    id: payer.id,
    draftId: payer.draftId,
    personId: payer.personId,
    amount: Number(payer.amount),
    createdAt: payer.createdAt,
    updatedAt: payer.updatedAt,
  })),
  items: draft.items.map((item) => ({
    id: item.id,
    draftId: item.draftId,
    ordinalNumber: item.ordinalNumber,
    name: item.name,
    price: Number(item.price),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    shares: item.shares.map((share) => ({
      id: share.id,
      itemId: share.itemId,
      personId: share.personId,
      amount: Number(share.amount),
      createdAt: share.createdAt,
      updatedAt: share.updatedAt,
    })),
  })),
});

export const serializeExpense = (expense: ExpenseWithDetails) => ({
  creatorKey: expense.creatorKey,
  ...expenseAllocation(expense),
  billDate: expense.billDate,
  category: expense.category,
  currency: expense.currency,
  rateDate:expense.rateDate,rateSource:expense.rateSource,
  exchangeRate:Number(expense.exchangeRate),
  originalTotal:expense.originalTotal===null?null:Number(expense.originalTotal),
  deletedAt: expense.deletedAt,
  id: expense.id,
  groupId: expense.groupId,
  totalAmount: Number(expense.totalAmount),
  note: expense.note ?? null,
  createdAt: expense.createdAt,
  updatedAt: expense.updatedAt,
  payers: expense.payers.map((payer) => ({
    id: payer.id,
    expenseId: payer.expenseId,
    personId: payer.personId,
    amount: Number(payer.amount),
    person: payer.person
      ? { id: payer.person.id, name: payer.person.name }
      : undefined,
  })),
  items: expense.items.map((item) => ({
    id: item.id,
    expenseId: item.expenseId,
    quantity:item.quantity,
    splitMode:item.splitMode,
    ordinalNumber: item.ordinalNumber,
    name: item.name,
    price: Number(item.price),
    shares: item.shares.map((share) => ({
      id: share.id,
      itemId: share.itemId,
      units:share.units,
      personId: share.personId,
      amount: Number(share.amount),
      person: share.person
        ? { id: share.person.id, name: share.person.name }
        : undefined,
    })),
  })),
  shares: expense.shares.map((share) => ({
    id: share.id,
    expenseId: share.expenseId,
    personId: share.personId,
    amount: Number(share.amount),
    person: share.person
      ? { id: share.person.id, name: share.person.name }
      : undefined,
  })),
});

export const serializeGroup = (
  group: GroupWithDetails,
) => {
  const { passwordHash, ownerKey, ownerUserId, accessType, ...restGroup } = group;



  const payments = group.expenses.flatMap((expense) =>
    expense.payers.map((payer) =>
      serializePaymentFromPayer({ ...payer, expense }),
    ),
  );

  return {
    ...restGroup,
    code: group.code,
    locked: Boolean(group.locked),
    accessType: "ANONYMOUS_ONLY",
    payments,
    expenses: group.expenses.map(serializeExpense),
    people: group.people.map((person) => ({
      id: person.id,
      name: person.name,
      claimed: !!person.identityKey,
      inactive: person.inactive,
      groupId: person.groupId,
      createdAt: person.createdAt,
      payments: group.expenses.flatMap((expense) =>
        expense.payers
          .filter((payer) => payer.personId === person.id)
          .map((payer) => serializePaymentFromPayer({ ...payer, expense })),
      ),
    })),
    history: group.history.filter(h => h.entity !== "COMMENT"),
    members: [],
    draftExpenses: group.draftExpenses.map(serializeDraftExpense),
  };
};
