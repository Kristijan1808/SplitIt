import { storage } from "./storage";
import type {
  CreateGroupRequest,
  JoinGroupRequest,
  Group,
  DraftExpense,
  SettlementResult,
  HistoryItem,
  Expense,
  Workflow,
  GroupSnapshot,
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
export const setLegacyCredential = (value?: string) => {
  token = value;
};
export const requestContext=()=>({token,participantId});
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
  context = requestContext(),
): Promise<T> {
  if (!API_URL || API_URL.includes("YOUR-"))
    throw new Error(
      "Postavi EXPO_PUBLIC_API_URL u mobile/.env. / Configure your API URL.",
    );
  const guest = await guestToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), form || path === "/ai/parse-bill" ? 90000 : 25000);
  try {
    const response = await fetch(`${API_URL}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        "X-SplitIt-Guest-Token": guest,
        ...(context.participantId ? { "X-SplitIt-Participant-Id": context.participantId } : {}),
        ...(context.token ? { Authorization: `Bearer ${context.token}` } : {}),
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
  requestId?: string;
  requireResponses?: boolean;
  billDate?: string;
  category?: string;
  note?: string;
  payers: { personId: string; amount: number }[];
  items: {
    ordinalNumber: number;
    name: string;
    price: number;
    shares: { personId: string; amount?: number }[];
  }[];
};
async function currencyRequest<T>(path:string,method:string,body:object):Promise<T>{
 const health=await request<{features?:string[]}>("/health");
 if(!health.features?.includes("automatic-fx"))throw new Error("Prvo objavi API s automatskim tečajem. / Deploy the automatic FX API first.");
 return request<T>(path,method,body);
}
export type FxQuote={id:string|null;base:string;quote:string;rate:number;rateDate:string|null;source:string|null;expiresAt:string|null};
export type CurrencyOption={code:string;name:string};
export const api = {
  currencies:()=>request<CurrencyOption[]>("/currencies"),
  fxQuote:(slug:string,currency:string)=>request<FxQuote>(`${base(slug)}/fx-quote`,"POST",{currency}),
  createExpense:(slug:string,body:object)=>currencyRequest<Expense>(`${base(slug)}/expenses`,"POST",body),
  release:(slug:string,id:string)=>request(`/groups/${slug}/workflow/people/${id}/release`,"POST"),
  role:(slug:string,id:string,role:string)=>request(`/groups/${slug}/workflow/people/${id}/role`,"PATCH",{role}),
  workflow: (slug:string) => request<Workflow>(`${base(slug)}/workflow`),
  createIdentity:(slug:string,name:string)=>request<{ok:boolean;personId:string}>(`${base(slug)}/workflow/identity`,"POST",{name}),
  claim: (slug:string,personId:string) => request(`${base(slug)}/workflow/identity`,"POST",{personId}),
  response: (slug:string,id:string,status:string) => request(`${base(slug)}/workflow/drafts/${id}/response`,"POST",{status}),
  removeDraft: (slug:string,id:string) => request(`${base(slug)}/workflow/drafts/${id}`,"DELETE"),
  transfer: (slug:string,body:object) => request(`${base(slug)}/workflow/transfers`,"POST",body),
  voidTransfer: (slug:string,id:string) => request(`${base(slug)}/workflow/transfers/${id}`,"DELETE"),
  groupSettings: (slug:string,body:object) => currencyRequest(`${base(slug)}/workflow/settings`,"PATCH",body),
  inactive: (slug:string,id:string,inactive:boolean) => request(`${base(slug)}/workflow/people/${id}`,"PATCH",{inactive}),
  rotateInvite: (slug:string,password:string) => request(`${base(slug)}/workflow/rotate-invite`,"POST",{password}),
  ownItem: (
    slug: string,
    id: string,
    itemId: string,
    selected: boolean | number,
    finalized = false,
  ) =>
    request(
      `${base(slug)}/${finalized ? "expenses" : "draft-expenses"}/${id}/items/${itemId}/mine`,
      "PATCH",
      typeof selected === "number" ? { units:selected } : { selected },
    ),
  create: (body: CreateGroupRequest) => request<Group>("/groups", "POST", body),
  join: (body: JoinGroupRequest) =>
    request<Group>("/groups/join", "POST", body),
  group: (slug: string) => request<Group>(base(slug)),
  snapshot: (slug: string) => request<GroupSnapshot>(`${base(slug)}/snapshot`),
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
  ) => currencyRequest<Expense>(`${base(slug)}/expenses/${id}`, "PATCH", body),
  deleteExpense: (slug: string, id: string) =>
    request(`${base(slug)}/expenses/${id}`, "DELETE"),
  parse: (imageBase64: string) => {
    if (!imageBase64 || imageBase64.length > 4 * Math.ceil(10 * 1024 * 1024 / 3))
      throw new Error("Slika je prazna ili prevelika. Najveća veličina je 10 MB.");
    return request<{ items: { name: string; price: number; quantity?: number; unitPrice?: number }[] }>(
      "/ai/parse-bill", "POST", { imageBase64 },
    );
  },
};
