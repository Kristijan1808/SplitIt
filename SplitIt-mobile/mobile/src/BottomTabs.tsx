import React from "react";
import { View, Pressable } from "react-native";
import { Icon, Txt, useUI } from "./ui";
export type TabId = "home" | "groups" | "activity" | "settings";
/** Donja navigacija iz dizajna: Početna / Grupe / okrugli "+" / Aktivnost / Profil. */
export function BottomTabs({ active, onNavigate, onAdd, bottomInset }: { active: string; onNavigate: (id: TabId) => void; onAdd: () => void; bottomInset: number }) {
  const { c, t, busy } = useUI();
  const tab = (id: TabId, icon: string, label: string) => {
    const on = active === id || (id === "groups" && active === "group");
    return (
      <Pressable key={id} accessibilityRole="tab" accessibilityState={{ selected: on, disabled: busy }} disabled={busy} onPress={() => onNavigate(id)} style={{ flex: 1, minHeight: 56, alignItems: "center", justifyContent: "center", gap: 3 }}>
        <View style={{ width: 44, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: on ? c.tint : "transparent" }}>
          <Icon name={icon} size={22} color={on ? c.accent : c.muted} />
        </View>
        <Txt size={11} bold style={{ color: on ? c.accent : c.muted }}>{label}</Txt>
      </Pressable>
    );
  };
  return (
    <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: c.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 8, paddingBottom: Math.max(bottomInset, 10), paddingHorizontal: 8, shadowColor: "#1B1A2E", shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: -4 }, elevation: 12 }}>
      {tab("home", "home", t("Početna", "Home"))}
      {tab("groups", "groups", t("Grupe", "Groups"))}
      <View style={{ width: 76, alignItems: "center" }}>
        <Pressable accessibilityRole="button" accessibilityLabel={t("Dodaj trošak", "Add expense")} disabled={busy} onPress={onAdd} style={{ width: 60, height: 60, borderRadius: 30, borderWidth: 5, borderColor: c.bg, backgroundColor: c.accent, alignItems: "center", justifyContent: "center", marginTop: -36, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 8 }}>
          <Icon name="plus" size={28} color={c.onAccent} />
        </Pressable>
      </View>
      {tab("activity", "activity", t("Aktivnost", "Activity"))}
      {tab("settings", "user", t("Profil", "Profile"))}
    </View>
  );
}
