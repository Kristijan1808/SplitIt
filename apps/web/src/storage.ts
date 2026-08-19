export type SavedGroup = {
  slug: string;
  name: string;
  code?: string;
  participantId?: string | null;
  participantName?: string | null;
  savedAt: string;
};

const GROUPS_KEY = "splitit:groups";
const WHO_AM_I_PREFIX = "splitit:whoami:";

function readSavedGroups(): SavedGroup[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(GROUPS_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (group): group is SavedGroup =>
        Boolean(group) &&
        typeof group === "object" &&
        typeof group.slug === "string" &&
        typeof group.name === "string"
    );
  } catch {
    return [];
  }
}

function writeSavedGroups(groups: SavedGroup[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
}

/**
 * Saves a server-side group locally.
 *
 * This is intentionally only a local registry of groups the user has joined
 * or created. The server remains the source of truth for the actual group
 * data, expenses and participants.
 */
export function saveGroupToLocalStorage(group: {
  slug: string;
  name: string;
  code?: string | null;
}) {
  const groups = readSavedGroups();
  const existing = groups.find((entry) => entry.slug === group.slug);

  const saved: SavedGroup = {
    slug: group.slug,
    name: group.name,
    code: group.code ?? existing?.code,
    participantId: existing?.participantId ?? null,
    participantName: existing?.participantName ?? null,
    savedAt: existing?.savedAt ?? new Date().toISOString()
  };

  writeSavedGroups([
    saved,
    ...groups.filter((entry) => entry.slug !== group.slug)
  ]);

  return saved;
}



export function syncSavedGroupToLocalStorage(group: {
  slug: string;
  name: string;
  code?: string | null;
}) {
  const groups = readSavedGroups();
  const existing = groups.find((entry) => entry.slug === group.slug);
  if (!existing) return null;

  const updated: SavedGroup = {
    ...existing,
    name: group.name,
    code: group.code ?? existing.code
  };

  writeSavedGroups(
    groups.map((entry) => (entry.slug === group.slug ? updated : entry))
  );

  return updated;
}

export function getSavedGroups(): SavedGroup[] {
  return readSavedGroups();
}

export function getSavedGroup(slug: string): SavedGroup | null {
  return readSavedGroups().find((group) => group.slug === slug) ?? null;
}

export function removeSavedGroup(slug: string) {
  if (typeof window === "undefined") return;

  // Removing a group from "My Groups" must also remove its locally saved
  // "Who am I?" selection. The actual server-side group is not deleted.
  window.localStorage.removeItem(`${WHO_AM_I_PREFIX}${slug}`);
  writeSavedGroups(readSavedGroups().filter((group) => group.slug !== slug));
}

/**
 * Persists "Who am I?" independently for each joined group.
 * The participant belongs to the group, so the same browser can be
 * a different participant in different groups.
 */
export function saveWhoAmI(
  slug: string,
  participantId: string,
  participantName?: string | null
) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(
    `${WHO_AM_I_PREFIX}${slug}`,
    JSON.stringify({
      participantId,
      participantName: participantName ?? null
    })
  );

  const groups = readSavedGroups();
  const existing = groups.find((group) => group.slug === slug);

  if (existing) {
    writeSavedGroups(
      groups.map((group) =>
        group.slug === slug
          ? {
              ...group,
              participantId,
              participantName: participantName ?? null
            }
          : group
      )
    );
  }
}

export function getWhoAmI(slug: string): {
  participantId: string;
  participantName?: string | null;
} | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(`${WHO_AM_I_PREFIX}${slug}`);
    if (!raw) {
      const group = getSavedGroup(slug);
      return group?.participantId
        ? {
            participantId: group.participantId,
            participantName: group.participantName
          }
        : null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed?.participantId) return null;

    return {
      participantId: parsed.participantId,
      participantName: parsed.participantName ?? null
    };
  } catch {
    return null;
  }
}

export function clearWhoAmI(slug: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(`${WHO_AM_I_PREFIX}${slug}`);

  const groups = readSavedGroups();
  writeSavedGroups(
    groups.map((group) =>
      group.slug === slug
        ? { ...group, participantId: null, participantName: null }
        : group
    )
  );
}

/*
 * Keep the old local-expense helpers available for existing tests/legacy
 * code. The server-backed application does not use these to store groups.
 */
export type StoredParticipant = {
  id: string;
  name: string;
  createdAt: string;
};

export type StoredExpense = {
  id: string;
  amount: number;
  note: string;
  paidByParticipantId: string;
  participantIds: string[];
  createdAt: string;
};

export type StoredGroup = {
  id: string;
  slug: string;
  name: string;
  password: string;
  participants: StoredParticipant[];
  expenses: StoredExpense[];
  deviceParticipantId?: string;
  createdAt: string;
  updatedAt: string;
};

export function calculateGroupBalances(
  group: Pick<StoredGroup, "participants" | "expenses">
) {
  const balances = group.participants.map((participant) => ({
    id: participant.id,
    name: participant.name,
    paid: 0,
    balance: 0
  }));

  group.expenses.forEach((expense) => {
    const payer = balances.find(
      (balance) => balance.id === expense.paidByParticipantId
    );

    if (payer) payer.paid += expense.amount;

    const selectedParticipantIds =
      expense.participantIds.length > 0
        ? expense.participantIds
        : group.participants.map((participant) => participant.id);

    const splitParticipantIds = Array.from(
      new Set([...selectedParticipantIds, expense.paidByParticipantId])
    );

    const share =
      expense.amount / Math.max(splitParticipantIds.length, 1);

    splitParticipantIds.forEach((participantId) => {
      const balance = balances.find((entry) => entry.id === participantId);
      if (balance) balance.balance -= share;
    });

    if (payer) payer.balance += expense.amount;
  });

  return balances.map((balance) => ({
    ...balance,
    balance: Number(balance.balance.toFixed(2))
  }));
}

export function calculateSettlements(
  group: Pick<StoredGroup, "participants" | "expenses">
) {
  const balances = calculateGroupBalances(group);
  const debtors = balances
    .filter((balance) => balance.balance < -0.01)
    .sort((a, b) => a.balance - b.balance);
  const creditors = balances
    .filter((balance) => balance.balance > 0.01)
    .sort((a, b) => b.balance - a.balance);

  const settlements: Array<{
    from: string;
    to: string;
    amount: number;
  }> = [];

  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amount = Math.min(
      Math.abs(debtor.balance),
      creditor.balance
    );

    if (amount > 0.01) {
      settlements.push({
        from: debtor.name,
        to: creditor.name,
        amount: Number(amount.toFixed(2))
      });
    }

    debtor.balance = Number((debtor.balance + amount).toFixed(2));
    creditor.balance = Number((creditor.balance - amount).toFixed(2));

    if (Math.abs(debtor.balance) <= 0.01) debtorIndex += 1;
    if (Math.abs(creditor.balance) <= 0.01) creditorIndex += 1;
  }

  return settlements;
}
