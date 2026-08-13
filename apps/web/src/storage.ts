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

const STORAGE_KEY = "splitit:groups";
const DEVICE_KEY = "splitit:device-id";

type GroupInput = {
  name: string;
  password: string;
  participants: string[];
};

type ExpenseInput = {
  amount: number;
  note: string;
  paidByParticipantId: string;
  participantIds: string[];
};

function readGroups(): StoredGroup[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredGroup[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeGroups(groups: StoredGroup[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
}

function createId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "group";
}

function makeUniqueSlug(name: string, groups: StoredGroup[]) {
  const base = slugify(name);
  if (!groups.some((group) => group.slug === base)) return base;

  let index = 2;
  let candidate = `${base}-${index}`;
  while (groups.some((group) => group.slug === candidate)) {
    index += 1;
    candidate = `${base}-${index}`;
  }

  return candidate;
}

function buildParticipants(names: string[]) {
  const trimmed = names.map((name) => name.trim()).filter(Boolean);
  const source = trimmed.length > 0 ? trimmed : ["You", "Friend", "Family"];

  const participants: StoredParticipant[] = [];
  const seen = new Set<string>();

  source.forEach((name, index) => {
    let candidate = name || `Participant ${index + 1}`;
    let attempt = 1;
    while (seen.has(candidate)) {
      candidate = `${name} ${attempt}`;
      attempt += 1;
    }
    seen.add(candidate);
    participants.push({
      id: createId("participant"),
      name: candidate,
      createdAt: new Date().toISOString()
    });
  });

  return participants;
}

function normalizeGroupName(name: string) {
  return name.trim();
}

function validateUniqueNames(names: string[]) {
  const normalized = names.map((name) => name.trim()).filter(Boolean);
  const duplicates = normalized.filter((name, index) => normalized.indexOf(name) !== index);
  if (duplicates.length > 0) {
    throw new Error("Participant names must be unique within the group.");
  }
}

function getDeviceId() {
  if (typeof window === "undefined") return "device";
  const existing = window.localStorage.getItem(DEVICE_KEY);
  if (existing) return existing;
  const next = createId("device");
  window.localStorage.setItem(DEVICE_KEY, next);
  return next;
}

export function createGroup(input: GroupInput): StoredGroup {
  const groups = readGroups();
  const name = normalizeGroupName(input.name);
  if (!name) throw new Error("Group name is required.");
  if (!input.password.trim()) throw new Error("A password is required.");

  const existing = groups.find((group) => group.name.toLowerCase() === name.toLowerCase());
  if (existing) throw new Error("This group name is already taken.");

  validateUniqueNames(input.participants);

  const participants = buildParticipants(input.participants);
  const now = new Date().toISOString();
  const group: StoredGroup = {
    id: createId("group"),
    slug: makeUniqueSlug(name, groups),
    name,
    password: input.password.trim(),
    participants,
    expenses: [],
    deviceParticipantId: participants[0]?.id,
    createdAt: now,
    updatedAt: now
  };

  const nextGroups = [group, ...groups];
  writeGroups(nextGroups);
  return group;
}

export function joinGroup(name: string, password: string): StoredGroup {
  const groups = readGroups();
  const target = groups.find((group) => group.name.toLowerCase() === name.trim().toLowerCase());
  if (!target) throw new Error("No group with that name was found.");
  if (target.password !== password.trim()) throw new Error("That password is incorrect.");

  const group = {
    ...target,
    deviceParticipantId: target.deviceParticipantId ?? target.participants[0]?.id,
    updatedAt: new Date().toISOString()
  };

  const nextGroups = groups.map((storedGroup) => (storedGroup.id === group.id ? group : storedGroup));
  writeGroups(nextGroups);
  return group;
}

export function loadGroup(slug: string): StoredGroup | null {
  return readGroups().find((group) => group.slug === slug) ?? null;
}

export function loadGroups(): StoredGroup[] {
  return readGroups();
}

export function addExpense(groupId: string, input: ExpenseInput): StoredGroup {
  const groups = readGroups();
  const group = groups.find((storedGroup) => storedGroup.id === groupId);
  if (!group) throw new Error("Group not found.");

  const participantIds = input.participantIds.filter((participantId) =>
    group.participants.some((participant) => participant.id === participantId)
  );

  const nextParticipantIds = participantIds.length > 0 ? participantIds : group.participants.map((participant) => participant.id);
  const paidByParticipantId = group.participants.some((participant) => participant.id === input.paidByParticipantId)
    ? input.paidByParticipantId
    : group.deviceParticipantId ?? group.participants[0]?.id ?? "";

  if (!paidByParticipantId) throw new Error("This group does not have any participants yet.");

  const expense: StoredExpense = {
    id: createId("expense"),
    amount: Number(input.amount),
    note: input.note.trim(),
    paidByParticipantId,
    participantIds: nextParticipantIds,
    createdAt: new Date().toISOString()
  };

  const nextGroup: StoredGroup = {
    ...group,
    expenses: [expense, ...group.expenses],
    deviceParticipantId: paidByParticipantId,
    updatedAt: new Date().toISOString()
  };

  const nextGroups = groups.map((storedGroup) => (storedGroup.id === groupId ? nextGroup : storedGroup));
  writeGroups(nextGroups);
  return nextGroup;
}

export function addParticipant(groupId: string, name: string): StoredGroup {
  const groups = readGroups();
  const group = groups.find((storedGroup) => storedGroup.id === groupId);
  if (!group) throw new Error("Group not found.");

  const trimmedName = name.trim();
  if (!trimmedName) throw new Error("Participant name is required.");
  if (group.participants.some((participant) => participant.name.toLowerCase() === trimmedName.toLowerCase())) {
    throw new Error("Participant names must be unique within the group.");
  }

  const participant: StoredParticipant = {
    id: createId("participant"),
    name: trimmedName,
    createdAt: new Date().toISOString()
  };

  const nextGroup: StoredGroup = {
    ...group,
    participants: [...group.participants, participant],
    updatedAt: new Date().toISOString()
  };

  const nextGroups = groups.map((storedGroup) => (storedGroup.id === groupId ? nextGroup : storedGroup));
  writeGroups(nextGroups);
  return nextGroup;
}

export function setDeviceParticipant(groupId: string, participantId: string): StoredGroup {
  const groups = readGroups();
  const group = groups.find((storedGroup) => storedGroup.id === groupId);
  if (!group) throw new Error("Group not found.");

  if (!group.participants.some((participant) => participant.id === participantId)) {
    throw new Error("That participant was not found in this group.");
  }

  const nextGroup: StoredGroup = {
    ...group,
    deviceParticipantId: participantId,
    updatedAt: new Date().toISOString()
  };

  const nextGroups = groups.map((storedGroup) => (storedGroup.id === groupId ? nextGroup : storedGroup));
  writeGroups(nextGroups);
  return nextGroup;
}

export function deleteExpense(groupId: string, expenseId: string): StoredGroup {
  const groups = readGroups();
  const group = groups.find((storedGroup) => storedGroup.id === groupId);
  if (!group) throw new Error("Group not found.");

  const nextGroup: StoredGroup = {
    ...group,
    expenses: group.expenses.filter((expense) => expense.id !== expenseId),
    updatedAt: new Date().toISOString()
  };

  const nextGroups = groups.map((storedGroup) => (storedGroup.id === groupId ? nextGroup : storedGroup));
  writeGroups(nextGroups);
  return nextGroup;
}

export function calculateGroupBalances(group: Pick<StoredGroup, "participants" | "expenses">) {
  const balances = group.participants.map((participant) => ({
    id: participant.id,
    name: participant.name,
    paid: 0,
    balance: 0
  }));

  group.expenses.forEach((expense) => {
    const payer = balances.find((balance) => balance.id === expense.paidByParticipantId);
    if (payer) {
      payer.paid += expense.amount;
    }

    const selectedParticipantIds = expense.participantIds.length > 0
      ? expense.participantIds
      : group.participants.map((participant) => participant.id);

    const splitParticipantIds = Array.from(new Set([...selectedParticipantIds, expense.paidByParticipantId]));
    const share = expense.amount / Math.max(splitParticipantIds.length, 1);

    splitParticipantIds.forEach((participantId) => {
      const balance = balances.find((entry) => entry.id === participantId);
      if (balance) {
        balance.balance -= share;
      }
    });

    if (payer) {
      payer.balance += expense.amount;
    }
  });

  return balances.map((balance) => ({
    ...balance,
    balance: Number(balance.balance.toFixed(2))
  }));
}

export function calculateSettlements(group: Pick<StoredGroup, "participants" | "expenses">) {
  const balances = calculateGroupBalances(group);
  const debtors = balances.filter((balance) => balance.balance < -0.01).sort((a, b) => a.balance - b.balance);
  const creditors = balances.filter((balance) => balance.balance > 0.01).sort((a, b) => b.balance - a.balance);

  const settlements: Array<{ from: string; to: string; amount: number }> = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amount = Math.min(Math.abs(debtor.balance), creditor.balance);

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

export function formatExpenseBreakdown(expense: StoredExpense, participants: StoredParticipant[]) {
  const selectedParticipants = expense.participantIds.length > 0
    ? participants.filter((participant) => expense.participantIds.includes(participant.id))
    : participants;
  const share = Number((expense.amount / Math.max(selectedParticipants.length, 1)).toFixed(2));
  const payer = participants.find((participant) => participant.id === expense.paidByParticipantId);

  const others = selectedParticipants.filter((participant) => participant.id !== expense.paidByParticipantId);
  return {
    payerName: payer?.name ?? "Someone",
    share,
    others: others.map((participant) => ({
      name: participant.name,
      amount: share
    }))
  };
}

export function getStoredDeviceParticipantId() {
  return getDeviceId();
}
