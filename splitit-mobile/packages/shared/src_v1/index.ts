export type ID = string;

export type Person = {
  id: ID;
  name: string;
  groupId: ID;
  createdAt: string;
  payments: Payment[];
};

export type Payment = {
  id: ID;
  amount: number;
  note?: string | null;
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

export type Group = {
  id: ID;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
  people: Array<Person & { payments: Payment[] }>;
  payments: Payment[];
  history: HistoryItem[];
};

export type CreateGroupRequest = {
  name: string;
  people: string[];
};

export type AddPersonRequest = {
  name: string;
};

export type AddPaymentRequest = {
  personId: string;
  amount: number;
  note?: string;
};

export type PatchPaymentRequest = {
  amount?: number;
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
  balances: Array<{
    personId: string;
    name: string;
    paid: number;
    balance: number;
  }>;
  settlements: Settlement[];
};

export function calculateSettlements(
  people: Array<{ id: string; name: string; paid: number }>
): SettlementResult {
  if (people.length === 0) {
    return { total: 0, share: 0, balances: [], settlements: [] };
  }

  const round = (value: number) => Math.round(value * 100) / 100;
  const total = round(people.reduce((sum, person) => sum + person.paid, 0));
  const share = round(total / people.length);

  const balances = people.map((person) => ({
    personId: person.id,
    name: person.name,
    paid: round(person.paid),
    balance: round(person.paid - share)
  }));

  const debtors = balances
    .filter((person) => person.balance < -0.01)
    .map((person) => ({ ...person }))
    .sort((a, b) => a.balance - b.balance);

  const creditors = balances
    .filter((person) => person.balance > 0.01)
    .map((person) => ({ ...person }))
    .sort((a, b) => b.balance - a.balance);

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

  return {
    total,
    share,
    balances,
    settlements
  };
}
