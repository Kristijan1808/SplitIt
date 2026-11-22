import {choosePhoto} from "./services/receiptPhoto.js";
import SettingsPage from "./pages/SettingsPage.jsx";
import MyGroupsPage from "./pages/MyGroupsPage.jsx";
import HomePage from "./pages/HomePage.jsx";
import { DesktopSidebar } from "./components/DesktopSidebar.jsx";
import translations from "./services/translations.json";
import { Account, Plans } from "./pages/LoginPage.jsx";
import { request } from "./services/api.js";
import { useWindowDimensions } from "react-native-web";
import { syncOutbox } from "./services/outbox.js";
import { IdentityScreen } from "./pages/IdentityPage.jsx";
import { ask } from "./components/WorkflowPanels.jsx";
import { invitationCode } from "./services/domain.mjs";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Modal, ActivityIndicator, AppState, BackHandler, KeyboardAvoidingView, Linking, Platform, Pressable, View, } from "react-native-web";
import { api, setLegacyCredential, setParticipant, WEB_URL, } from "./services/api.js";
import { storage } from "./services/storage.js";
import { UI, light, dark, Button, Card, Icon, Page, Txt, s, } from "./components/ui.jsx";
import { GroupScreen } from "./pages/GroupPage.jsx";
import { ExpenseEditor } from "./pages/GroupAddExpensePage.jsx";
import { GroupForm } from "./pages/GroupForm.jsx";
export default function App() {
    return (<>
      <Main />
    </>);
}
function Main() {
    const insets = { top: 0, bottom: 0, left: 0, right: 0 };
    const width = useWindowDimensions().width, desktop = width >= 1024, grid = width >= 768;
    const [session, setSession] = useState(null), scope = useRef("guest");
    const [notice, notify] = useState(""), [changed, markChanged] = useState(false);
    const [routed, setRouted] = useState(false), readingRoute = useRef(false);
    useEffect(() => {
        if (!notice)
            return;
        const timer = setTimeout(() => notify(""), 4000);
        return () => clearTimeout(timer);
    }, [notice]);
    const [locale, setLocale] = useState("hr");
    const [isDark, setDark] = useState(false);
    const [ready, setReady] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [screen, setScreen] = useState("home");
    const [groupSearch, setGroupSearch] = useState("");
    const [showArchived, setShowArchived] = useState(false);
    const [groups, setGroups] = useState([]);
    const [deviceScope, setDeviceScope] = useState("guest");
    const [data, setData] = useState(null);
    const [tab, setTab] = useState("overview");
    const [editingExpense, setEditingExpense] = useState();
    const [startCamera, setStartCamera] = useState(false);
    const [editorKey, setEditorKey] = useState(0);
    const [initialCode, setInitialCode] = useState("");
    const gate = useRef(false);
    const groupLoads = useRef(new Map());
    const groupsRef = useRef(groups);
    const c = isDark ? dark : light;
    const t = (hr, en) => locale === "hr"
        ? hr
        : locale === "en"
            ? en
            : translations[locale][en] || en;
    const persistGroups = async (next) => {
        await storage.write(scope.current === "guest" ? "groups" : "groups." + scope.current, next);
        groupsRef.current = next;
        setGroups(next);
    };
    const saveGroup = async (g) => {
        const prior = groupsRef.current.find((x) => x.slug === g.slug);
        const id = prior?.participantId;
        const p = g.people.find((x) => x.id === id);
        await persistGroups([
            {
                ...prior,
                archived: g.archived,
                avatar: g.avatar,
                memberCount: g.people.filter((p) => !p.inactive).length,
                slug: g.slug,
                name: g.name,
                code: g.code,
                participantId: p?.id,
                participantName: p?.name,
            },
            ...groupsRef.current.filter((x) => x.slug !== g.slug),
        ]);
    };
    const run = useCallback(async (fn) => {
        if (gate.current)
            return false;
        gate.current = true;
        setBusy(true);
        setError("");
        try {
            await fn();
            return true;
        }
        catch (e) {
            setError(e instanceof Error ? e.message : String(e));
            return false;
        }
        finally {
            gate.current = false;
            setBusy(false);
        }
    }, []);
    async function load(slug, ensureFresh = false) {
        const existing = groupLoads.current.get(slug);
        if (existing) {
            try {
                const snapshot = await existing;
                if(!ensureFresh)return snapshot;
            }
            catch (error) {
                if (!ensureFresh)
                    throw error;
            }
            if (ensureFresh)
                await load(slug);
            return;
        }
        let request;
        request = (async () => {
            try {
                const { group, drafts, settlements, history, workflow } = await api.snapshot(slug);
                await saveGroup(group);
                const snapshot = { group, drafts, settlements, history, workflow };
                await storage.write(`snapshot.${deviceScope}.${slug}`, snapshot);
                const mine = workflow.people.find((p) => p.mine && !p.inactive);
                await persistGroups(groupsRef.current.map((x) => x.slug === slug
                    ? {
                        ...x,
                        participantId: mine?.id,
                        participantName: mine?.name,
                        currency: group.currency || "EUR",
                        balance: settlements.balances.find((p) => p.id === mine?.id)
                            ?.balance,
                        draftCount: group.expenses.filter((e) => e.allocationComplete === false || e.paymentIncomplete).length,
                    }
                    : x));
                setParticipant(mine?.id);
                setData(snapshot);
                markChanged(false);
                return snapshot;
            }
            catch (error) {
                if (error instanceof Error &&
                    /network|fetch|timeout|veza|isteklo/i.test(error.message) &&
                    !error.status) {
                    const cached = await storage.read(`snapshot.${deviceScope}.${slug}`, null);
                    if (cached) {
                        setParticipant(cached.workflow.people.find((p) => p.mine && !p.inactive)?.id);
                        const snapshot={ ...cached, offline:true };setData(snapshot);return snapshot;
                    }
                }
                throw error;
            }
        })().finally(() => {
            if (groupLoads.current.get(slug) === request)
                groupLoads.current.delete(slug);
        });
        groupLoads.current.set(slug, request);
        return await request;
    }
    async function openGroup(g) {
        await load(g.slug);
        setTab("overview");
        setScreen("group");
    }
    async function refresh() {
        if (data)
            await load(data.group.slug, true);
    }
    function nav(next) {
        setError("");
        setScreen(next);
    }
    function back() {
        if (gate.current)
            return;
        if (screen === "expense") {
            nav("group");
        }
        else
            nav("groups");
    }
    useEffect(() => {
        void run(async () => {
            const [a, gs, prefs] = await Promise.all([
                storage.legacySession(),
                storage.read("groups", []),
                storage.read("prefs", { locale: "hr", dark: false }),
            ]);
            setDeviceScope(a?.user.id || "guest");
            setLegacyCredential(a?.token);
            scope.current = a?.user.id || "guest";
            setSession(a);
            const entries = a
                ? await storage.read("groups." + a.user.id, gs)
                : gs;
            groupsRef.current = entries;
            setGroups(entries);
            // Keep the initial Home screen; invitation links are handled separately.
            setLocale(["de", "ja", "en"].includes(prefs.locale)
                ? prefs.locale
                : "hr");
            setDark(!!prefs.dark);
        }).then(() => setReady(true));
    }, [run]);
    useEffect(() => {
        const sub = BackHandler.addEventListener("hardwareBackPress", () => {
            if (screen === "groups")
                return busy;
            back();
            return true;
        });
        return () => sub.remove();
    }, [screen, busy, locale, data]);
    useEffect(() => {
        if (!ready)
            return;
        const handle = (url) => {
            const code = invitationCode(url, WEB_URL);
            if (code) {
                setInitialCode(code);
                setScreen("join");
            }
        };
        void Linking.getInitialURL().then((url) => {
            if (url)
                handle(url);
        });
        const sub = Linking.addEventListener("url", ({ url }) => handle(url));
        return () => sub.remove();
    }, [ready]);
    // Refresh an open group after returning from the web/camera/background. Never clobber an editor.
    useEffect(() => {
        if (screen !== "group" || !data)
            return;
        const slug = data.group.slug;
        const sub = AppState.addEventListener("change", (state) => {
            if (state === "active")
                void run(() => load(slug));
        });
        return () => sub.remove();
    }, [screen, data?.group.slug, run]);
    const current = groups.find((x) => x.slug === data?.group.slug);
    useEffect(() => setParticipant(current?.participantId), [current?.participantId]);
    const preferences = (language, darkMode) => void run(async () => {
        await storage.write("prefs", { locale: language, dark: darkMode });
        setLocale(language);
        setDark(darkMode);
    });
    async function changeSession(next) {
        await storage.setSession(next);
        setLegacyCredential(next?.token);
        scope.current = next?.user.id || "guest";
        setDeviceScope(scope.current);
        setParticipant(undefined);
        setData(null);
        setSession(next);
        const list = await storage.read(next ? "groups." + next.user.id : "groups", []);
        groupsRef.current = list;
        setGroups(list);
        notify(next
            ? t("Prijava je uspjela.", "Signed in.")
            : t("Odjavljen/a si.", "Signed out."));
    }
    useEffect(() => {
        if (!ready || !session || screen !== "groups")
            return;
        let active = true;
        void request("/groups/mine")
            .then(async (list) => {
            if (!active)
                return;
            const local = groupsRef.current;
            await persistGroups([
                ...list.map((g) => ({
                    ...local.find((x) => x.slug === g.slug),
                    ...g,
                })),
                ...local.filter((x) => !list.some((g) => g.slug === x.slug)),
            ]);
        })
            .catch((e) => {
            if (active)
                setError(e.message);
        });
        return () => {
            active = false;
        };
    }, [ready, screen, session?.user.id]);
    const routeLoad = useRef(load);
    routeLoad.current = load;
    useEffect(() => {
        if (Platform.OS !== "web" || !ready)
            return;
        const read = async () => {
            readingRoute.current = true;
            setRouted(false);
            try {
                const path = window.location.pathname.replace(/\/$/, "") || "/", match = path.match(/^\/g\/([^/]+)(\/add-expense)?$/);
                if (match) {
                    let snapshot;const ok = await run(async()=>{snapshot=await routeLoad.current(decodeURIComponent(match[1]));});
                    const editId=match[2]&&new URLSearchParams(location.search).get("edit");
                    const edit=editId&&snapshot?.group.expenses.find(e=>e.id===editId&&e.canManage);
                    setEditingExpense(edit||undefined);
                    setStartCamera(false);
                    setScreen(ok ? (match[2]&&(!editId||edit) ? "expense" : "group") : "groups");
                }
                else {
                    const routes = {
                        "/": "home",
                        "/my-groups": "groups",
                        "/settings": "settings",
                        "/join": "join",
                        "/new": "create",
                        "/login": "account",
                        "/subscriptions": "plans",
                    };
                    setScreen(routes[path] || "home");
                    if (path === "/join")
                        setInitialCode(new URLSearchParams(window.location.search).get("code") || "");
                }
            }
            finally {
                readingRoute.current = false;
                setRouted(true);
            }
        };
        void read();
        window.addEventListener("popstate", read);
        return () => window.removeEventListener("popstate", read);
    }, [ready]);
    useEffect(() => {
        if (Platform.OS !== "web" || !routed || readingRoute.current)
            return;
        const paths = {
            home: "/",
            create: "/new",
            join: "/join",
            groups: "/my-groups",
            account: "/login",
            plans: "/subscriptions",
            settings: "/settings",
        };
        const path = paths[screen] ||
            (data
                ? "/g/" +
                    encodeURIComponent(data.group.slug) +
                    (screen === "expense" ? "/add-expense" : "")
                : "/");
        const editSearch=screen==="expense"&&editingExpense?"?edit="+encodeURIComponent(editingExpense.id):"";
        if (window.location.pathname !== path || (screen==="expense" && window.location.search!==editSearch))
            window.history.pushState(null, "", path +
                (screen === "join" && initialCode
                    ? "?code=" + encodeURIComponent(initialCode)
                    : editSearch));
    }, [routed, screen, data?.group.slug, initialCode,editingExpense?.id]);
    useEffect(() => {
        if (!data || data.offline || screen !== "group")
            return;
        let alive = true, busy = false, last;
        const poll = async () => {
            if (busy || AppState.currentState !== "active")
                return;
            busy = true;
            try {
                const r = await request("/groups/" + encodeURIComponent(data.group.slug) + "/last-changed-at");
                if (alive) {
                    if (last && last !== r.lastChangedAt)
                        markChanged(true);
                    last = r.lastChangedAt;
                }
            }
            catch {
            }
            finally {
                busy = false;
            }
        };
        void poll();
        const timer = setInterval(poll, 15000);
        return () => {
            alive = false;
            clearInterval(timer);
        };
    }, [screen, data]);
    const remove = (g) => ask(t("Ukloniti iz mojih grupa?", "Remove from my groups?"), t("Uklanja se samo prečac na ovom uređaju. Grupa i računi ostaju sačuvani.", "Only this device shortcut is removed. The group and bills are kept."), () => void run(() => persistGroups(groupsRef.current.filter((x) => x.slug !== g.slug))));
    useEffect(() => {
        if (!ready)
            return;
        let active = true;
        const tick = async () => {
            if (AppState.currentState !== "active")
                return;
            try {
                const sent = await syncOutbox();
                if (active && sent && screen === "group" && data)
                    await load(data.group.slug);
            }
            catch {
                /* Queue remains stored; panel displays permanent errors. */
            }
        };
        void tick();
        const timer = setInterval(tick, 20000);
        const subscription = AppState.addEventListener("change", (state) => {
            if (state === "active")
                void tick();
        });
        return () => {
            active = false;
            clearInterval(timer);
            subscription.remove();
        };
    }, [ready, deviceScope, screen, data?.group.slug]);
    const needsIdentity = (screen === "group" || screen === "expense") &&
        !!data &&
        !data.offline &&
        !data.workflow.people.some((p) => p.mine && !p.inactive);
    const groupList = (limit) => (limit
        ? groups.filter((g) => !g.archived).slice(0, limit)
        : groups
            .filter((g) => !!g.archived === showArchived &&
            g.name.toLowerCase().includes(groupSearch.toLowerCase()))
            .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned))).map((g, i) => (<Card key={g.slug} style={{ width: grid && !limit ? "48%" : "100%", ...(limit ? { paddingHorizontal: 10, paddingVertical: 4 } : {}) }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${t("Otvori grupu", "Open group")} ${g.name}`} disabled={busy} onPress={() => void run(async () => {
            await load(g.slug);
            setTab("overview");
            nav("group");
        })} style={{ gap: 6, minHeight: limit ? 48 : 72, justifyContent: "center" }}>
          <View style={s.row}>
            <View style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: c.tint,
            alignItems: "center",
            justifyContent: "center",
        }}>
              {g.avatar ? <Txt size={23}>{g.avatar}</Txt> : <Icon name="groups" size={22} color={c.accent}/>}
            </View>
            <View style={{ flex: 1 }}>
              <Txt bold size={18}>
                {g.name}
              </Txt>
              <Txt muted size={12}>
                {limit ? (g.memberCount ?? "—") + " " + t("članova", "members") : g.code}
                {!limit && g.participantName ? ` · ${g.participantName}` : ""}
              </Txt>
            </View>
            {!!limit && <Txt size={24} muted>›</Txt>}
          </View>
          {!limit && <View style={s.between}>
            <Txt muted size={12}>
              {g.memberCount ?? "—"} {t("članova", "members")} ·{" "}
              {g.draftCount ?? 0} {t("čeka podjelu", "awaiting split")}
            </Txt>
            <Txt bold style={{ color: (g.balance ?? 0) < 0 ? c.debt : c.accent }}>
              {g.balance === undefined
                ? "—"
                : `${g.balance > 0 ? "+" : ""}${g.balance.toFixed(2)} ${g.currency || "EUR"}`}
            </Txt>
          </View>}
        </Pressable>
        {!limit && (<Button secondary label={g.pinned
                ? t("Makni iz omiljenih", "Unpin")
                : t("Prikvači grupu", "Pin group")} onPress={() => void run(() => persistGroups(groupsRef.current.map((x) => x.slug === g.slug ? { ...x, pinned: !x.pinned } : x)))}/>)}
        {!limit && (<Pressable accessibilityRole="button" disabled={busy} onPress={() => remove(g)} style={{
                minHeight: 44,
                justifyContent: "center",
                alignItems: "center",
            }}>
            <Txt size={13} muted>
              {t("Ukloni s ovog uređaja", "Remove from this device")}
            </Txt>
          </Pressable>)}
      </Card>));
    return (<UI.Provider value={{ c, t, busy }}>
      <View style={{
            flex: 1,
            backgroundColor: c.bg,
            paddingTop: insets.top,
            paddingLeft: desktop ? 240 : insets.left,
            paddingRight: insets.right,
        }}>
        
        <View style={{
            height: 52,
            paddingHorizontal: 40,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
        }}>
          <View style={s.row}>
            {!["home", "groups", "settings"].includes(screen) && (<Pressable accessibilityRole="button" accessibilityLabel={t("Natrag", "Back")} disabled={busy} onPress={back} style={{ width: 44, height: 44, justifyContent: "center" }}>
                <Icon name="back" color={c.ink}/>
              </Pressable>)}
            <View style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            backgroundColor: c.accent,
            alignItems: "center",
            justifyContent: "center",
        }}>
              <Icon name="check" size={21} color={c.bg}/>
            </View>
            <Txt bold size={22}>
              SplitIt
              <Txt bold size={22} style={{ color: c.accent }}>
                {" "}
                .
              </Txt>
            </Txt>
          </View>
          {<Pressable accessibilityRole="button" accessibilityLabel={t("Postavke", "Settings")} disabled={busy || screen === "expense"} onPress={() => nav("settings")} style={{
                minWidth: 44,
                height: 44,
                alignItems: "center",
                justifyContent: "center",
            }}>
              <Icon name="settings" color={c.accent}/>
            </Pressable>}
        </View>
        {!!notice && (<View accessibilityLiveRegion="polite" style={{
                padding: 10,
                marginHorizontal: 12,
                backgroundColor: c.tint,
                borderRadius: 12,
            }}>
            <Txt>{notice}</Txt>
          </View>)}
        {changed && screen === "group" && (<Card>
            <Txt>
              {t("Netko je ažurirao grupu.", "Someone updated this group.")}
            </Txt>
            <Button compact secondary label={t("Učitaj promjene", "Load changes")} onPress={() => void run(refresh)}/>
          </Card>)}
        {error !== "" && (<View accessibilityRole="alert" style={{
                padding: 14,
                marginHorizontal: 12,
                marginBottom: 8,
                borderRadius: 12,
                backgroundColor: isDark ? "#482927" : "#FCE9E7",
            }}>
            <Txt style={{ color: c.danger }}>{error}</Txt>
            <Pressable accessibilityRole="button" onPress={() => setError("")} style={{ paddingTop: 10, minHeight: 44 }}>
              <Txt bold>{t("Zatvori", "Dismiss")}</Txt>
            </Pressable>
          </View>)}
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          {!ready ? (<View style={{ flex: 1 }}/>) : (<>
              {screen === "account" && (<Account session={session} change={changeSession} run={run}/>)}
              {screen === "plans" && <Plans onHome={() => nav("home")}/>}
              {screen === "home" && <HomePage {...{ t, nav, groups, groupList }}/>}
              {screen === "groups" && <MyGroupsPage {...{ t, nav, groups, groupList, groupSearch, setGroupSearch, showArchived, setShowArchived, grid }}/>}
              {screen === "settings" && <SettingsPage {...{ t, session, nav, isDark, locale, preferences }}/>}
              {(screen === "create" || screen === "join") && (<GroupForm key={`${screen}-${initialCode}`} signedIn={!!session} create={screen === "create"} initialCode={screen === "join" ? initialCode : ""} run={run} open={openGroup}/>)}
              {needsIdentity &&
                data?.group.accessType === "REGISTERED_ONLY" && (<Page>
                    <Card>
                      <Txt bold>
                        {t("Sudionik povezan s tvojim računom nije aktivan.", "The participant linked to your account is unavailable.")}
                      </Txt>
                      <Txt>
                        {t("Ako je članstvo deaktivirano, obrati se administratoru grupe.", "If your membership is inactive, contact the group administrator.")}
                      </Txt>
                      <Button secondary label={t("Moje grupe", "My groups")} onPress={() => nav("groups")}/>
                    </Card>
                  </Page>)}
              {needsIdentity &&
                data &&
                data.group.accessType !== "REGISTERED_ONLY" && (<IdentityScreen key={data.group.slug} group={data.group} workflow={data.workflow} run={run} leave={() => nav("groups")} done={async (id) => {
                    setParticipant(id);
                    await refresh();
                    setTab("overview");
                }}/>)}
              {screen === "group" && data && !needsIdentity && (<GroupScreen key={data.group.slug} data={data} tab={tab} setTab={setTab} run={run} refresh={refresh} participantId={current?.participantId} choose={async (id) => {
                    await api.claim(data.group.slug, id);
                    setParticipant(id);
                    const person = data.group.people.find((x) => x.id === id);
                    await persistGroups(groupsRef.current.map((x) => x.slug === data.group.slug
                        ? {
                            ...x,
                            participantId: id,
                            participantName: person?.name,
                        }
                        : x));
                    await refresh();
                }} onAdd={(camera = false) => {
                    setEditingExpense(undefined);
                    setStartCamera(camera && !data.offline && navigator.onLine!==false ? choosePhoto(true).then(image=>({image}),error=>({error})) : camera);
                    setEditorKey((k) => k + 1);
                    nav("expense");
                }} onEdit={(expense) => {
                    setEditingExpense(expense);
                    setStartCamera(false);
                    setEditorKey((k) => k + 1);
                    nav("expense");
                }}/>)}
              {screen === "expense" && data && !needsIdentity && (<ExpenseEditor key={editorKey} expense={editingExpense} participantId={current?.participantId} offline={!!data.offline} startCamera={startCamera} group={{
                    ...data.group,
                    people: editingExpense
                        ? data.group.people
                        : data.group.people.filter((p) => !p.inactive),
                    locked: data.group.locked ||
                        !!data.group.archived ||
                        (!!editingExpense && !!data.offline),
                }} run={run} done={async (queued) => {
                    if (!queued)
                        await refresh();
                    notify(queued
                        ? t("Račun čeka slanje.", "Expense queued.")
                        : t("Račun je spremljen.", "Expense saved."));
                    setTab("overview");
                    nav("group");
                }}/>)}
            </>)}
        </KeyboardAvoidingView>
        {desktop && !needsIdentity && (<DesktopSidebar screen={screen} navigate={nav}/>)}
        {!desktop && screen !== "expense" && !needsIdentity && (<View style={{
                flexDirection: desktop ? "column" : "row",
                ...(desktop
                    ? {
                        position: "absolute",
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: 188,
                        borderRightWidth: 1,
                        paddingHorizontal: 10,
                        gap: 10,
                    }
                    : {}),
                backgroundColor: c.card,
                borderTopWidth: 1,
                borderColor: c.line,
                paddingTop: 6,
                paddingBottom: Math.max(insets.bottom, 8),
            }}>
            {[
                ["home", "home", t("Početna", "Home")],
                ["groups", "groups", t("Grupe", "Groups")],
                ["settings", "settings", t("Postavke", "Settings")],
            ].map(([id, icon, label]) => (<Pressable key={id} accessibilityRole="tab" accessibilityState={{ selected: screen === id, disabled: busy }} disabled={busy} onPress={() => nav(id)} style={{
                    flex: desktop ? undefined : 1,
                    flexDirection: desktop ? "row" : "column",
                    minHeight: 50,
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 3,
                }}>
                <Icon name={icon} color={screen === id ? c.accent : c.muted}/>
                <Txt size={desktop ? 15 : 11} bold={screen === id} muted={screen !== id}>
                  {label}
                </Txt>
              </Pressable>))}
          </View>)}
        {(screen === "expense" || needsIdentity) && (<View style={{ height: insets.bottom }}/>)}
        <Modal visible={busy || !ready} transparent animationType="fade" statusBarTranslucent onRequestClose={() => { }}>
          <View style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0,0,0,0.18)",
            padding: 24,
        }}>
            <View accessible accessibilityRole="progressbar" accessibilityLabel={t("Učitavanje…", "Loading…")} accessibilityState={{ busy: true }} accessibilityLiveRegion="polite" style={{
            alignItems: "center",
            justifyContent: "center",
            gap: 14,
            minWidth: 180,
            paddingHorizontal: 28,
            paddingVertical: 24,
            borderRadius: 20,
            backgroundColor: c.card,
            borderWidth: 1,
            borderColor: c.line,
        }}>
              <ActivityIndicator size="large" color={c.accent}/>
              <Txt bold size={16}>
                {t("Učitavanje…", "Loading…")}
              </Txt>
            </View>
          </View>
        </Modal>
      </View>
    </UI.Provider>);
}
