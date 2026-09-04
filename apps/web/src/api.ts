import type {
  AddPaymentRequest,
  AddPersonRequest,
  AuthResponse,
  CreateGroupRequest,
  Group,
  Expense,
  HistoryItem,
  JoinGroupRequest,
  LoginRequest,
  PatchPaymentRequest,
  RegisterRequest,
  SettlementResult,
} from "./types";
import { getAuthToken } from "./auth";
import { saveGroupToLocalStorage, syncSavedGroupToLocalStorage } from "./storage";
import { startApiLoading, endApiLoading } from "./loading";


type DraftItemShareRequest = {
  personId: string;
  amount?: number;
};

export type ParsedBillItem = {
  name: string;
  price: number;
};

export type CreateDraftExpenseRequest = {
  note?: string;
  payers: Array<{ personId: string; amount: number }>;
  items: Array<{
    ordinalNumber: number;
    name: string;
    price: number;
    shares: DraftItemShareRequest[];
  }>;
};

export type UpdateDraftExpenseItemRequest = {
  shares: DraftItemShareRequest[];
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

export type DraftExpense = {
  id: string;
  groupId: string;
  note?: string | null;
  createdAt: string;
  updatedAt?: string;
  payers: Array<{ id: string; draftId: string; personId: string; amount: number }>;
  items: DraftExpenseItem[];
};

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  startApiLoading();

  try {
    const token = getAuthToken();

    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options?.headers ?? {})
      }
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Request failed" }));
      throw new Error(error.error ?? error.message ?? "Request failed");
    }

    return response.json();
  } finally {
    endApiLoading();
  }
}

export const api = {
  parseBillImage: async (file: File): Promise<{ items: ParsedBillItem[] }> => {
    startApiLoading();

    try {
      const token = getAuthToken();
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${API_URL}/ai/parse-bill`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Request failed" }));
        throw new Error(error.error ?? error.message ?? "Request failed");
      }

      return response.json();
    } finally {
      endApiLoading();
    }
  },

  login: (body: LoginRequest) =>
    request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(body)
    }),

  register: (body: RegisterRequest) =>
    request<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(body)
    }),

  createGroup: async (body: CreateGroupRequest) => {
    const group = await request<Group>("/groups", {
      method: "POST",
      body: JSON.stringify(body)
    });
    saveGroupToLocalStorage(group);
    return group;
  },

  joinGroup: async (body: JoinGroupRequest) => {
    const group = await request<Group>("/groups/join", {
      method: "POST",
      body: JSON.stringify(body)
    });
    saveGroupToLocalStorage(group);
    return group;
  },

  lockGroup: (slug: string, locked: boolean) => request<Group>(`/groups/${slug}/lock`, {
    method: "PATCH",
    body: JSON.stringify({ locked })
  }),

  getGroup: async (slug: string) => {
    const group = await request<Group>(`/groups/${slug}`);
    syncSavedGroupToLocalStorage(group);
    return group;
  },

  updateGroup: (slug: string, name: string) =>
    request<Group>(`/groups/${slug}`, {
      method: "PATCH",
      body: JSON.stringify({ name })
    }),

  addPerson: (slug: string, body: AddPersonRequest) =>
    request<Group>(`/groups/${slug}/people`, {
      method: "POST",
      body: JSON.stringify(body)
    }),

  updatePerson: (slug: string, personId: string, name: string) =>
    request<Group>(`/groups/${slug}/people/${personId}`, {
      method: "PATCH",
      body: JSON.stringify({ name })
    }),

  deletePerson: (slug: string, personId: string) =>
    request<Group>(`/groups/${slug}/people/${personId}`, {
      method: "DELETE"
    }),

  addPayment: (slug: string, body: AddPaymentRequest) =>
    request<Group>(`/groups/${slug}/payments`, {
      method: "POST",
      body: JSON.stringify(body)
    }),

  getDraftExpenses: (slug: string) => request<DraftExpense[]>(`/groups/${slug}/draft-expenses`),

  createDraftExpense: (slug: string, body: CreateDraftExpenseRequest) =>
    request<DraftExpense>(`/groups/${slug}/draft-expenses`, {
      method: "POST",
      body: JSON.stringify(body)
    }),

  updateDraftExpenseItem: (slug: string, draftId: string, itemId: string, body: UpdateDraftExpenseItemRequest) =>
    request<DraftExpense>(`/groups/${slug}/draft-expenses/${draftId}/items/${itemId}`, {
      method: "PATCH",
      body: JSON.stringify(body)
    }),

  confirmDraftExpense: (slug: string, draftId: string) =>
    request<{ expense: Expense; group: Group }>(`/groups/${slug}/draft-expenses/${draftId}/confirm`, {
      method: "POST"
    }),

  updatePayment: (slug: string, paymentId: string, body: PatchPaymentRequest) =>
    request<Group>(`/groups/${slug}/payments/${paymentId}`, {
      method: "PATCH",
      body: JSON.stringify(body)
    }),

  deletePayment: (slug: string, paymentId: string) =>
    request<Group>(`/groups/${slug}/payments/${paymentId}`, {
      method: "DELETE"
    }),

  getSettlements: (slug: string) => request<SettlementResult>(`/groups/${slug}/settlements`),

  getHistory: (slug: string) => request<HistoryItem[]>(`/groups/${slug}/history`)
};
