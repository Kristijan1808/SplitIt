import React, { useState, useEffect } from "react";
import { View } from "react-native";
import { api } from "./api";
import { Button, Card, Chip, Field, Heading, Page, Txt, useUI, s } from "./ui";
import type { Group } from "./types";
import type { Run } from "./GroupScreen";
export function GroupForm({
  create,
  run,
  open,
  initialCode = "",
}: {
  initialCode?: string;
  create: boolean;
  run: Run;
  open: (g: Group) => Promise<void>;
}) {
  const { t } = useUI();
  const [name, setName] = useState(initialCode);
  const [password, setPassword] = useState("");
  const [people, setPeople] = useState<string[]>([""]);
  useEffect(() => {
    if (!create) {
      setName(initialCode);
      setPassword("");
    }
  }, [initialCode, create]);
  const [created, setCreated] = useState<Group | null>(null);
  async function submit() {
    await run(async () => {
      if (created) {
        await open(created);
        return;
      }
      if (create) {
        const list = [...new Set(people.map((x) => x.trim()).filter(Boolean))];
        if (!name.trim() || !password || !list.length)
          throw new Error(
            t(
              "Unesi naziv, lozinku i barem jednog sudionika.",
              "Enter a name, password and at least one participant.",
            ),
          );
        const result = await api.create({
          name: name.trim(),
          password,
          people: list,
          accessType: "ANONYMOUS_ONLY",
        });
        setCreated(result);
        await open(result);
      } else {
        await open(
          await api.join({
            code: name.trim().toUpperCase(),
            password,
          }),
        );
      }
    });
  }
  return (
    <Page>
      <Heading
        title={
          create
            ? t("Nova grupa", "New group")
            : t("Pridruži se grupi", "Join a group")
        }
        subtitle={
          create
            ? t("Dobra ekipa. Jasni računi.", "Good company. Clear expenses.")
            : t(
                "Otvori istu grupu koju koristiš na webu.",
                "Open the same group you use on the web.",
              )
        }
      />
      <Card>
        <Field
          label={
            !create
              ? t("Kod od 6 znakova", "6-character code")
              : t("Naziv grupe", "Group name")
          }
          value={name}
          onChange={(value) => setName(create ? value : value.toUpperCase())}
          maxLength={!create ? 6 : 80}
        />
        <Field
          label={t("Lozinka grupe", "Group password")}
          value={password}
          onChange={setPassword}
          secure
          maxLength={80}
        />
        {create && (
          <>
            <Txt bold>{t("Sudionici", "Participants")}</Txt>
            {people.map((value, index) => (
              <View key={index} style={[s.row, { alignItems: "flex-end" }]}>
                <View style={{ flex: 1 }}>
                  <Field
                    label={`${t("Osoba", "Person")} ${index + 1}`}
                    value={value}
                    onChange={(name) =>
                      setPeople((xs) =>
                        xs.map((x, i) => (i === index ? name : x)),
                      )
                    }
                    maxLength={80}
                  />
                </View>
                {people.length > 1 && (
                  <Button
                    secondary
                    label="−"
                    onPress={() =>
                      setPeople((xs) => xs.filter((_, i) => i !== index))
                    }
                  />
                )}
              </View>
            ))}
            <Button
              secondary
              icon="plus"
              label={t("Dodaj osobu", "Add person")}
              onPress={() => setPeople((xs) => [...xs, ""])}
            />
          </>
        )}
        <Button
          label={
            created
              ? t("Otvori izrađenu grupu", "Open created group")
              : create
                ? t("Izradi grupu", "Create group")
                : t("Pridruži se", "Join group")
          }
          onPress={() => void submit()}
        />
      </Card>
    </Page>
  );
}
