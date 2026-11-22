import React, { useEffect, useState } from "react";
import { View, Pressable, ScrollView } from "react-native";
import { Txt, useUI } from "./ui";
import { storage, type SavedGroup } from "./storage";
type Item = { text: string; at: string; group: string; slug: string };
const kind = (x: string) => (/uplat|payment|transfer/i.test(x) ? "pay" : /odabir|stavk|select|claim|item/i.test(x) ? "pick" : "exp");
/** Aktivnost: zajednički feed iz spremljenih snapshotova grupa (radi i offline). */
export function ActivityScreen({ groups, scope, onOpen }: { groups: SavedGroup[]; scope: string; onOpen: (slug: string) => void }) {
  const { c, t } = useUI();
  const [items, setItems] = useState<Item[]>([]);
  const [f, setF] = useState<"all" | "exp" | "pay" | "pick">("all");
  useEffect(() => {
    let live = true;
    void Promise.all(groups.map(async (g) => {
      const snap: any = await storage.read(`snapshot.${scope}.${g.slug}`, null);
      return ((snap?.history ?? []) as any[]).slice(0, 12).map((h) => ({ text: h.message as string, at: h.createdAt as string, group: g.name, slug: g.slug }));
    })).then((r) => { if (live) setItems(r.flat().sort((a, b) => b.at.localeCompare(a.at))); });
    return () => { live = false; };
  }, [groups.length, scope]);
  const shown = items.filter((x) => f === "all" || kind(x.text) === f);
  const label = (iso: string) => { const d = new Date(iso), n = new Date(); const dd = Math.floor((+new Date(n.toDateString()) - +new Date(d.toDateString())) / 864e5); return dd <= 0 ? t("DANAS", "TODAY") : dd === 1 ? t("JUČER", "YESTERDAY") : t("RANIJE", "EARLIER"); };
  let last = "";
  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 32, width: "100%", maxWidth: 820, alignSelf: "center" }}>
      <Txt bold size={28} style={{ letterSpacing: -1 }}>{t("Aktivnost", "Activity")}</Txt>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {([["all", t("Sve", "All")], ["exp", t("Troškovi", "Expenses")], ["pay", t("Uplate", "Payments")], ["pick", t("Odabir", "Selections")]] as const).map(([k, l]) => (
          <Pressable key={k} accessibilityRole="button" accessibilityState={{ selected: f === k }} onPress={() => setF(k)} style={{ height: 38, paddingHorizontal: 16, borderRadius: 19, justifyContent: "center", backgroundColor: f === k ? c.accent : c.card }}>
            <Txt bold size={14} style={{ color: f === k ? c.onAccent : c.muted }}>{l}</Txt>
          </Pressable>
        ))}
      </View>
      <View style={{ backgroundColor: c.card, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 6 }}>
        {shown.length === 0 && <Txt muted style={{ paddingVertical: 12 }}>{t("Još nema aktivnosti.", "No activity yet.")}</Txt>}
        {shown.map((x, i) => {
          const l = label(x.at), head = l !== last; last = l;
          return (
            <View key={i}>
              {head && <Txt bold size={12} muted style={{ marginTop: 10, letterSpacing: 0.5 }}>{l}</Txt>}
              <Pressable accessibilityRole="button" onPress={() => onOpen(x.slug)} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.tint, alignItems: "center", justifyContent: "center" }}><Txt bold>{x.group.charAt(0).toUpperCase()}</Txt></View>
                <View style={{ flex: 1 }}><Txt bold>{x.text}</Txt><Txt muted size={12}>{x.group} · {new Date(x.at).toLocaleTimeString("hr-HR", { hour: "2-digit", minute: "2-digit" })}</Txt></View>
              </Pressable>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}
