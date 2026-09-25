import { storage } from "./storage";
import type {
  AuthResponse,
  CreateGroupRequest,
  JoinGroupRequest,
  Group,
  DraftExpense,
  SettlementResult,
  HistoryItem,
  Expense,
} from "./types";
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(
  /\/+$/,
  "",
);
export const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL ?? "").replace(
  /\/+$/,
  "",
);
let token: string | undefined;
let participantId: string | undefined;
export const setParticipant = (value?: string) => {
  participantId = value;
};
export const setToken = (value?: string) => {
  token = value;
};
let guestPromise: Promise<string> | undefined;
async function guestToken(): Promise<string> {
  if (!guestPromise)
    guestPromise = (async () => {
      const saved = await storage.guestToken();
      if (saved) return saved;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 25000);
      try {
        const response = await fetch(`${API_URL}/guest-session`, {
          method: "POST",
          signal: controller.signal,
        });
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.token)
          throw new Error(
            "Objavi novu verziju API-ja prije korištenja ove nadogradnje. / Deploy the updated API first.",
          );
        await storage.setGuestToken(data.token);
        return data.token as string;
      } finally {
        clearTimeout(timer);
      }
    })().catch((e) => {
      guestPromise = undefined;
      throw e;
    });
  return guestPromise;
}
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function request<T>(
  path: string,
  method = "GET",
  body?: unknown,
  form?: FormData,
): Promise<T> {
  if (!API_URL || API_URL.includes("YOUR-"))
    throw new Error(
      "Postavi EXPO_PUBLIC_API_URL u mobile/.env. / Configure your API URL.",
    );
  const guest = await guestToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), form ? 90000 : 25000);
  try {
    const response = await fetch(`${API_URL}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        "X-SplitIt-Guest-Token": guest,
        ...(participantId ? { "X-SplitIt-Participant-Id": participantId } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(!form ? { "Content-Type": "application/json" } : {}),
      },
      body: form ?? (body === undefined ? undefined : JSON.stringify(body)),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok)
      throw new ApiError(
        typeof data?.error === "string"
          ? data.error
          : typeof data?.message === "string"
            ? data.message
            : `HTTP ${response.status}`,
        response.status,
      );
    if (data === null)
      throw new Error(
        "API nije vratio JSON. Provjeri adresu API-ja. / Invalid API response.",
      );
    return data as T;
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError")
      throw new Error(
        "Zahtjev je istekao. Osvježi podatke prije ponavljanja spremanja. / Request timed out; refresh before retrying.",
      );
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
const base = (slug: string) => `/groups/${encodeURIComponent(slug)}`;
export type DraftBody = {
  note?: string;
  payers: { personId: string; amount: number }[];
  items: {
    ordinalNumber: number;
    name: string;
    price: number;
    shares: { personId: string; amount?: number }[];
  }[];
};
export const api = {
  ownItem: (
    slug: string,
    id: string,
    itemId: string,
    selected: boolean,
    finalized = false,
  ) =>
    request(
      `${base(slug)}/${finalized ? "expenses" : "draft-expenses"}/${id}/items/${itemId}/mine`,
      "PATCH",
      { selected },
    ),
  auth: (register: boolean, body: object) =>
    request<AuthResponse>(
      `/auth/${register ? "register" : "login"}`,
      "POST",
      body,
    ),
  create: (body: CreateGroupRequest) => request<Group>("/groups", "POST", body),
  join: (body: JoinGroupRequest) =>
    request<Group>("/groups/join", "POST", body),
  group: (slug: string) => request<Group>(base(slug)),
  settlements: (slug: string) =>
    request<SettlementResult>(`${base(slug)}/settlements`),
  drafts: (slug: string) =>
    request<DraftExpense[]>(`${base(slug)}/draft-expenses`),
  history: (slug: string) => request<HistoryItem[]>(`${base(slug)}/history`),
  rename: (slug: string, name: string) =>
    request<Group>(base(slug), "PATCH", { name }),
  lock: (slug: string, locked: boolean) =>
    request<Group>(`${base(slug)}/lock`, "PATCH", { locked }),
  person: (slug: string, name: string, id?: string) =>
    request<Group>(
      `${base(slug)}/people${id ? `/${encodeURIComponent(id)}` : ""}`,
      id ? "PATCH" : "POST",
      { name },
    ),
  deletePerson: (slug: string, id: string) =>
    request<Group>(`${base(slug)}/people/${encodeURIComponent(id)}`, "DELETE"),
  draft: (slug: string, body: DraftBody) =>
    request<DraftExpense>(`${base(slug)}/draft-expenses`, "POST", body),
  shares: (slug: string, draftId: string, itemId: string, ids: string[]) =>
    request<DraftExpense>(
      `${base(slug)}/draft-expenses/${draftId}/items/${itemId}`,
      "PATCH",
      { shares: ids.map((personId) => ({ personId })) },
    ),
  payers: (
    slug: string,
    id: string,
    payers: { personId: string; amount: number }[],
  ) =>
    request<DraftExpense>(
      `${base(slug)}/draft-expenses/${id}/payers`,
      "PATCH",
      { payers },
    ),
  confirm: (slug: string, id: string) =>
    request<{ group: Group; expense: Expense }>(
      `${base(slug)}/draft-expenses/${id}/confirm`,
      "POST",
    ),
  updateExpense: (
    slug: string,
    id: string,
    body: DraftBody & { expectedUpdatedAt: string },
  ) => request<Expense>(`${base(slug)}/expenses/${id}`, "PATCH", body),
  deleteExpense: (slug: string, id: string) =>
    request(`${base(slug)}/expenses/${id}`, "DELETE"),
  parse: (uri: string) => {
    const form = new FormData();
    form.append("file", {
      uri,
      name: "receipt.jpg",
      type: "image/jpeg",
    } as unknown as Blob);
    return request<{ items: { name: string; price: number }[] }>(
      "/ai/parse-bill",
      "POST",
      undefined,
      form,
    );
  },
};
