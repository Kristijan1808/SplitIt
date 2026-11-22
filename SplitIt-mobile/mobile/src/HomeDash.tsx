import React, { useEffect, useState } from "react";
import { View, Pressable, ScrollView, useWindowDimensions } from "react-native";
import { Txt, Card, Button, Icon, useUI, s } from "./ui";
import { storage } from "./storage";
import type { SavedGroup } from "./storage";
const money = (n: number, cur = "EUR") => n.toLocaleString("hr-HR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + (cur === "EUR" ? "€" : cur);
const tones = ["tint", "peach", "successTint", "tint"] as const;
/** Početna iz dizajna: pozdrav, ukupni saldo (hero) s pločicama, grupe sa saldom. */
export type TodoKind = "claim" | "pay" | "remind";
type Todo = { kind: TodoKind; slug: string; title: string; sub: string; btn: string };
export function HomeDash({ groups, username, scope, onTodo, onOpen, onCreate, onJoin, onAll, onProfile }: { groups: SavedGroup[]; username?: string; scope: string; onTodo: (slug: string, kind: TodoKind) => void; onOpen: (g: SavedGroup) => void; onCreate: () => void; onJoin: () => void; onAll: () => void; onProfile: () => void }) {
  const { c, t } = useUI();
  const wide = useWindowDimensions().width >= 900;
  const [todos, setTodos] = useState<Todo[]>([]);
  useEffect(() => {
    let live = true;
    void Promise.all(groups.filter((g) => !g.archived && g.participantId).map(async (g) => {
      const snap: any = await storage.read(`snapshot.${scope}.${g.slug}`, null);
      if (!snap?.group) return [] as Todo[];
      const me = g.participantId, cur = snap.group.currency || g.currency || "EUR", out: Todo[] = [];
      if (snap.workflow?.archived) return out;
      for (const e of snap.group.expenses ?? []) {
        const items = e.items ?? [];
        if (items.length < 2 || e.allocationComplete !== false) continue;
        if (items.some((i: any) => (i.shares ?? []).some((x: any) => x.personId === me))) continue;
        out.push({ kind: "claim", slug: g.slug, title: t("Označi svoje stavke", "Mark your items"), sub: `${e.note || t("Račun", "Bill")} · ${snap.group.name} · ${money(Number(e.totalAmount), cur)}`, btn: t("Označi", "Mark") });
      }
      // "Čeka tebe" prikazuje samo račune sa stavkama na kojima trebaš označiti svoje.
      return out;
    })).then((all) => { if (live) { const o = { claim: 0, pay: 1, remind: 2 }; setTodos(all.flat().sort((a, b) => o[a.kind] - o[b.kind]).slice(0, 5)); } });
    return () => { live = false; };
  }, [groups, scope]);
  const todoBlock = todos.length ? (
    <View style={{ gap: 8 }}>
      <View style={[s.row, { alignItems: "center", gap: 8 }]}>
        <Txt bold size={18}>{t("Čeka tebe", "Waiting for you")}</Txt>
        {!!todos.length && <View style={{ minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: 7, backgroundColor: c.tint, alignItems: "center", justifyContent: "center" }}><Txt bold size={12} style={{ color: c.accent }}>{todos.length}</Txt></View>}
      </View>
      <View style={{ backgroundColor: c.card, borderRadius: 22, paddingHorizontal: 16, paddingVertical: todos.length ? 4 : 14 }}>
        {todos.length ? todos.map((x, i) => (
          <Pressable key={i} accessibilityRole="button" onPress={() => onTodo(x.slug, x.kind)} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderColor: c.line }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: x.kind === "claim" ? c.tint : x.kind === "pay" ? c.debtTint : c.successTint }}>
              <Icon name={x.kind === "claim" ? "receipt" : x.kind === "pay" ? "payment" : "share"} size={20} color={x.kind === "claim" ? c.accent : x.kind === "pay" ? c.debt : c.success} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}><Txt bold>{x.title}</Txt><Txt muted size={12}>{x.sub}</Txt></View>
            <View style={{ height: 36, paddingHorizontal: 12, borderRadius: 18, backgroundColor: x.kind === "remind" ? c.bg : c.tint, justifyContent: "center" }}><Txt bold size={13} style={{ color: x.kind === "remind" ? c.muted : c.accent }}>{x.btn}</Txt></View>
          </Pressable>
        )) : <View><Txt bold>{t("Sve je riješeno", "All caught up")}</Txt><Txt muted size={12}>{t("Nema otvorenih radnji.", "Nothing to do right now.")}</Txt></View>}
      </View>
    </View>
  ) : null;
  const active = groups.filter((g) => !g.archived);
  const owed = active.reduce((a, g) => a + Math.max(g.balance ?? 0, 0), 0);
  const owe = active.reduce((a, g) => a + Math.max(-(g.balance ?? 0), 0), 0);
  const total = owed - owe;
  const h = new Date().getHours();
  const greet = h < 11 ? t("Dobro jutro", "Good morning") : h < 18 ? t("Dobar dan", "Good afternoon") : t("Dobra večer", "Good evening");
  const name = (username || "").split("_")[0];
  const tile = (i: number): string => ((c as any)[tones[i % 4]] ?? c.tint);
  const topBlock = (<>
      <View style={[s.between]}>
        <View>
          <Txt muted size={14}>{greet}</Txt>
          <Txt bold size={28} style={{ letterSpacing: -1 }}>{t("Bok", "Hi")}{name ? ", " + name.charAt(0).toUpperCase() + name.slice(1) : ""}</Txt>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={t("Profil", "Profile")} onPress={onProfile} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: c.tint, alignItems: "center", justifyContent: "center" }}>
          <Txt bold size={18}>{(username || "?").charAt(0).toUpperCase()}</Txt>
        </Pressable>
      </View>
      <View style={{ backgroundColor: c.hero, borderRadius: 28, padding: 22, gap: 6 }}>
        <Txt size={13} style={{ color: "#ffffffe6" }}>{t("Ukupni saldo u svim grupama", "Total balance across groups")}</Txt>
        <Txt bold size={44} style={{ color: "#fff", letterSpacing: -2 }}>{total > 0 ? "+" : total < 0 ? "−" : ""}{money(Math.abs(total))}</Txt>
        <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
          <View style={{ flex: 1, backgroundColor: c.card, borderRadius: 18, paddingVertical: 10, paddingHorizontal: 14 }}>
            <Txt muted size={13}>{t("Duguju ti", "You are owed")}</Txt><Txt bold size={18} style={{ color: c.success }}>{money(owed)}</Txt>
          </View>
          <View style={{ flex: 1, backgroundColor: c.card, borderRadius: 18, paddingVertical: 10, paddingHorizontal: 14 }}>
            <Txt muted size={13}>{t("Ti duguješ", "You owe")}</Txt><Txt bold size={18} style={{ color: c.debt }}>{money(owe)}</Txt>
          </View>
        </View>
      </View>
  </>);
  const btnBlock = (<>
      <Button label={t("Izradi grupu", "Create group")} onPress={onCreate} />
      <Button secondary label={t("Pridruži se kodom", "Join with a code")} onPress={onJoin} />
  </>);
  const groupBlock = (<>
      <View style={s.between}>
        <Txt bold size={20}>{t("Tvoje grupe", "Your groups")}</Txt>
        <Pressable accessibilityRole="button" onPress={onAll} style={{ minHeight: 44, justifyContent: "center" }}><Txt bold size={14} style={{ color: c.accent }}>{t("Sve", "All")}</Txt></Pressable>
      </View>
      <View style={wide ? { flexDirection: "row", flexWrap: "wrap", gap: 12 } : { gap: 16 }}>
      {active.length ? active.slice(0, 5).map((g, i) => (
        <Pressable key={g.slug} accessibilityRole="button" accessibilityLabel={`${t("Otvori grupu", "Open group")} ${g.name}`} onPress={() => onOpen(g)} style={{ flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: c.card, borderRadius: 20, padding: 14, ...(wide ? { flexBasis: 300, flexGrow: 1, maxWidth: '49%' } : {}) }}>
          <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: tile(i), alignItems: "center", justifyContent: "center" }}>
            {g.avatar && !String(g.avatar).startsWith("data:") ? <Txt size={24}>{g.avatar}</Txt> : <Txt bold size={20}>{g.name.charAt(0).toUpperCase()}</Txt>}
          </View>
          <View style={{ flex: 1 }}>
            <Txt bold size={17}>{g.name}</Txt>
            <Txt muted size={14}>{g.memberCount ?? "—"} {t("sudionika", "members")}</Txt>
          </View>
          {g.balance !== undefined && (
            <Txt bold size={18} style={{ color: Math.abs(g.balance) < 0.005 ? c.muted : g.balance > 0 ? c.success : c.debt }}>{money(Math.abs(g.balance), g.currency)}</Txt>
          )}
        </Pressable>
      )) : (
        <Card><Txt muted>{t("Ovdje će se pojaviti grupe koje izradiš ili kojima se pridružiš.", "Groups you create or join will appear here.")}</Txt></Card>
      )}
      </View>
  </>);
  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={wide ? { padding: 32, paddingBottom: 40 } : { padding: 20, gap: 16, paddingBottom: 32 }}>
      {wide ? (
        <View style={{ flexDirection: "row", gap: 28, alignItems: "flex-start", width: "100%", maxWidth: 1180, alignSelf: "center" }}>
          <View style={{ width: 400, gap: 16 }}>{topBlock}{todoBlock}{btnBlock}</View>
          <View style={{ flex: 1, minWidth: 0, gap: 16 }}>{groupBlock}</View>
        </View>
      ) : (<>{topBlock}{todoBlock}{groupBlock}{btnBlock}</>)}
    </ScrollView>
  );
}
