import { Receipt, ArrowLeftRight, Users, Settings2, Trash2, Pencil, CheckSquare } from "lucide-react";
import type { Group, HistoryItem } from "../types";
import { useLanguage } from "../i18n";

type Audit = { actor?: { name?: string }; title?: string; total?: number; selection?: { personId?: string; itemId?: string; selected?: boolean; units?: number | null }; fromId?: string; toId?: string; amount?: number };
const parse = (v?: string | null): Audit | null => { if (!v) return null; try { const x = JSON.parse(v); return x && typeof x === "object" ? x : null; } catch { return null; } };

/** Povijest grupe s opisom: tko, što, na čemu i koliko (iz zapisa oldValue/newValue). */
export function HistoryList({ group, entries }: { group: Group; entries: HistoryItem[] }) {
  const { t, locale } = useLanguage();
  const cur = (group.currency || "EUR") === "EUR" ? "€" : group.currency || "";
  const money = (n?: number) => (typeof n === "number" && Number.isFinite(n) ? n.toFixed(2).replace(".", ",") + " " + cur : "");
  const person = (id?: string) => group.people.find((p) => p.id === id)?.name;
  const itemName = (expenseId?: string | null, itemId?: string) => group.expenses.find((e) => e.id === expenseId)?.items.find((i) => i.id === itemId)?.name;
  const when = (iso: string) => new Date(iso).toLocaleString(locale, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const day = (iso: string) => { const d = new Date(iso); return d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate(); };
  const dayLabel = (iso: string) => {
    const d = new Date(iso), now = new Date(), y = new Date(Date.now() - 864e5);
    const same = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    return same(d, now) ? t("today") : same(d, y) ? t("yesterday") : d.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: d.getFullYear() === now.getFullYear() ? undefined : "numeric" });
  };

  /** Stari zapisi na serveru bili su na engleskom — prevedi ih za hrvatski prikaz. */
  const legacy = (m: string) => !String(locale).toLowerCase().startsWith("hr") ? m : m
    .replace(/^(.+) was added$/, "Dodan sudionik $1")
    .replace(/^Person changed from "(.*)" to "(.*)"$/, "Sudionik preimenovan iz „$1” u „$2”")
    .replace(/^Group "(.*)" created$/, "Grupa „$1” je stvorena")
    .replace(/^Group name changed from "(.*)" to "(.*)"$/, "Naziv grupe promijenjen iz „$1” u „$2”")
    .replace(/^Group was locked$/, "Grupa je zaključana").replace(/^Group was unlocked$/, "Grupa je otključana")
    .replace(/^(.+?) (created|updated|deleted) "/, (_x, a: string, v: string) => a + (v === "created" ? " je dodao/la račun \"" : v === "updated" ? " je uredio/la račun \"" : " je obrisao/la račun \""));

  const describe = (h: HistoryItem) => {
    const msg = legacy(h.message);
    const nv = parse(h.newValue), ov = parse(h.oldValue), a = nv ?? ov;
    const who = a?.actor?.name;
    const title = a?.title;
    let Icon = Settings2, kind = t("histKindGroup"), headline = msg, tone = "";
    const details: string[] = [];
    if (h.entity === "EXPENSE") {
      Icon = Receipt; kind = t("histKindExpense");
      if (nv?.selection) {
        Icon = CheckSquare; kind = t("histKindPick");
        const it = itemName(h.entityId, nv.selection.itemId) ?? msg.split(": ").slice(1).join(": ");
        const whom = person(nv.selection.personId) ?? who ?? "";
        headline = (nv.selection.selected === false ? t("histUnpicked") : t("histPicked")).replace("{name}", whom).replace("{item}", it || "");
        if (title) details.push(t("histOnBill").replace("{title}", title));
        if (nv.selection.units && nv.selection.units > 1) details.push(`${nv.selection.units} ${t("pieces")}`);
      } else if (h.action === "CREATE") {
        headline = t("histExpenseCreated").replace("{name}", who ?? "").replace("{title}", title ?? "");
        if (nv?.total !== undefined) details.push(t("histTotal").replace("{amount}", money(nv.total)));
      } else if (h.action === "DELETE") {
        Icon = Trash2; tone = "neg";
        headline = t("histExpenseDeleted").replace("{name}", who ?? "").replace("{title}", title ?? "");
        if (ov?.total !== undefined) details.push(t("histTotal").replace("{amount}", money(ov.total)));
      } else {
        Icon = Pencil;
        headline = t("histExpenseUpdated").replace("{name}", who ?? "").replace("{title}", title ?? "");
        if (ov?.title && nv?.title && ov.title !== nv.title) details.push(t("histRenamed").replace("{old}", ov.title).replace("{new}", nv.title));
        if (ov?.total !== undefined && nv?.total !== undefined && Math.abs(ov.total - nv.total) > 0.004) details.push(t("histTotalChanged").replace("{old}", money(ov.total)).replace("{new}", money(nv.total)));
        else if (nv?.total !== undefined) details.push(t("histTotal").replace("{amount}", money(nv.total)));
      }
      if (!who && !title) headline = msg;
    } else if (h.entity === "TRANSFER") {
      Icon = ArrowLeftRight; kind = t("histKindPayment");
      if (h.action === "CREATE" && nv) {
        const from = person(nv.fromId), to = person(nv.toId);
        headline = from && to ? t("histPayment").replace("{from}", from).replace("{to}", to).replace("{amount}", money(nv.amount)) : msg;
        const by = msg.split(":")[0];
        if (by && by !== msg) details.push(t("histRecordedBy").replace("{name}", by));
      } else { tone = "neg"; headline = msg; if (ov?.amount !== undefined) details.push(t("histTotal").replace("{amount}", money(ov.amount))); }
    } else if (h.entity === "PERSON") { Icon = Users; kind = t("histKindPerson"); const n = person(h.entityId ?? undefined); if (n && !msg.includes(n)) details.push(n); }
    else if (h.entity === "DRAFT") { Icon = Receipt; kind = t("histKindExpense"); }
    return { Icon, kind, headline: headline.replace(/\s+/g, " ").trim() || msg, details, tone };
  };

  if (!entries.length) return <p className="zMuted">{t("noActivityYet")}</p>;
  return (
    <div className="zHist">
      {entries.map((h, i) => {
        const d = describe(h), newDay = i === 0 || day(entries[i - 1].createdAt) !== day(h.createdAt);
        return (
          <div key={h.id}>
            {newDay && <h3 className="zDayHead">{dayLabel(h.createdAt)}</h3>}
            <div className={"zHistRow " + d.tone}>
              <span className="zHistIc"><d.Icon size={18} aria-hidden="true" /></span>
              <div className="zHistTxt">
                <b>{d.headline}</b>
                {d.details.length > 0 && <span className="zHistDet">{d.details.join(" · ")}</span>}
                <small><span className="zHistKind">{d.kind}</span>{when(h.createdAt)}</small>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
