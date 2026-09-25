import React from "react";
import { Pressable, View } from "react-native";
import { Icon, Txt, useUI, s } from "./ui";
import { expenseNet } from "./domain.mjs";
import type { Expense, Person } from "./types";
export function ExpenseCard({
  expense: e,
  people,
  personId,
  expanded,
  onPress,
  children,
}: React.PropsWithChildren<{
  expense: Expense;
  people: Person[];
  personId?: string;
  expanded: boolean;
  onPress: () => void;
}>) {
  const { c, t, busy } = useUI();
  const net = expenseNet(e, personId);
  const names = e.payers
    .map(
      (p) =>
        people.find((x) => x.id === p.personId)?.name ??
        p.person?.name ??
        t("Sudionik", "Participant"),
    )
    .join(", ");
  const label =
    net === null
      ? t("Odaberi svoj profil", "Choose your identity")
      : !net.involved
        ? t("Ne sudjeluješ", "Not involved")
        : net.net > 0
          ? t("Posudio/la si", "You lent")
          : net.net < 0
            ? t("Duguješ", "You borrowed")
            : t("Poravnato", "Settled");
  const color = net && net.net < 0 ? c.debt : c.accent;
  const date = new Date(e.createdAt);
  return (
    <View style={{ borderBottomWidth: 1, borderColor: c.line }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded, disabled: busy }}
        accessibilityLabel={`${e.note || t("Račun", "Bill")}, ${Number(e.totalAmount).toFixed(2)} €`}
        disabled={busy}
        onPress={onPress}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          paddingVertical: 10,
          minHeight: 76,
        }}
      >
        <View style={{ width: 30, alignItems: "center" }}>
          <Txt muted size={10}>
            {date.toLocaleDateString(t("hr-HR", "en-GB"), { month: "short" })}
          </Txt>
          <Txt muted size={17}>
            {date.getDate()}
          </Txt>
        </View>
        <View
          style={{
            width: 38,
            height: 42,
            backgroundColor: c.tint,
            borderRadius: 7,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="receipt" color={c.accent} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Txt bold size={15}>
            {e.note || t("Zajednički račun", "Shared bill")}
          </Txt>
          <Txt muted size={11}>
            {names} · {t("plaćeno", "paid")} {Number(e.totalAmount).toFixed(2)}{" "}
            €
          </Txt>
        </View>
        <View style={{ width: 86, alignItems: "flex-end", gap: 4 }}>
          <Txt size={10} style={{ color, textAlign: "right" }}>
            {label}
          </Txt>
          {net && net.net !== 0 && (
            <Txt bold size={15} style={{ color }}>
              {(Math.abs(net.net) / 100).toFixed(2)} €
            </Txt>
          )}
          <Txt muted size={10}>
            {expanded ? "⌃" : "⌄"}
          </Txt>
        </View>
      </Pressable>
      {expanded && (
        <View style={{ paddingBottom: 16, gap: 12 }}>{children}</View>
      )}
    </View>
  );
}
