export type ID = string;

export type GroupAccessType = "ANONYMOUS_ONLY" | "REGISTERED_ONLY" | "MIXED";

export type UserRole = "OWNER" | "MEMBER";

export type AuthUser = {
  id: string;
  username: string;
};

export type AuthResponse = {
  token: string;
  user: AuthUser;
};

export type LoginRequest = {
  username: string;
  password: string;
};

export type RegisterRequest = {
  username: string;
  password: string;
  repeatPassword: string;
};

export type Person = {
  id: ID;
  name: string;
  groupId: ID;
  createdAt: string;
};

export type Payment = {
  id: ID;
  amount: number;
  excludedAmount: number;
  note?: string | null;
  participantIds?: string[];
  personId: ID;
  groupId: ID;
  createdAt: string;
  updatedAt: string;
};

export type HistoryItem = {
  id: ID;
  groupId: ID;
  action: string;
  entity: string;
  entityId?: string | null;
  message: string;
  oldValue?: string | null;
  newValue?: string | null;
  createdAt: string;
};

export type GroupMember = {
  id: ID;
  groupId: ID;
  userId: ID;
  username?: string;
  role: UserRole;
  createdAt: string;
};

export type Group = {
  id: ID;
  name: string;
  slug: string;
  code: string;
  locked: boolean;
  accessType: GroupAccessType;
  ownerUserId?: string | null;
  currentUserRole?: UserRole | null;
  createdAt: string;
  updatedAt: string;
  people: Array<Person & { payments: Payment[] }>;
  payments: Payment[];
  history: HistoryItem[];
  members?: GroupMember[];
  draftExpenses?: ExpenseDraft[];
};

export type CreateGroupRequest = {
  name: string;
  password: string;
  people: string[];
  accessType: GroupAccessType;
};

export type JoinGroupRequest = {
  code?: string;
  name?: string;
  password: string;
};

export type AddPersonRequest = { name: string };

export type AddPaymentRequest = {
  personId: string;
  amount: number;
  excludedAmount?: number;
  note?: string;
  participantIds?: string[];
};

export type ExpenseDraftItem = {
  id: ID;
  draftId: ID;
  name: string;
  price: number;
  assignedPersonId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ExpenseDraft = {
  id: ID;
  groupId: ID;
  note?: string | null;
  payerPersonId?: string | null;
  paidAmount?: number | null;
  createdAt: string;
  updatedAt: string;
  items: ExpenseDraftItem[];
};

export type CreateDraftExpenseRequest = {
  note?: string;
  payerPersonId?: string | null;
  paidAmount?: number | null;
  items: Array<{ name: string; price: number; assignedPersonId?: string | null }>;
};

export type UpdateDraftExpenseItemRequest = {
  assignedPersonId?: string | null;
};

export type PatchPaymentRequest = {
  amount?: number;
  excludedAmount?: number;
  note?: string;
};

export type Settlement = {
  fromPersonId: string;
  from: string;
  toPersonId: string;
  to: string;
  amount: number;
};

export type SettlementResult = {
  total: number;
  share: number;
  balances: Array<{ personId: string; name: string; paid: number; balance: number }>;
  settlements: Settlement[];
};

export function calculateSettlements(
  people: Array<{ id: string; name: string; paid: number }>
): SettlementResult {
  if (people.length === 0) return { total: 0, share: 0, balances: [], settlements: [] };

  const round = (value: number) => Math.round(value * 100) / 100;
  const total = round(people.reduce((sum, person) => sum + person.paid, 0));
  const share = round(total / people.length);

  const balances = people.map((person) => ({
    personId: person.id,
    name: person.name,
    paid: round(person.paid),
    balance: round(person.paid - share)
  }));

  const debtors = balances.filter((p) => p.balance < -0.01).map((p) => ({ ...p })).sort((a, b) => a.balance - b.balance);
  const creditors = balances.filter((p) => p.balance > 0.01).map((p) => ({ ...p })).sort((a, b) => b.balance - a.balance);

  const settlements: Settlement[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amount = round(Math.min(Math.abs(debtor.balance), creditor.balance));

    if (amount > 0) {
      settlements.push({
        fromPersonId: debtor.personId,
        from: debtor.name,
        toPersonId: creditor.personId,
        to: creditor.name,
        amount
      });
    }

    debtor.balance = round(debtor.balance + amount);
    creditor.balance = round(creditor.balance - amount);

    if (Math.abs(debtor.balance) <= 0.01) debtorIndex++;
    if (Math.abs(creditor.balance) <= 0.01) creditorIndex++;
  }

  settlements.sort((a, b) => a.amount - b.amount || a.to.localeCompare(b.to));

  return { total, share, balances, settlements };
}
