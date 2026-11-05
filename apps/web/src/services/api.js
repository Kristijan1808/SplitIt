import { Platform } from "react-native-web";
import { storage } from "./storage.js";
export const API_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:4000").replace(/\/+$/, "");
export const WEB_URL = (import.meta.env.VITE_WEB_URL || (Platform.OS === "web" ? window.location.origin : "")).replace(/\/+$/, "");
let token;
let participantId;
export const setParticipant = (value) => {
    participantId = value;
};
export const setLegacyCredential = (value) => {
    token = value;
};
export const requestContext = () => ({ token, participantId });
let guestPromise;
async function guestToken() {
    if (!guestPromise)
        guestPromise = (async () => {
            const saved = await storage.guestToken();
            if (saved)
                return saved;
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 25000);
            try {
                const response = await fetch(`${API_URL}/guest-session`, {
                    method: "POST",
                    signal: controller.signal,
                });
                const data = await response.json().catch(() => null);
                if (!response.ok || !data?.token)
                    throw new Error("Objavi novu verziju API-ja prije korištenja ove nadogradnje. / Deploy the updated API first.");
                await storage.setGuestToken(data.token);
                return data.token;
            }
            finally {
                clearTimeout(timer);
            }
        })().catch((e) => {
            guestPromise = undefined;
            throw e;
        });
    return guestPromise;
}
export class ApiError extends Error {
    status;
    constructor(message, status) {
        super(message);
        this.status = status;
    }
}
export async function request(path, method = "GET", body, form, context = requestContext()) {
    if (!API_URL || API_URL.includes("YOUR-"))
        throw new Error("Postavi VITE_API_URL u apps/web/.env. / Configure your API URL.");
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
            throw new ApiError(typeof data?.error === "string"
                ? data.error
                : typeof data?.message === "string"
                    ? data.message
                    : `HTTP ${response.status}`, response.status);
        if (data === null)
            throw new Error("API nije vratio JSON. Provjeri adresu API-ja. / Invalid API response.");
        return data;
    }
    catch (e) {
        if (e instanceof Error && e.name === "AbortError")
            throw new Error("Zahtjev je istekao. Osvježi podatke prije ponavljanja spremanja. / Request timed out; refresh before retrying.");
        throw e;
    }
    finally {
        clearTimeout(timer);
    }
}
const base = (slug) => `/groups/${encodeURIComponent(slug)}`;
async function currencyRequest(path, method, body) {
    const health = await request("/health");
    if (!health.features?.includes("automatic-fx"))
        throw new Error("Prvo objavi API s automatskim tečajem. / Deploy the automatic FX API first.");
    return request(path, method, body);
}
export const api = {
    currencies: () => request("/currencies"),
    fxQuote: (slug, currency) => request(`${base(slug)}/fx-quote`, "POST", { currency }),
    createExpense: (slug, body) => currencyRequest(`${base(slug)}/expenses`, "POST", body),
    release: (slug, id) => request(`/groups/${slug}/workflow/people/${id}/release`, "POST"),
    role: (slug, id, role) => request(`/groups/${slug}/workflow/people/${id}/role`, "PATCH", { role }),
    workflow: (slug) => request(`${base(slug)}/workflow`),
    createIdentity: (slug, name) => request(`${base(slug)}/workflow/identity`, "POST", { name }),
    claim: (slug, personId) => request(`${base(slug)}/workflow/identity`, "POST", { personId }),
    response: (slug, id, status) => request(`${base(slug)}/workflow/drafts/${id}/response`, "POST", { status }),
    removeDraft: (slug, id) => request(`${base(slug)}/workflow/drafts/${id}`, "DELETE"),
    transfer: (slug, body) => request(`${base(slug)}/workflow/transfers`, "POST", body),
    voidTransfer: (slug, id) => request(`${base(slug)}/workflow/transfers/${id}`, "DELETE"),
    groupSettings: (slug, body) => currencyRequest(`${base(slug)}/workflow/settings`, "PATCH", body),
    inactive: (slug, id, inactive) => request(`${base(slug)}/workflow/people/${id}`, "PATCH", { inactive }),
    rotateInvite: (slug, password) => request(`${base(slug)}/workflow/rotate-invite`, "POST", { password }),
    ownItem: (slug, id, itemId, selected, finalized = false) => request(`${base(slug)}/${finalized ? "expenses" : "draft-expenses"}/${id}/items/${itemId}/mine`, "PATCH", typeof selected === "number" ? { units: selected } : { selected }),
    create: (body) => request("/groups", "POST", body),
    join: (body) => request("/groups/join", "POST", body),
    group: (slug) => request(base(slug)),
    snapshot: (slug) => request(`${base(slug)}/snapshot`),
    settlements: (slug) => request(`${base(slug)}/settlements`),
    drafts: (slug) => request(`${base(slug)}/draft-expenses`),
    history: (slug) => request(`${base(slug)}/history`),
    rename: (slug, name) => request(base(slug), "PATCH", { name }),
    lock: (slug, locked) => request(`${base(slug)}/lock`, "PATCH", { locked }),
    person: (slug, name, id) => request(`${base(slug)}/people${id ? `/${encodeURIComponent(id)}` : ""}`, id ? "PATCH" : "POST", { name }),
    deletePerson: (slug, id) => request(`${base(slug)}/people/${encodeURIComponent(id)}`, "DELETE"),
    draft: (slug, body) => request(`${base(slug)}/draft-expenses`, "POST", body),
    shares: (slug, draftId, itemId, ids) => request(`${base(slug)}/draft-expenses/${draftId}/items/${itemId}`, "PATCH", { shares: ids.map((personId) => ({ personId })) }),
    payers: (slug, id, payers) => request(`${base(slug)}/draft-expenses/${id}/payers`, "PATCH", { payers }),
    confirm: (slug, id) => request(`${base(slug)}/draft-expenses/${id}/confirm`, "POST"),
    updateExpense: (slug, id, body) => currencyRequest(`${base(slug)}/expenses/${id}`, "PATCH", body),
    deleteExpense: (slug, id) => request(`${base(slug)}/expenses/${id}`, "DELETE"),
    parse: (imageBase64, attempt = 1) => {
        if (!imageBase64 || imageBase64.length > 4 * Math.ceil(10 * 1024 * 1024 / 3))
            throw new Error("Slika je prazna ili prevelika. Najveća veličina je 10 MB.");
        return request("/ai/parse-bill", "POST", { imageBase64, attempt });
    },
};
