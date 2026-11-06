import React from "react";
import { View } from "react-native-web";
import { Page, Button, Txt, s, Card, Heading, Chip } from "../components/ui.jsx";
import { API_URL } from "../services/api.js";
export default function SettingsPage({ t, session, nav, isDark, locale, preferences }) {
    return (<Page>
                  <Heading title={t("Postavke", "Settings")}/>
                  <Card>
                    <Txt bold>
                      {session?.user.username ||
            t("Pristup bez računa", "Guest access")}
                    </Txt>
                    <Button secondary label={session
            ? t("Moj račun", "My account")
            : t("Prijava ili registracija", "Sign in or register")} onPress={() => nav("account")}/>
                    <Button secondary label={t("Planovi", "Plans")} onPress={() => nav("plans")}/>
                  </Card>
                  <Card>
                    <Txt bold>{t("Izgled", "Appearance")}</Txt>
                    <View style={s.wrap}>
                      <Chip label={t("Svijetlo", "Light")} selected={!isDark} onPress={() => preferences(locale, false)}/>
                      <Chip label={t("Tamno", "Dark")} selected={isDark} onPress={() => preferences(locale, true)}/>
                    </View>
                    <Txt bold>{t("Jezik", "Language")}</Txt>
                    <View style={s.wrap}>
                      <Chip label="Deutsch" selected={locale === "de"} onPress={() => preferences("de", isDark)}/>
                      <Chip label="日本語" selected={locale === "ja"} onPress={() => preferences("ja", isDark)}/>
                      <Chip label="Hrvatski" selected={locale === "hr"} onPress={() => preferences("hr", isDark)}/>
                      <Chip label="English" selected={locale === "en"} onPress={() => preferences("en", isDark)}/>
                    </View>
                  </Card>
                  <Card>
                    <Txt muted size={12}>
                      SplitIt Web · 1.0.0
                    </Txt>
                    <Txt muted size={12}>
                      {t("Podatke osvježi povlačenjem zaslona grupe prema dolje.", "Pull down on a group screen to refresh its data.")}
                    </Txt>
                    {!API_URL && (<Txt>
                        {t("API još nije konfiguriran.", "API is not configured yet.")}
                      </Txt>)}
                  </Card>
                </Page>);
}
