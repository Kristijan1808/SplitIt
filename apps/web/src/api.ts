import type {
  AddPaymentRequest,
  AddPersonRequest,
  CreateGroupRequest,
  Group,
  HistoryItem,
  PatchPaymentRequest,
  SettlementResult
} from "@splitit/shared";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error ?? "Request failed");
  }

  return response.json();
}

export const api = {
  createGroup: (body: CreateGroupRequest) =>
    request<Group>("/groups", {
      method: "POST",
      body: JSON.stringify(body)
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
