import type {
  AddPaymentRequest,
  AddPersonRequest,
  AuthResponse,
  CreateDraftExpenseRequest,
  CreateGroupRequest,
  ExpenseDraft,
  Group,
  HistoryItem,
  JoinGroupRequest,
  LoginRequest,
  PatchPaymentRequest,
  RegisterRequest,
  SettlementResult,
  UpdateDraftExpenseItemRequest
} from "@splitit/shared";
import { getAuthToken } from "./auth";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
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
}

export const api = {
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

  createGroup: (body: CreateGroupRequest) =>
    request<Group>("/groups", {
      method: "POST",
      body: JSON.stringify(body)
    }),

  joinGroup: (body: JoinGroupRequest) => request<Group>("/groups/join", {
    method: "POST",
    body: JSON.stringify(body)
  }),

  lockGroup: (slug: string, locked: boolean) => request<Group>(`/groups/${slug}/lock`, {
    method: "PATCH",
    body: JSON.stringify({ locked })
  }),

  getGroup: (slug: string) => request<Group>(`/groups/${slug}`),

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

  getDraftExpenses: (slug: string) => request<ExpenseDraft[]>(`/groups/${slug}/draft-expenses`),

  createDraftExpense: (slug: string, body: CreateDraftExpenseRequest) =>
    request<ExpenseDraft>(`/groups/${slug}/draft-expenses`, {
      method: "POST",
      body: JSON.stringify(body)
    }),

  updateDraftExpenseItem: (slug: string, draftId: string, itemId: string, body: UpdateDraftExpenseItemRequest) =>
    request<ExpenseDraft>(`/groups/${slug}/draft-expenses/${draftId}/items/${itemId}`, {
      method: "PATCH",
      body: JSON.stringify(body)
    }),

  confirmDraftExpense: (slug: string, draftId: string) =>
    request<Group>(`/groups/${slug}/draft-expenses/${draftId}/confirm`, {
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
