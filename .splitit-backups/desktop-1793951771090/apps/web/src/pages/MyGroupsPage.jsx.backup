import React from "react";
import { View } from "react-native-web";
import { Page, Button, Txt, s, Card, Heading, Chip, Field } from "../components/ui.jsx";
export default function MyGroupsPage({ t, nav, groups, groupList, groupSearch, setGroupSearch, showArchived, setShowArchived, grid }) {
    return (<Page wide>
                  <Heading title={t("Moje grupe", "My groups")} subtitle={t("Tvoja putovanja, večere i zajednički planovi.", "Your trips, dinners and shared plans.")}/>
                  <View style={s.row}>
                    <View style={{ flex: 1 }}>
                      <Button icon="plus" label={t("Nova grupa", "New group")} onPress={() => nav("create")}/>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Button secondary label={t("Pridruži se", "Join")} onPress={() => nav("join")}/>
                    </View>
                  </View>
                  <Field label={t("Pretraži grupe", "Search groups")} value={groupSearch} onChange={setGroupSearch}/>
                  <View style={s.wrap}>
                    <Chip label={t("Aktivne", "Active")} selected={!showArchived} onPress={() => setShowArchived(false)}/>
                    <Chip label={t("Arhivirane", "Archived")} selected={showArchived} onPress={() => setShowArchived(true)}/>
                  </View>
                  {groups.length ? (<View style={{
                flexDirection: grid ? "row" : "column",
                flexWrap: "wrap",
                gap: 12,
            }}>
                      {groupList()}
                    </View>) : (<Card>
                      <Txt muted>
                        {t("Još nema spremljenih grupa.", "No saved groups yet.")}
                      </Txt>
                    </Card>)}
                </Page>);
}
