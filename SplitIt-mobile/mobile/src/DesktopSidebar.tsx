import React, { useState } from "react";
import { View, Pressable, ScrollView } from "react-native";
import { Icon, Txt, useUI } from "./ui";

type Destination = "home" | "groups" | "settings" | "plans";
export function DesktopSidebar({
  screen,
  navigate,
  onAdd,
}: {
  screen: string;
  navigate: (id: Destination) => void;
  onAdd?: () => void;
}) {
  const { c, t, busy } = useUI();
  const [hover, setHover] = useState<string | null>(null);
  const active =
    screen === "plans"
      ? "plans"
      : screen === "account"
        ? "settings"
        : ["create", "join", "group", "expense"].includes(screen)
          ? "groups"
          : screen;
  function row(id: Destination, label: string, icon: string) {
    const selected = active === id;
    return (
      <Pressable
        key={id}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected, disabled: busy }}
        disabled={busy}
        onHoverIn={() => setHover(id)}
        onHoverOut={() => setHover(null)}
        onPress={() => navigate(id)}
        style={({ pressed }) => ({
          minHeight: 48,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingHorizontal: 10,
          borderRadius: 12,
          backgroundColor: selected
            ? c.tint
            : hover === id || pressed
              ? c.bg
              : c.card,
          opacity: busy ? 0.65 : 1,
        })}
      >
        <View
          style={{
            width: 3,
            height: 20,
            borderRadius: 2,
            backgroundColor: selected ? c.accent : "transparent",
          }}
        />
        {id === "plans" ? (
          <Txt
            bold
            size={21}
            style={{
              width: 22,
              textAlign: "center",
              color: selected ? c.accent : c.muted,
            }}
          >
            ✧
          </Txt>
        ) : (
          <Icon name={icon} size={22} color={selected ? c.accent : c.muted} />
        )}
        <Txt
          size={15}
          bold={selected}
          style={{ color: selected ? c.accent : c.ink, flexShrink: 1 }}
        >
          {label}
        </Txt>
      </Pressable>
    );
  }
  return (
    <View
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        width: 240,
        borderRightWidth: 1,
        borderColor: c.line,
        backgroundColor: c.card,
      }}
    >
      <ScrollView
        contentContainerStyle={{ padding: 14, paddingTop: 24, gap: 5 }}
      >
        {onAdd && (
          <Pressable accessibilityRole="button" disabled={busy} onPress={onAdd} style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 48, borderRadius: 24, backgroundColor: c.accent, marginBottom: 18 }}>
            <Icon name="plus" size={18} color={c.onAccent} />
            <Txt bold style={{ color: c.onAccent }}>{t("Dodaj trošak", "Add expense")}</Txt>
          </Pressable>
        )}
        <Txt
          bold
          size={11}
          muted
          style={{ letterSpacing: 1.4, marginLeft: 12, marginBottom: 9 }}
        >
          {t("IZBORNIK", "MENU")}
        </Txt>
        {row("home", t("Početna", "Home"), "home")}
        {row("groups", t("Grupe", "Groups"), "groups")}
        {row("settings", t("Postavke", "Settings"), "settings")}
        <View
          style={{
            height: 1,
            backgroundColor: c.line,
            marginVertical: 12,
            marginHorizontal: 10,
          }}
        />
        {row("plans", t("Planovi pretplate", "Subscription plans"), "")}
      </ScrollView>
    </View>
  );
}
