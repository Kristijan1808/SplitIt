import { storage } from "./storage.js";
import { request, requestContext, API_URL } from "./api.js";
import { createOutbox } from "./outbox-engine.mjs";
export async function outboxScope() { const a = await storage.legacySession(); return `${API_URL}|${a?.user.id || 'guest'}`; }
export const outbox = createOutbox({
    read: async () => {
        // Do not interpret corrupted storage as an empty queue and overwrite it.
        const value = await storage.readStrict('outbox.v1', null);
        if (value === null)
            return [];
        if (!Array.isArray(value))
            throw new Error('Lokalni red računa nije čitljiv. Nemoj brisati podatke aplikacije.');
        return value;
    },
    write: (rows) => storage.write('outbox.v1', rows),
    send: async (entry, context) => {
        const path = `/groups/${encodeURIComponent(entry.slug)}`;
        const identity = { ...context, participantId: entry.participantId };
        let body = { ...entry.body };
        if (body.currency !== entry.baseCurrency) {
            const quote = await request(`${path}/fx-quote`, 'POST', { currency: body.currency }, undefined, identity);
            body = { ...body, quoteId: quote.id };
        }
        await request(`${path}/expenses`, 'POST', body, undefined, identity);
    }
});
export async function syncOutbox() { const auth = await storage.legacySession(); const context = requestContext(); if (context.token !== auth?.token)
    return 0; const scope = `${API_URL}|${auth?.user.id || 'guest'}`; return outbox.sync(scope, context); }
export async function queueExpense(slug, groupName, participantId, baseCurrency, body) {
    if (!participantId)
        throw new Error('Prije unosa bez interneta odaberi svoje ime u grupi dok si povezan.');
    const scope = await outboxScope();
    await outbox.enqueue({ id: body.requestId, scope, slug, groupName, participantId, baseCurrency, body });
}
