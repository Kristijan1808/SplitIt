import React from "react";
import { View } from "react-native-web";
import { Page, Button, Txt, s, Card } from "../components/ui.jsx";
import { ReceiptMark } from "../components/FineLine.jsx";
export default function HomePage({ t, nav, groups, groupList }) {
    return (<Page>
                  <Txt bold size={15}>{t("Početna", "Home")}</Txt>
                  <View style={[s.between, { paddingVertical: 6 }]}>
                    <Txt bold size={31} style={{ flex: 1, letterSpacing: -1, lineHeight: 35 }}>{t("Dobra ekipa\ndijeli fer.", "Good company\nshares fairly.")}</Txt><ReceiptMark />
                  </View>
                  <Button label={t("Izradi grupu", "Create group")} onPress={() => nav("create")}/>
                  <Button secondary label={t("Pridruži se kodom", "Join with a code")} onPress={() => nav("join")}/>
                  <View style={s.between}>
                    <Txt bold size={21}>
                      {t("Tvoje grupe", "Your groups")}
                    </Txt>
                    <Txt muted>{groups.length}</Txt>
                  </View>
                  {groups.length ? (groupList(3)) : (<Card>
                      <Txt muted>
                        {t("Ovdje će se pojaviti grupe koje izradiš ili kojima se pridružiš.", "Groups you create or join will appear here.")}
                      </Txt>
                    </Card>)}
                </Page>);
}
