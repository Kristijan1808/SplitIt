import { invitationCode } from "./src/domain.mjs";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  AppState,
  BackHandler,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  View,
} from "react-native";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { api, setToken, setParticipant, API_URL, WEB_URL } from "./src/api";
import { storage, SavedGroup } from "./src/storage";
import type { AuthResponse, Group, Expense } from "./src/types";
import {
  UI,
  light,
  dark,
  Button,
  Card,
  Chip,
  Heading,
  Icon,
  Loading,
  Page,
  Txt,
  s,
} from "./src/ui";
import { GroupScreen, Snapshot } from "./src/GroupScreen";
import { ExpenseEditor } from "./src/ExpenseEditor";
import { AuthForm, GroupForm } from "./src/Forms";
type Screen =
  | "home"
  | "groups"
  | "settings"
  | "auth"
  | "create"
  | "join"
  | "group"
  | "expense";
export default function App() {
  return (
    <SafeAreaProvider>
      <Main />
    </SafeAreaProvider>
  );
}
function Main() {
  const insets = useSafeAreaInsets();
  const [locale, setLocale] = useState<"hr" | "en">("hr");
  const [isDark, setDark] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [screen, setScreen] = useState<Screen>("home");
  const [groups, setGroups] = useState<SavedGroup[]>([]);
  const [auth, setAuth] = useState<AuthResponse | null>(null);
  const [data, setData] = useState<Snapshot | null>(null);
  const [tab, setTab] = useState("overview");
  const [editingExpense, setEditingExpense] = useState<Expense | undefined>();
  const [startCamera, setStartCamera] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  const [initialCode, setInitialCode] = useState("");
  const gate = useRef(false);
  const groupsRef = useRef(groups);
  const c = isDark ? dark : light;
  const t = (hr: string, en: string) => (locale === "hr" ? hr : en);
  const persistGroups = async (next: SavedGroup[]) => {
    await storage.write("groups", next);
    groupsRef.current = next;
    setGroups(next);
  };
  const saveGroup = async (g: Group) => {
    const prior = groupsRef.current.find((x) => x.slug === g.slug);
    const id = prior?.participantId;
    const p = g.people.find((x) => x.id === id);
    await persistGroups([
      {
        slug: g.slug,
        name: g.name,
        code: g.code,
        participantId: p?.id,
        participantName: p?.name,
      },
      ...groupsRef.current.filter((x) => x.slug !== g.slug),
    ]);
  };
  const run = useCallback(async (fn: () => Promise<void>) => {
    if (gate.current) return false;
    gate.current = true;
    setBusy(true);
    setError("");
    try {
      await fn();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      gate.current = false;
      setBusy(false);
    }
  }, []);
  async function load(slug: string) {
    const [group, drafts, settlements, history] = await Promise.all([
      api.group(slug),
      api.drafts(slug),
      api.settlements(slug),
      api.history(slug),
    ]);
    await saveGroup(group);
    setData({ group, drafts, settlements, history });
  }
  async function openGroup(g: Group) {
    await load(g.slug);
    setTab("overview");
    setScreen("group");
  }
  async function refresh() {
    if (data) await load(data.group.slug);
  }
  function nav(next: Screen) {
    setError("");
    setScreen(next);
  }
  function back() {
    if (gate.current) return;
    if (screen === "expense") {
      Alert.alert(
        t("Napustiti unos?", "Leave editor?"),
        t(
          "Nespremljene promjene bit će izgubljene.",
          "Unsaved changes will be lost.",
        ),
        [
          { text: t("Nastavi unos", "Keep editing"), style: "cancel" },
          {
            text: t("Napusti", "Leave"),
            onPress: () => {
              nav("group");
              void run(refresh);
            },
          },
        ],
      );
    } else nav("groups");
  }
  useEffect(() => {
    void run(async () => {
      const [a, gs, prefs] = await Promise.all([
        storage.auth(),
        storage.read<SavedGroup[]>("groups", []),
        storage.read("prefs", { locale: "hr", dark: false }),
      ]);
      setAuth(a);
      setToken(a?.token);
      groupsRef.current = gs;
      setGroups(gs);
      setLocale(prefs.locale === "en" ? "en" : "hr");
      setDark(!!prefs.dark);
    }).then(() => setReady(true));
  }, [run]);
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (screen === "groups") return busy;
      back();
      return true;
    });
    return () => sub.remove();
  }, [screen, busy, locale, data]);
  useEffect(() => {
    if (!ready) return;
    const handle = (url: string) => {
      const code = invitationCode(url, WEB_URL);
      if (code) {
        setInitialCode(code);
        setScreen("join");
      }
    };
    void Linking.getInitialURL().then((url) => {
      if (url) handle(url);
    });
    const sub = Linking.addEventListener("url", ({ url }) => handle(url));
    return () => sub.remove();
  }, [ready]);
  // Refresh an open group after returning from the web/camera/background. Never clobber an editor.
  useEffect(() => {
    if (screen !== "group" || !data) return;
    const slug = data.group.slug;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void run(() => load(slug));
    });
    return () => sub.remove();
  }, [screen, data?.group.slug, run]);
  const current = groups.find((x) => x.slug === data?.group.slug);
  useEffect(
    () => setParticipant(current?.participantId),
    [current?.participantId],
  );
  const preferences = (language: "hr" | "en", darkMode: boolean) =>
    void run(async () => {
      await storage.write("prefs", { locale: language, dark: darkMode });
      setLocale(language);
      setDark(darkMode);
    });
  const remove = (g: SavedGroup) =>
    Alert.alert(
      t("Ukloniti iz mojih grupa?", "Remove from my groups?"),
      t(
        "Uklanja se samo prečac na ovom mobitelu. Grupa ostaje na serveru.",
        "Only this device shortcut is removed. The group stays on the server.",
      ),
      [
        { text: t("Odustani", "Cancel"), style: "cancel" },
        {
          text: t("Ukloni", "Remove"),
          style: "destructive",
          onPress: () =>
            void run(() =>
              persistGroups(groupsRef.current.filter((x) => x.slug !== g.slug)),
            ),
        },
      ],
    );
  const groupList = (limit?: number) =>
    (limit ? groups.slice(0, limit) : groups).map((g, i) => (
      <Card key={g.slug}>
        <View style={s.row}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              backgroundColor: c.tint,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="groups" color={c.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt bold size={18}>
              {g.name}
            </Txt>
            <Txt muted size={12}>
              {g.code}
              {g.participantName ? ` · ${g.participantName}` : ""}
            </Txt>
          </View>
        </View>
        <Button
          secondary
          label={t("Otvori grupu", "Open group")}
          onPress={() =>
            void run(async () => {
              await load(g.slug);
              setTab("overview");
              nav("group");
            })
          }
        />
        {!limit && (
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => remove(g)}
            style={{
              minHeight: 44,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Txt size={13} muted>
              {t("Ukloni s ovog uređaja", "Remove from this device")}
            </Txt>
          </Pressable>
        )}
      </Card>
    ));
  return (
    <UI.Provider value={{ c, t, busy }}>
      <View
        style={{
          flex: 1,
          backgroundColor: c.bg,
          paddingTop: insets.top,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        }}
      >
        <StatusBar style={isDark ? "light" : "dark"} />
        <View
          style={{
            height: 52,
            paddingHorizontal: 12,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View style={s.row}>
            {!["home", "groups", "settings"].includes(screen) && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("Natrag", "Back")}
                disabled={busy}
                onPress={back}
                style={{ width: 44, height: 44, justifyContent: "center" }}
              >
                <Icon name="back" color={c.ink} />
              </Pressable>
            )}
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                backgroundColor: c.accent,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="check" size={21} color={c.bg} />
            </View>
            <Txt bold size={22}>
              SplitIt
              <Txt bold size={22} style={{ color: c.accent }}>
                {" "}
                .
              </Txt>
            </Txt>
          </View>
          {busy ? (
            <Loading />
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("Postavke", "Settings")}
              disabled={screen === "expense"}
              onPress={() => nav("settings")}
              style={{
                minWidth: 44,
                height: 44,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="user" color={c.accent} />
            </Pressable>
          )}
        </View>
        {error !== "" && (
          <View
            accessibilityRole="alert"
            style={{
              padding: 14,
              marginHorizontal: 12,
              marginBottom: 8,
              borderRadius: 12,
              backgroundColor: isDark ? "#482927" : "#FCE9E7",
            }}
          >
            <Txt style={{ color: c.danger }}>{error}</Txt>
            <Pressable
              accessibilityRole="button"
              onPress={() => setError("")}
              style={{ paddingTop: 10, minHeight: 44 }}
            >
              <Txt bold>{t("Zatvori", "Dismiss")}</Txt>
            </Pressable>
          </View>
        )}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {!ready ? (
            <View style={{ flex: 1, justifyContent: "center" }}>
              <Loading />
            </View>
          ) : (
            <>
              {screen === "home" && (
                <Page>
                  <Heading
                    title={t(
                      "Manje računanja.\nViše druženja.",
                      "Less maths.\nMore good times.",
                    )}
                    subtitle={
                      auth
                        ? `${t("Bok", "Hi")}, ${auth.user.username}.`
                        : t(
                            "Zajednički troškovi, jednostavno podijeljeni.",
                            "Shared expenses, simply split.",
                          )
                    }
                  />
                  <View
                    style={[
                      s.card,
                      {
                        backgroundColor: c.hero,
                        borderColor: c.hero,
                        padding: 18,
                      },
                    ]}
                  >
                    <Txt style={{ color: "#BADEC9" }} size={12} bold>
                      SPLIT IT. ENJOY IT.
                    </Txt>
                    <Txt size={25} bold style={{ color: "white" }}>
                      {t(
                        "Svaki račun\nima svoju ekipu.",
                        "Every bill\nhas its people.",
                      )}
                    </Txt>
                    <Txt style={{ color: "#DAEAE2" }}>
                      {t(
                        "Putovanje, večera ili svakodnevica.\nSvi troškovi na jednom mjestu.",
                        "A trip, dinner or the everyday.\nAll expenses in one place.",
                      )}
                    </Txt>
                    <Button
                      icon="plus"
                      label={t("Izradi novu grupu", "Create a group")}
                      onPress={() => nav("create")}
                    />
                  </View>
                  <Button
                    secondary
                    label={t(
                      "Imam kod · Pridruži se grupi",
                      "I have a code · Join a group",
                    )}
                    onPress={() => nav("join")}
                  />
                  <View style={s.between}>
                    <Txt bold size={21}>
                      {t("Tvoje grupe", "Your groups")}
                    </Txt>
                    <Txt muted>{groups.length}</Txt>
                  </View>
                  {groups.length ? (
                    groupList(3)
                  ) : (
                    <Card>
                      <Txt muted>
                        {t(
                          "Ovdje će se pojaviti grupe koje izradiš ili kojima se pridružiš.",
                          "Groups you create or join will appear here.",
                        )}
                      </Txt>
                    </Card>
                  )}
                </Page>
              )}
              {screen === "groups" && (
                <Page>
                  <Heading
                    title={t("Moje grupe", "My groups")}
                    subtitle={t(
                      "Tvoja putovanja, večere i zajednički planovi.",
                      "Your trips, dinners and shared plans.",
                    )}
                  />
                  <View style={s.row}>
                    <View style={{ flex: 1 }}>
                      <Button
                        icon="plus"
                        label={t("Nova grupa", "New group")}
                        onPress={() => nav("create")}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Button
                        secondary
                        label={t("Pridruži se", "Join")}
                        onPress={() => nav("join")}
                      />
                    </View>
                  </View>
                  {groups.length ? (
                    groupList()
                  ) : (
                    <Card>
                      <Txt muted>
                        {t(
                          "Još nema spremljenih grupa.",
                          "No saved groups yet.",
                        )}
                      </Txt>
                    </Card>
                  )}
                </Page>
              )}
              {screen === "settings" && (
                <Page>
                  <Heading title={t("Tvoj profil", "Your profile")} />
                  <Card>
                    <Txt bold size={20}>
                      {auth?.user.username ?? t("Gost", "Guest")}
                    </Txt>
                    <Txt muted>
                      {t(
                        "Račun koristi isti backend kao web aplikacija.",
                        "Your account uses the same backend as the web app.",
                      )}
                    </Txt>
                    {auth ? (
                      <Button
                        secondary
                        label={t("Odjavi se", "Sign out")}
                        onPress={() =>
                          void run(async () => {
                            await storage.setAuth(null);
                            setToken();
                            setAuth(null);
                            setData(null);
                            nav("home");
                          })
                        }
                      />
                    ) : (
                      <Button
                        label={t(
                          "Prijava / Registracija",
                          "Sign in / Register",
                        )}
                        onPress={() => nav("auth")}
                      />
                    )}
                  </Card>
                  <Card>
                    <Txt bold>{t("Izgled", "Appearance")}</Txt>
                    <View style={s.wrap}>
                      <Chip
                        label={t("Svijetlo", "Light")}
                        selected={!isDark}
                        onPress={() => preferences(locale, false)}
                      />
                      <Chip
                        label={t("Tamno", "Dark")}
                        selected={isDark}
                        onPress={() => preferences(locale, true)}
                      />
                    </View>
                    <Txt bold>{t("Jezik", "Language")}</Txt>
                    <View style={s.wrap}>
                      <Chip
                        label="Hrvatski"
                        selected={locale === "hr"}
                        onPress={() => preferences("hr", isDark)}
                      />
                      <Chip
                        label="English"
                        selected={locale === "en"}
                        onPress={() => preferences("en", isDark)}
                      />
                    </View>
                  </Card>
                  <Card>
                    <Txt muted size={12}>
                      SplitIt Mobile · 1.0.0
                    </Txt>
                    <Txt muted size={12}>
                      {t(
                        "Podatke osvježi povlačenjem zaslona grupe prema dolje.",
                        "Pull down on a group screen to refresh its data.",
                      )}
                    </Txt>
                    {!API_URL && (
                      <Txt>
                        {t(
                          "API još nije konfiguriran.",
                          "API is not configured yet.",
                        )}
                      </Txt>
                    )}
                  </Card>
                </Page>
              )}
              {screen === "auth" && (
                <AuthForm
                  run={run}
                  onAuth={async (a) => {
                    await storage.setAuth(a);
                    setAuth(a);
                    setToken(a.token);
                    setData(null);
                    nav("home");
                  }}
                />
              )}
              {(screen === "create" || screen === "join") && (
                <GroupForm
                  key={`${screen}-${initialCode}`}
                  create={screen === "create"}
                  initialCode={screen === "join" ? initialCode : ""}
                  run={run}
                  open={openGroup}
                  signedIn={!!auth}
                />
              )}
              {screen === "group" && data && (
                <GroupScreen
                  key={data.group.slug}
                  data={data}
                  tab={tab}
                  setTab={setTab}
                  run={run}
                  refresh={refresh}
                  participantId={current?.participantId}
                  choose={async (id) => {
                    const person = data.group.people.find((x) => x.id === id);
                    await persistGroups(
                      groupsRef.current.map((x) =>
                        x.slug === data.group.slug
                          ? {
                              ...x,
                              participantId: id,
                              participantName: person?.name,
                            }
                          : x,
                      ),
                    );
                  }}
                  onAdd={(camera = false) => {
                    setEditingExpense(undefined);
                    setStartCamera(camera);
                    setEditorKey((k) => k + 1);
                    nav("expense");
                  }}
                  onEdit={(expense) => {
                    setEditingExpense(expense);
                    setStartCamera(false);
                    setEditorKey((k) => k + 1);
                    nav("expense");
                  }}
                />
              )}
              {screen === "expense" && data && (
                <ExpenseEditor
                  key={editorKey}
                  expense={editingExpense}
                  startCamera={startCamera}
                  group={data.group}
                  run={run}
                  done={async (draft) => {
                    await refresh();
                    setTab(draft ? "drafts" : "overview");
                    nav("group");
                  }}
                />
              )}
            </>
          )}
        </KeyboardAvoidingView>
        {screen !== "expense" && (
          <View
            style={{
              flexDirection: "row",
              backgroundColor: c.card,
              borderTopWidth: 1,
              borderColor: c.line,
              paddingTop: 6,
              paddingBottom: Math.max(insets.bottom, 8),
            }}
          >
            {(
              [
                ["home", "home", t("Početna", "Home")],
                ["groups", "groups", t("Grupe", "Groups")],
                ["settings", "user", t("Profil", "Profile")],
              ] as [Screen, string, string][]
            ).map(([id, icon, label]) => (
              <Pressable
                key={id}
                accessibilityRole="tab"
                accessibilityState={{ selected: screen === id, disabled: busy }}
                disabled={busy}
                onPress={() => nav(id)}
                style={{
                  flex: 1,
                  minHeight: 50,
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 3,
                }}
              >
                <Icon name={icon} color={screen === id ? c.accent : c.muted} />
                <Txt size={11} bold={screen === id} muted={screen !== id}>
                  {label}
                </Txt>
              </Pressable>
            ))}
          </View>
        )}
        {screen === "expense" && <View style={{ height: insets.bottom }} />}
      </View>
    </UI.Provider>
  );
}
