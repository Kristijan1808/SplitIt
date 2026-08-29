import { AuthUser } from "@splitit/shared";

export const serializeGroup = (
  group: any,
  currentUser?: AuthUser | null
) => {
  const {
    passwordHash,
    ...restGroup
  } = group;

  const currentMembership =
    currentUser
      ? group.members?.find(
          (member: any) =>
            member.userId === currentUser.id
        )
      : null;

  const expenses =
    group.expenses ?? [];

  //
  // Flatten payer records to preserve the old
  // "payments" property expected by the frontend.
  //
  const payments = expenses.flatMap(
    (expense: any) =>
      (expense.payers ?? []).map(
        (payer: any) =>
          serializePaymentFromPayer({
            ...payer,
            expense
          })
      )
  );

  return {
    ...restGroup,

    code: group.code,
    locked: Boolean(group.locked),

    currentUserRole:
      currentMembership?.role ?? null,

    payments,

    expenses:
      expenses.map(serializeExpense),

    people:
      group.people?.map(
        (person: any) => ({
          id: person.id,
          name: person.name,
          groupId: person.groupId,
          createdAt: person.createdAt,

          //
          // Compatibility:
          // show payer records belonging to this person.
          //
          payments: expenses.flatMap(
            (expense: any) =>
              (expense.payers ?? [])
                .filter(
                  (payer: any) =>
                    payer.personId ===
                    person.id
                )
                .map(
                  (payer: any) =>
                    serializePaymentFromPayer(
                      {
                        ...payer,
                        expense
                      }
                    )
                )
          )
        })
      ) ?? [],

    history:
      group.history ?? [],

    members:
      group.members?.map(
        (member: any) => ({
          id: member.id,
          groupId: member.groupId,
          userId: member.userId,
          username:
            member.user?.username,
          role: member.role,
          createdAt:
            member.createdAt
        })
      ) ?? [],

    draftExpenses:
      (group.draftExpenses ?? []).map(
        serializeDraftExpense
      )
  };
};


//
// Compatibility representation for old UI code that expects
// "payments".
//
// A payer is represented as a payment.
//
// This lets existing group screens continue to display
// payer information while the actual database uses ExpensePayer.
//
export const serializePaymentFromPayer = (
  payer: any
) : any => {
  return {
    id: payer.id,
    expenseId: payer.expenseId,
    personId: payer.personId,
    amount: Number(payer.amount),
    note: payer.expense?.note ?? null,
    createdAt:
      payer.expense?.createdAt ??
      payer.createdAt,
    updatedAt:
      payer.expense?.updatedAt ??
      payer.updatedAt
  };
}

export const serializeDraftExpense = (
  draft: any
) => {
  return {
    id: draft.id,
    groupId: draft.groupId,
    note: draft.note ?? null,
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,

    payers: (draft.payers ?? []).map(
      (payer: any) => ({
        id: payer.id,
        draftId: payer.draftId,
        personId: payer.personId,
        amount: Number(payer.amount),
        createdAt: payer.createdAt,
        updatedAt: payer.updatedAt
      })
    ),

    items: (draft.items ?? []).map(
      (item: any) => ({
        id: item.id,
        draftId: item.draftId,
        name: item.name,
        price: Number(item.price),
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,

        //
        // IMPORTANT:
        // An empty shares array is valid.
        //
        shares: (item.shares ?? []).map(
          (share: any) => ({
            id: share.id,
            itemId: share.itemId,
            personId: share.personId,
            amount: Number(share.amount),
            createdAt: share.createdAt,
            updatedAt: share.updatedAt
          })
        )
      })
    )
  };
}

export const serializeExpense = (
  expense: any
) => {
  return {
    id: expense.id,
    groupId: expense.groupId,
    totalAmount: Number(
      expense.totalAmount
    ),
    note: expense.note ?? null,
    createdAt: expense.createdAt,
    updatedAt: expense.updatedAt,

    payers: (expense.payers ?? []).map(
      (payer: any) => ({
        id: payer.id,
        expenseId: payer.expenseId,
        personId: payer.personId,
        amount: Number(payer.amount),
        person: payer.person
          ? {
              id: payer.person.id,
              name: payer.person.name
            }
          : undefined
      })
    ),

    items: (expense.items ?? []).map(
      (item: any) => ({
        id: item.id,
        expenseId: item.expenseId,
        name: item.name,
        price: Number(item.price),

        shares: (item.shares ?? []).map(
          (share: any) => ({
            id: share.id,
            itemId: share.itemId,
            personId: share.personId,
            amount: Number(share.amount),
            person: share.person
              ? {
                  id: share.person.id,
                  name: share.person.name
                }
              : undefined
          })
        )
      })
    ),

    shares: (expense.shares ?? []).map(
      (share: any) => ({
        id: share.id,
        expenseId: share.expenseId,
        personId: share.personId,
        amount: Number(share.amount),
        person: share.person
          ? {
              id: share.person.id,
              name: share.person.name
            }
          : undefined
      })
    )
  };
}
