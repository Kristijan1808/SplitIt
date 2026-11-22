import React, { useState } from "react";
import { View, Pressable, ScrollView, TextInput, useWindowDimensions } from "react-native";
import { Icon, Txt, useUI } from "./ui";
/** Prvi ekran: prijava, registracija ili nastavak bez računa (uz brzi ulaz kodom). */
export function Welcome({ onLogin, onRegister, onGuest, onJoin }: { onLogin: () => void; onRegister: () => void; onGuest: () => void; onJoin: (code: string) => void }) {
  const { c, t } = useUI();
  const wide = useWindowDimensions().width >= 900;
  const [code, setCode] = useState("");
  const body = (
    <View style={{ gap: 10, width: "100%", maxWidth: 440, alignSelf: "center" }}>
      <Txt bold size={13} muted style={{ letterSpacing: 1 }}>{t("KAKO ŽELIŠ NASTAVITI?", "HOW DO YOU WANT TO CONTINUE?")}</Txt>
      <Pressable accessibilityRole="button" onPress={onLogin} style={{ minHeight: 56, borderRadius: 28, backgroundColor: c.accent, alignItems: "center", justifyContent: "center" }}>
        <Txt bold size={16} style={{ color: c.onAccent }}>{t("Prijava", "Sign in")}</Txt>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={onRegister} style={{ minHeight: 56, borderRadius: 28, borderWidth: 2, borderColor: c.line, backgroundColor: c.card, alignItems: "center", justifyContent: "center" }}>
        <Txt bold size={15} style={{ color: c.accent }}>{t("Napravi račun", "Create an account")}</Txt>
      </Pressable>
      <Txt muted size={12} style={{ textAlign: "center" }}>{t("Prijava Googleom dostupna je na ekranu Prijava.", "Google sign-in is available on the Sign in screen.")}</Txt>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 4 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: c.line }} /><Txt muted size={13}>{t("ili", "or")}</Txt><View style={{ flex: 1, height: 1, backgroundColor: c.line }} />
      </View>
      <Pressable accessibilityRole="button" onPress={onGuest} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: 22, borderWidth: 2, borderColor: c.line, backgroundColor: c.card }}>
        <View style={{ flex: 1 }}>
          <Txt bold size={16}>{t("Nastavi bez računa", "Continue without an account")}</Txt>
          <Txt muted size={12}>{t("Grupe se spremaju na ovom uređaju. Račun možeš napraviti kasnije.", "Groups are saved on this device. You can create an account later.")}</Txt>
        </View>
        <Icon name="payment" color={c.accent} />
      </Pressable>
      <View style={{ flexDirection: "row", gap: 8, alignItems: "stretch" }}>
        <View style={{ flex: 1, backgroundColor: c.card, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8 }}>
          <Txt bold size={11} muted>{t("Imaš kod grupe?", "Have a group code?")}</Txt>
          <TextInput accessibilityLabel={t("Kod grupe", "Group code")} value={code} onChangeText={setCode} autoCapitalize="characters" maxLength={12} placeholder="SPL123" placeholderTextColor={c.muted} style={{ color: c.ink, fontSize: 16, fontWeight: "800", paddingVertical: 4 }} />
        </View>
        <Pressable accessibilityRole="button" onPress={() => onJoin(code.trim().toUpperCase())} style={{ paddingHorizontal: 16, borderRadius: 16, backgroundColor: c.tint, justifyContent: "center" }}>
          <Txt bold style={{ color: c.accent }}>{t("Pridruži se", "Join")}</Txt>
        </Pressable>
      </View>
    </View>
  );
  const hero = (
    <View style={{ gap: 12 }}>
      <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: wide ? c.card : c.accent, alignItems: "center", justifyContent: "center" }}>
        <Txt bold size={32} style={{ color: wide ? c.accent : c.onAccent }}>÷</Txt>
      </View>
      <Txt bold size={wide ? 48 : 34} style={{ color: wide ? c.onAccent : c.ink, letterSpacing: -1, lineHeight: wide ? 52 : 38, marginTop: 16 }}>{t("Podijelite račun bez računanja", "Split the bill without the maths")}</Txt>
      <Txt size={15} style={{ color: wide ? c.onAccent : c.muted }}>{t("Slikaj račun, svatko označi svoje, a aplikacija izračuna tko kome koliko duguje.", "Snap the receipt, everyone marks their items, and the app works out who owes whom.")}</Txt>
    </View>
  );
  if (wide) return (
    <View style={{ flex: 1, flexDirection: "row" }}>
      <View style={{ flex: 1, backgroundColor: c.accent, padding: 64, justifyContent: "flex-end" }}>{hero}</View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 40 }}>{body}</ScrollView>
    </View>
  );
  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "space-between", padding: 20, paddingTop: 40, gap: 28 }}>{hero}{body}</ScrollView>
  );
}
