import {categoryIcon} from "./catalog";
import React from "react";
import { Pressable, View, Modal, ScrollView, useWindowDimensions } from "react-native";
import { Icon, Txt, useUI, s, Button } from "./ui";
import { expenseNet } from "./domain.mjs";
import type { Expense, Person } from "./types";
export function ExpenseCard({
  expense: e,
  people,
  currency="EUR",
  personId,
  expanded,
  onPress,
  children,
}: React.PropsWithChildren<{
  expense: Expense;
  people: Person[];
  currency?:string;
  personId?: string;
  expanded: boolean;
  onPress: () => void;
}>) {
  const { c, t, busy } = useUI();
  const desktop=useWindowDimensions().width>=1024;
  const pending=e.allocationComplete===false;
  const net = e.paymentIncomplete?null:expenseNet(e, personId);
  const names = e.payers
    .map(
      (p) =>
        people.find((x) => x.id === p.personId)?.name ??
        p.person?.name ??
        t("Sudionik", "Participant"),
    )
    .join(", ");
  const label =
    e.paymentIncomplete?t("Saldo nakon ispravka", "Balance after correction"):
    net === null
      ? t("Odaberi svoje ime", "Choose your identity")
      : !net.involved
        ? pending?t("Još nema tvog odabira", "Not selected yet"):t("Ne sudjeluješ", "Not involved")
        : net.net > 0
          ? t("Posudio/la si", "You lent")
          : net.net < 0
            ? t("Duguješ", "You borrowed")
            : pending?t("Privremeni saldo", "Provisional balance"):t("Poravnato", "Settled");
  const color = net && net.net < 0 ? c.debt : c.accent;
  const date = new Date(e.billDate||e.createdAt);
  return (
    <View style={{ borderWidth:1,borderColor:c.line,backgroundColor:pending?c.dangerTint:c.card,borderRadius:18,paddingHorizontal:10,overflow:"hidden",marginVertical:2 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded, disabled: busy }}
        accessibilityLabel={`${e.note || t("Račun", "Bill")}, ${Number(e.totalAmount).toFixed(2)} ${currency}`}
        disabled={busy}
        onPress={onPress}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingVertical: 9,
          minHeight: 70,
        }}
      >
        <View style={{ width: 24, alignItems: "center" }}>
          <Txt muted size={10}>
            {date.toLocaleDateString(t("hr-HR", "en-GB"), { month: "short" })}
          </Txt>
          <Txt muted size={17}>
            {date.getDate()}
          </Txt>
        </View>
        <View
          style={{
            width: 32,
            height: 36,
            backgroundColor: c.tint,
            borderRadius: 10,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name={categoryIcon(e.category)} color={c.accent} />
        </View>
        <View style={{ flex: 1, minWidth:0, gap: 3 }}>
          <Txt bold size={15}>
            {e.note || t("Zajednički račun", "Shared bill")}
          </Txt>
          {e.currency&&e.currency!==currency&&<Txt muted size={11}>{Number(e.originalTotal).toFixed(2)} {e.currency} · 1 {e.currency} = {e.exchangeRate} {currency}{e.rateDate?` · ${e.rateDate}`:""}</Txt>}
          {pending&&<Txt bold size={11} style={{color:c.danger}}>{t("Čeka podjelu", "Awaiting split")} · {e.unassignedCount}/{e.items.length}</Txt>}
          {e.paymentIncomplete&&<Txt bold size={11} style={{color:c.danger}}>{t("Provjeri platitelje", "Check payers")}</Txt>}
          <Txt muted size={11}>
            {names} · {t("plaćeno", "paid")} {Number(e.totalAmount).toFixed(2)}{" "}
            {currency}
          </Txt>
        </View>
        <View style={{ width: 78, alignItems: "flex-end", gap: 4 }}>
          <Txt size={10} style={{ color, textAlign: "right" }}>
            {label}
          </Txt>
          {net && net.net !== 0 && (
            <Txt bold size={15} style={{ color }}>
              {(Math.abs(net.net) / 100).toFixed(2)} {currency}
            </Txt>
          )}
          <Txt muted size={10}>
            {expanded ? "⌃" : "⌄"}
          </Txt>
        </View>
      </Pressable>
      {expanded&&desktop&&<Modal visible transparent animationType="fade" onRequestClose={onPress}><View style={{flex:1,backgroundColor:"#0007",alignItems:"flex-end"}}><View accessibilityViewIsModal style={{flex:1,width:520,maxWidth:"100%",backgroundColor:c.card,padding:20,gap:12}}><View style={s.between}><Txt bold size={21}>{e.note||t("Račun","Bill")}</Txt><Button secondary compact label={t("Zatvori","Close")} onPress={onPress}/></View><Txt bold size={24}>{Number(e.totalAmount).toFixed(2)} {currency}</Txt><ScrollView contentContainerStyle={{gap:10,paddingBottom:24}}>{children}</ScrollView></View></View></Modal>}
      {expanded && !desktop && (
        <View style={{ paddingBottom: 10, paddingTop:4, gap: 7 }}>{children}</View>
      )}
    </View>
  );
}
