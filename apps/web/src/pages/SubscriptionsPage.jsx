import React from "react";
import { View, Pressable, useWindowDimensions } from "react-native-web";
import { Card, Icon, Page, Txt, useUI, s } from "../components/ui.jsx";
export function Plans({ onHome }) {
    const { c, t } = useUI(), w = useWindowDimensions().width, wide = w >= 850;
    const daily = (n) => t("Do {count} prijenosa slika dnevno za AI prepoznavanje", "Up to {count} image uploads per day for AI recognition").replace("{count}", String(n));
    const weekly = (n) => t("Do {count} prijenosa slika tjedno", "Up to {count} image uploads per week").replace("{count}", String(n));
    const plans = [
        { name: t("Besplatno", "Free"), description: t("Osnovne značajke za dijeljenje troškova s grupom.", "Core features for sharing expenses with your group."), features: [t("Osnovne značajke SplitIt aplikacije", "Core SplitIt features"), t("Bez naknade za pretplatu", "No subscription fee")] },
        { name: "Pro", description: t("Više prepoznavanja računa za svakodnevne potrebe.", "More receipt recognition for everyday use."), features: [daily(2), weekly(10)] },
        { name: "Pro+", description: t("Najviše prostora za prepoznavanje računa.", "The most room for receipt recognition."), features: [daily(10), weekly(30)] }
    ];
    return <Page wide><Pressable accessibilityRole="button" onPress={onHome} style={[s.row, { minHeight: 44 }]}><Icon name="back" color={c.accent}/><Txt bold style={{ color: c.accent }}>{t("Početna", "Home")}</Txt></Pressable>
 <View style={{ gap: 8, paddingTop: wide ? 22 : 6, marginBottom: 10 }}><Txt bold size={13} style={{ color: c.accent, letterSpacing: 2 }}>✧  {t("Pretplate", "Subscriptions").toUpperCase()}</Txt><Txt bold size={wide ? 40 : 30}>{t("Odaberite plan", "Choose a plan")}</Txt><Txt muted style={{ maxWidth: 700 }}>{t("Usporedite planove SplitIt pretplate. Pretplate su zasad informativne i još se ne mogu kupiti.", "Compare SplitIt subscription plans. These plans are informational only and are not available to purchase yet.")}</Txt></View>
 <View style={{ flexDirection: wide ? "row" : "column", gap: 16 }}>{plans.map((p, i) => <Card key={p.name} style={{ flex: wide ? 1 : undefined, minWidth: 0, minHeight: wide ? 292 : undefined, padding: wide ? 22 : 16, borderTopWidth: 3, gap: 14 }}>
 {i === 2 && <View style={{ alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 5, borderRadius: 24, backgroundColor: c.accent }}><Txt bold size={12} style={{ color: c.bg }}>✧  {t("Preporučeno", "Recommended")}</Txt></View>}
 <View style={s.between}><Txt bold size={25}>{p.name}</Txt><View style={{ backgroundColor: c.tint, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 }}><Txt bold size={21} style={{ color: c.accent }}>✧</Txt></View></View><Txt muted>{p.description}</Txt>
 <View style={{ marginTop: wide ? "auto" : 4, borderTopWidth: 1, borderColor: c.line, paddingTop: 14, gap: 10 }}>{p.features.map(f => <View key={f} style={[s.row, { alignItems: "flex-start" }]}><Icon name="check" size={18} color={c.accent}/><Txt style={{ flex: 1 }}>{f}</Txt></View>)}</View></Card>)}</View>
 <Card style={{ padding: wide ? 22 : 16, marginTop: 6, gap: 12 }}><Txt bold size={24}>{t("Odaberite način pretplate", "Choose a subscription type")}</Txt><Txt muted>{t("Kada pretplate budu dostupne, moći ćete odabrati odnosi li se plan na pojedinog korisnika ili cijelu grupu.", "When subscriptions become available, you will be able to choose whether a plan applies to an individual user or the whole group.")}</Txt><View style={{ flexDirection: wide ? "row" : "column", gap: 12 }}>{[[t("Pretplata po korisniku", "Per-user subscription"), "user"], [t("Pretplata po grupi", "Group subscription"), "groups"]].map(([label, icon]) => <View key={icon} style={[s.row, { flex: wide ? 1 : undefined, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: c.line, backgroundColor: c.bg }]}><Icon name={icon} color={c.accent}/><Txt bold>{label}</Txt></View>)}</View></Card></Page>;
}
