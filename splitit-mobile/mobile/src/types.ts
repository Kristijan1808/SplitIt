export type AccessType = "ANONYMOUS_ONLY";
export type GroupRole = "OWNER" | "MEMBER";

export type CreateGroupRequest = {
  name: string;
  password: string;
  people: string[];
  accessType: AccessType;
};

export type JoinGroupRequest = {
  code: string;
  password: string;
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
  personId?: string;
  amount?: number;
  note?: string;
};

export type Payment = {
  id: string;
  expenseId: string;
  personId: string;
  amount: number;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
  participantIds?: string[];
};

export type Person = {
  claimed?: boolean;
  inactive?: boolean;
  id: string;
  name: string;
  groupId: string;
  createdAt: string;
  payments: Payment[];
};

export type ExpenseItemShare = {
  units?:number|null;
  id: string;
  itemId: string;
  personId: string;
  amount: number;
  person?: { id: string; name: string };
};

export type ExpenseItem = {
  splitMode?:"shared"|"units";
  quantity?:number;
  id: string;
  expenseId: string;
  ordinalNumber: number;
  name: string;
  price: number;
  shares: ExpenseItemShare[];
};

export type ExpensePayer = {
  id: string;
  expenseId: string;
  personId: string;
  amount: number;
  person?: { id: string; name: string };
};

export type ExpenseShare = {
  id: string;
  expenseId: string;
  personId: string;
  amount: number;
  person?: { id: string; name: string };
};

export type Expense = {
  currency?:string;
  exchangeRate?:number;
  rateDate?:string|null;rateSource?:string|null;
  originalTotal?:number|null;
  allocationComplete?:boolean;
  unassignedCount?:number;
  unassignedAmount?:number;
  paymentIncomplete?:boolean;
  provisionalShares?:{personId:string;amount:number}[];
  billDate?: string;
  category?: string;
  canManage?: boolean;
  legacyOwner?: boolean;
  id: string;
  groupId: string;
  totalAmount: number;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
  payers: ExpensePayer[];
  items: ExpenseItem[];
  shares: ExpenseShare[];
};

export type DraftExpenseItemShare = {
  id: string;
  itemId: string;
  personId: string;
  amount: number;
  createdAt?: string;
  updatedAt?: string;
};

export type DraftExpenseItem = {
  id: string;
  draftId: string;
  ordinalNumber: number;
  name: string;
  price: number;
  createdAt?: string;
  updatedAt?: string;
  shares: DraftExpenseItemShare[];
};

export type DraftExpensePayer = {
  id: string;
  draftId: string;
  personId: string;
  amount: number;
  createdAt?: string;
  updatedAt?: string;
};

export type DraftExpense = {
  requireResponses?: boolean;
  billDate?: string;
  category?: string;
  canManage?: boolean;
  legacyOwner?: boolean;
  id: string;
  groupId: string;
  note?: string | null;
  createdAt: string;
  updatedAt?: string;
  payers: DraftExpensePayer[];
  items: DraftExpenseItem[];
};

export type GroupMember = {
  id: string;
  groupId: string;
  userId: string;
  username?: string;
  role: GroupRole;
  createdAt: string;
};

export type HistoryItem = {
  id: string;
  groupId: string;
  action: string;
  entity: string;
  entityId?: string | null;
  message: string;
  oldValue?: string | null;
  newValue?: string | null;
  createdAt: string;
};

export type Group = {
  currency?: string;
  archived?: boolean;
  avatar?: string;
  id: string;
  name: string;
  slug: string;
  code: string;
  locked: boolean;
  accessType: AccessType;
  ownerUserId?: string | null;
  createdAt: string;
  updatedAt: string;
  currentUserRole?: GroupRole | null;
  people: Person[];
  expenses: Expense[];
  payments: Payment[];
  history: HistoryItem[];
  members: GroupMember[];
  draftExpenses: DraftExpense[];
};

export type Balance = {
  id: string;
  name: string;
  paid: number;
  owed: number;
  balance: number;
};

export type Settlement = {
  from: string;
  fromName: string;
  to: string;
  toName: string;
  amount: number;
};

export type SettlementResult = {
  balances: Balance[];
  settlements: Settlement[];
};

export type Workflow = {
 avatar: string; archived: boolean; canAdmin: boolean; canOwn: boolean;
 people: {id:string;name:string;role?:string;claimed:boolean;mine:boolean;inactive:boolean}[];
 selections: {draftId:string;personId:string;status:"DONE"|"SKIP"|"PENDING"}[];
 transfers: {id:string;fromId:string;toId:string;amount:number;note?:string;occurredAt:string;voidedAt?:string;canManage:boolean}[];
};

export type GroupSnapshot = {
  group: Group;
  drafts: DraftExpense[];
  settlements: SettlementResult;
  history: HistoryItem[];
  workflow: Workflow;
};
