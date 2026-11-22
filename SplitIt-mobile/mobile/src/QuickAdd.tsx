import React, { useState } from "react";
import { Modal, Pressable, ScrollView, View, Image, StyleSheet, useWindowDimensions } from "react-native";
import { Icon, Txt, useUI } from "./ui";
import type { SavedGroup } from "./storage";
export type QuickKind = "scan" | "manual" | "pay";
/** Prozor koji otvara središnji "+": izbor grupe pa skeniranje, ručni unos ili evidencija uplate. */
export function QuickAdd({ groups, bottomInset, onPick, onCreate, onJoin, onClose }: {
  groups: SavedGroup[]; bottomInset: number;
  onPick: (slug: string, kind: QuickKind) => void; onCreate: () => void; onJoin: () => void; onClose: () => void;
}) {
  const { c, t } = useUI();
  const wide = useWindowDimensions().width >= 900;
  const list = groups.filter((g) => !g.archived);
  const [slug, setSlug] = useState(list[0]?.slug ?? "");
  const big = (kind: QuickKind, icon: string, title: string, hint: string, primary: boolean) => (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: !slug }} disabled={!slug} onPress={() => onPick(slug, kind)}
      style={{ flex: 1, minHeight: 128, borderRadius: 22, padding: 16, justifyContent: "space-between", backgroundColor: primary ? c.accent : c.card }}>
      <Icon name={icon} size={30} color={primary ? c.onAccent : c.accent} />
      <View><Txt bold size={16} style={{ color: primary ? c.onAccent : c.ink }}>{title}</Txt><Txt size={12} style={{ color: primary ? c.onAccent : c.muted }}>{hint}</Txt></View>
    </Pressable>
  );
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "#14102873", justifyContent: wide ? "center" : "flex-end", alignItems: "center", padding: wide ? 24 : 0 }}>
      <Pressable accessibilityLabel={t("Zatvori", "Close")} onPress={onClose} style={StyleSheet.absoluteFill} />
      <View accessibilityViewIsModal style={{ backgroundColor: c.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderBottomLeftRadius: wide ? 28 : 0, borderBottomRightRadius: wide ? 28 : 0, padding: 20, paddingTop: 12, paddingBottom: Math.max(bottomInset, 12) + 16, gap: 12, width: "100%", maxWidth: 560, alignSelf: "center" }}>
        <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: c.line, alignSelf: "center" }} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Txt bold size={20}>{t("Dodaj trošak", "Add expense")}</Txt>
            <Txt muted size={13}>{list.length ? t("U koju grupu?", "Which group?") : t("Prvo napravi grupu ili se pridruži kodom.", "Create a group or join with a code first.")}</Txt>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={t("Zatvori", "Close")} onPress={onClose} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.card, alignItems: "center", justifyContent: "center" }}>
            <Icon name="close" color={c.ink} />
          </Pressable>
        </View>
        {list.length ? (<>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} accessibilityRole="radiogroup">
            {list.map((g) => {
              const on = g.slug === slug;
              return (
                <Pressable key={g.slug} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => setSlug(g.slug)}
                  style={{ flexDirection: "row", alignItems: "center", gap: 8, height: 48, paddingLeft: 6, paddingRight: 14, borderRadius: 24, borderWidth: 2, borderColor: on ? c.accent : c.line, backgroundColor: on ? c.tint : c.card, maxWidth: 230 }}>
                  {g.avatar && /^(data:|https?:)/.test(g.avatar)
                    ? <Image source={{ uri: g.avatar }} style={{ width: 34, height: 34, borderRadius: 17 }} />
                    : <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c.peach, alignItems: "center", justifyContent: "center" }}><Txt bold>{g.avatar || g.name.charAt(0).toUpperCase()}</Txt></View>}
                  <Txt bold={on} style={{ color: on ? c.ink : c.muted, flexShrink: 1 }}>{g.name}</Txt>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {big("scan", "scan", t("Skeniraj račun", "Scan bill"), t("Ekipa bira svoje stavke", "Everyone picks their items"), true)}
            {big("manual", "pen", t("Upiši ručno", "Enter manually"), t("Iznos i tko je platio", "Amount and who paid"), false)}
          </View>
          <Pressable accessibilityRole="button" disabled={!slug} onPress={() => onPick(slug, "pay")} style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: c.card, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 16, minHeight: 56 }}>
            <Icon name="payment" color={c.accent} />
            <View style={{ flex: 1 }}><Txt bold>{t("Evidentiraj uplatu", "Record a payment")}</Txt><Txt muted size={12}>{t("Netko ti je vratio novac", "Someone paid you back")}</Txt></View>
            <Txt bold style={{ color: c.accent }}>›</Txt>
          </Pressable>
        </>) : (
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable accessibilityRole="button" onPress={onCreate} style={{ flex: 1, minHeight: 56, borderRadius: 28, backgroundColor: c.accent, alignItems: "center", justifyContent: "center" }}><Txt bold style={{ color: c.onAccent }}>{t("Napravi grupu", "Create group")}</Txt></Pressable>
            <Pressable accessibilityRole="button" onPress={onJoin} style={{ flex: 1, minHeight: 56, borderRadius: 28, borderWidth: 2, borderColor: c.line, backgroundColor: c.card, alignItems: "center", justifyContent: "center" }}><Txt bold style={{ color: c.accent }}>{t("Pridruži se kodom", "Join with code")}</Txt></Pressable>
          </View>
        )}
      </View>
      </View>
    </Modal>
  );
}
