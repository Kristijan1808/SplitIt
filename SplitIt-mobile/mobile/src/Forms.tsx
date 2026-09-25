import React, { useState, useEffect } from "react";
import { View } from "react-native";
import { api } from "./api";
import { Button, Card, Chip, Field, Heading, Page, Txt, useUI, s } from "./ui";
import type { AccessType, AuthResponse, Group } from "./types";
import type { Run } from "./GroupScreen";
export function GroupForm({
  create,
  run,
  open,
  signedIn,
  initialCode = "",
}: {
  initialCode?: string;
  create: boolean;
  run: Run;
  open: (g: Group) => Promise<void>;
  signedIn: boolean;
}) {
  const { t } = useUI();
  const [name, setName] = useState(initialCode);
  const [password, setPassword] = useState("");
  const [people, setPeople] = useState<string[]>([""]);
  const [access, setAccess] = useState<AccessType>("ANONYMOUS_ONLY");
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
          accessType: access,
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
            <Txt bold>{t("Pristup grupi", "Group access")}</Txt>
            <View style={s.wrap}>
              {(
                [
                  ["ANONYMOUS_ONLY", t("Bez računa", "Guest access")],
                  [
                    "REGISTERED_ONLY",
                    t("Samo registrirani", "Registered only"),
                  ],
                  ["MIXED", t("Svi", "Mixed")],
                ] as [AccessType, string][]
              ).map(([id, label]) => (
                <Chip
                  key={id}
                  selected={access === id}
                  label={label}
                  disabled={id === "REGISTERED_ONLY" && !signedIn}
                  onPress={() => setAccess(id)}
                />
              ))}
            </View>
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
            {!signedIn && (
              <Txt muted size={12}>
                {t(
                  "Za registriranu grupu najprije se prijavi.",
                  "Sign in first to create a registered-only group.",
                )}
              </Txt>
            )}
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
export function AuthForm({
  run,
  onAuth,
}: {
  run: Run;
  onAuth: (a: AuthResponse) => Promise<void>;
}) {
  const { t } = useUI();
  const [register, setRegister] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeat] = useState("");
  return (
    <Page>
      <Heading
        title={
          register
            ? t("Izradi račun", "Create account")
            : t("Dobro došao natrag", "Welcome back")
        }
        subtitle={t(
          "Isti korisnički račun kao na webu.",
          "The same account as on the web.",
        )}
      />
      <Card>
        <Field
          label={t("Korisničko ime", "Username")}
          value={username}
          onChange={setUsername}
        />
        <Field
          label={t("Lozinka", "Password")}
          value={password}
          onChange={setPassword}
          secure
        />
        {register && (
          <Field
            label={t("Ponovi lozinku", "Repeat password")}
            value={repeatPassword}
            onChange={setRepeat}
            secure
          />
        )}
        <Button
          label={
            register
              ? t("Registriraj se", "Register")
              : t("Prijavi se", "Sign in")
          }
          onPress={() =>
            void run(async () => {
              if (register && password !== repeatPassword)
                throw new Error(
                  t("Lozinke se ne podudaraju.", "Passwords do not match."),
                );
              await onAuth(
                await api.auth(register, {
                  username: username.trim(),
                  password,
                  ...(register ? { repeatPassword } : {}),
                }),
              );
            })
          }
        />
        <Button
          secondary
          label={
            register
              ? t("Već imam račun", "I already have an account")
              : t("Nemam račun", "Create an account")
          }
          onPress={() => setRegister(!register)}
        />
      </Card>
    </Page>
  );
}
