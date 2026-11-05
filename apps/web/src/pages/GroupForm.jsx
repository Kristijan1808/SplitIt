import React, { useState, useEffect } from "react";
import { View } from "react-native-web";
import { api } from "../services/api.js";
import { Button, Card, Chip, Field, Heading, Page, Txt, useUI, s } from "../components/ui.jsx";
export function GroupForm({ create, run, open, initialCode = "", signedIn = false, }) {
    const { t, c } = useUI();
    const [tried, setTried] = useState(false);
    const [access, setAccess] = useState("ANONYMOUS_ONLY");
    const [name, setName] = useState(initialCode);
    const [password, setPassword] = useState("");
    const [people, setPeople] = useState([""]);
    useEffect(() => {
        if (!create) {
            setName(initialCode);
            setPassword("");
        }
    }, [initialCode, create]);
    const [created, setCreated] = useState(null);
    const names = people.map(n => n.trim().toLowerCase());
    const badName = create ? name.trim().length < 3 : !(/^[A-Z0-9]{6}$/i.test(name.trim()));
    const badPass = create ? password.trim().length < 4 : !password;
    const badPerson = (i) => !names[i] || names.indexOf(names[i]) !== i;
    async function submit() {
        setTried(true);
        if (!created && (badName || badPass || (create && access !== "REGISTERED_ONLY" && names.some((_, i) => badPerson(i)))))
            return;
        await run(async () => {
            if (created) {
                await open(created);
                return;
            }
            if (create) {
                const list = [...new Set(people.map((x) => x.trim()).filter(Boolean))];
                const result = await api.create({
                    name: name.trim(),
                    password,
                    people: access === "REGISTERED_ONLY" ? [] : list,
                    accessType: access,
                });
                setCreated(result);
                await open(result);
            }
            else {
                await open(await api.join({
                    code: name.trim().toUpperCase(),
                    password,
                }));
            }
        });
    }
    return (<Page>
      <Heading title={create
            ? t("Nova grupa", "New group")
            : t("Pridruži se grupi", "Join a group")} subtitle={create
            ? t("Dobra ekipa. Jasni računi.", "Good company. Clear expenses.")
            : t("Otvori istu grupu koju koristiš na webu.", "Open the same group you use on the web.")}/>
      <Card>
        <Field label={!create
            ? t("Kod od 6 znakova", "6-character code")
            : t("Naziv grupe", "Group name")} value={name} onChange={(value) => setName(create ? value : value.toUpperCase())} maxLength={!create ? 6 : 80}/>
        {tried && badName && <Txt style={{ color: c.danger }}>{create ? t("Naziv treba imati najmanje 3 znaka.", "Use at least 3 characters.") : t("Unesi kod od 6 slova ili brojeva.", "Enter the 6-character code.")}</Txt>}
        <Field label={t("Lozinka grupe", "Group password")} value={password} onChange={setPassword} secure maxLength={80}/>
        {tried && badPass && <Txt style={{ color: c.danger }}>{create ? t("Lozinka treba imati najmanje 4 znaka.", "Use at least 4 characters.") : t("Unesi lozinku.", "Enter the password.")}</Txt>}
        {create && <View style={{ gap: 8 }}><Txt bold>{t("Pristup grupi", "Group access")}</Txt><View style={s.wrap}>{[["ANONYMOUS_ONLY", t("Bez računa", "Guests")], ["MIXED", t("Svi", "Everyone")], ["REGISTERED_ONLY", t("Samo registrirani", "Registered only")]].map(([id, label]) => <Chip key={id} label={label} selected={access === id} disabled={id === "REGISTERED_ONLY" && !signedIn} onPress={() => setAccess(id)}/>)}</View></View>}
        {create && access !== "REGISTERED_ONLY" && (<>
            <Txt bold>{t("Sudionici", "Participants")}</Txt>
            {people.map((value, index) => (<View key={index} style={[s.row, { alignItems: "flex-end" }]}>
                <View style={{ flex: 1 }}>
                  <Field label={`${t("Osoba", "Person")} ${index + 1}`} value={value} onChange={(name) => setPeople((xs) => xs.map((x, i) => (i === index ? name : x)))} maxLength={60}/>
                  {tried && badPerson(index) && <Txt size={12} style={{ color: c.danger }}>{t("Unesi različito ime za svakog sudionika.", "Enter a distinct name for each participant.")}</Txt>}
                </View>
                {people.length > 1 && (<Button secondary label="−" onPress={() => setPeople((xs) => xs.filter((_, i) => i !== index))}/>)}
              </View>))}
            <Button secondary icon="plus" label={t("Dodaj osobu", "Add person")} onPress={() => setPeople((xs) => [...xs, ""])}/>
          </>)}
        <Button label={created
            ? t("Otvori izrađenu grupu", "Open created group")
            : create
                ? t("Izradi grupu", "Create group")
                : t("Pridruži se", "Join group")} onPress={() => void submit()}/>
      </Card>
    </Page>);
}
