import { ItemCheck } from "./ItemCheck";
import React, { useState, useEffect } from "react";
import { Alert, View, Share, Pressable } from "react-native";
import * as Clipboard from "expo-clipboard";
import { api, WEB_URL } from "./api";
import {
  Button,
  Card,
  Chip,
  Field,
  Heading,
  Page,
  Txt,
  useUI,
  s,
  Icon,
} from "./ui";
import { Wheel } from "./Wheel";
import { ExpenseCard } from "./ExpenseCard";
import { historyDetails } from "./domain.mjs";
import { cents, draftReadiness } from "./domain.mjs";
import type {
  Expense,
  Group,
  DraftExpense,
  SettlementResult,
  HistoryItem,
} from "./types";
export type Snapshot = {
  group: Group;
  drafts: DraftExpense[];
  settlements: SettlementResult;
  history: HistoryItem[];
};
export type Run = (f: () => Promise<void>) => Promise<boolean>;
export function GroupScreen({
  data,
  tab,
  setTab,
  run,
  refresh,
  participantId,
  choose,
  onAdd,
  onEdit,
}: {
  data: Snapshot;
  tab: string;
  setTab: (s: string) => void;
  run: Run;
  refresh: () => Promise<void>;
  participantId?: string;
  choose: (id: string) => Promise<void>;
  onAdd: (camera?: boolean) => void;
  onEdit: (expense: Expense) => void;
}) {
  const { c, t, busy } = useUI();
  const { group: g, drafts, settlements, history } = data;
  const [name, setName] = useState("");
  const [rename, setRename] = useState(g.name);
  const [editPerson, setEditPerson] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [wheel, setWheel] = useState<{
    draft: DraftExpense;
    itemId?: string;
  } | null>(null);
  const [payerEdit, setPayerEdit] = useState<{
    id: string;
    values: { personId: string; amount: string }[];
  } | null>(null);
  const [manageDraft, setManageDraft] = useState<string | null>(null);
  const [allDebts, setAllDebts] = useState(false);
  const [selectedDraft, setSelectedDraft] = useState<string | null>(null);
  useEffect(() => {
    if (selectedDraft && !drafts.some((d) => d.id === selectedDraft))
      setSelectedDraft(null);
  }, [drafts, selectedDraft]);
  const outgoing = settlements.settlements.filter(
    (x) => x.from === participantId,
  );
  const incoming = settlements.settlements.filter(
    (x) => x.to === participantId,
  );
  const me = g.people.find((p) => p.id === participantId);
  const balance = settlements.balances.find((p) => p.id === participantId);
  const total = g.expenses.reduce((a, e) => a + Number(e.totalAmount), 0);
  const person = (id: string) => g.people.find((p) => p.id === id)?.name ?? id;
  const money = (n: number | string) => `${Number(n).toFixed(2)} €`;
  const date = (value: string) =>
    new Date(value).toLocaleString(t("hr-HR", "en-GB"));
  const act = (f: () => Promise<unknown>) =>
    run(async () => {
      await f();
      await refresh();
    });
  function confirmDelete(title: string, fn: () => Promise<unknown>) {
    Alert.alert(
      title,
      t(
        "Ova promjena vrijedi i na webu.",
        "This change also applies on the web.",
      ),
      [
        { text: t("Odustani", "Cancel"), style: "cancel" },
        {
          text: t("Obriši", "Delete"),
          style: "destructive",
          onPress: () => void act(fn),
        },
      ],
    );
  }
  async function share() {
    await Share.share({
      message: `${g.name}\n${t("Kod grupe", "Group code")}: ${g.code}${WEB_URL && !WEB_URL.includes("YOUR-") ? `\n${WEB_URL}/join?code=${g.code}` : ""}\nsplitit://join?code=${g.code}`,
    });
  }
  async function applyRandom(ids: string[]) {
    if (!wheel) return;
    const target = wheel;
    setWheel(null);
    await act(async () => {
      for (const item of target.draft.items.filter(
        (i) => !target.itemId || i.id === target.itemId,
      ))
        await api.shares(g.slug, target.draft.id, item.id, ids);
    });
  }
  return (
    <View style={{ flex: 1 }}>
      <Page refresh={() => void run(refresh)}>
        <View
          style={{
            backgroundColor: c.hero,
            borderRadius: 20,
            padding: 14,
            gap: 12,
          }}
        >
          <View style={s.row}>
            <View
              accessibilityLabel={t(
                "Mjesto za sliku grupe",
                "Group image placeholder",
              )}
              style={{
                width: 44,
                height: 44,
                borderRadius: 18,
                backgroundColor: "#FFFFFF20",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="groups" color="#FFFFFF" size={30} />
            </View>
            <Txt size={22} bold style={{ color: "#FFFFFF", flex: 1 }}>
              {g.name}
            </Txt>
          </View>
          <View style={s.wrap}>
            <View style={pill}>
              <Txt size={12} bold style={white}>
                {g.code}
              </Txt>
            </View>
            <View style={[pill, s.row]}>
              <Icon name="groups" size={15} color="#FFFFFF" />
              <Txt size={12} style={white}>
                {g.people.length} {t("sudionika", "people")}
              </Txt>
            </View>
            {g.locked && (
              <View style={pill}>
                <Txt size={12} style={white}>
                  {t("Zaključano", "Locked")}
                </Txt>
              </View>
            )}
          </View>
        </View>
        <View
          style={{ flexDirection: "row", gap: 4 }}
          accessibilityRole="tablist"
        >
          {[
            ["overview", t("Troškovi", "Expenses")],
            ["debts", t("Dugovanja", "Balances")],
            ["people", t("Sudionici", "People")],
            ["history", t("Povijest", "Activity")],
          ].map(([id, label]) => (
            <Pressable
              key={id}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === id, disabled: busy }}
              disabled={busy}
              onPress={() => setTab(id)}
              style={{
                flex: 1,
                minHeight: 44,
                justifyContent: "center",
                alignItems: "center",
                borderBottomWidth: 2,
                borderBottomColor: tab === id ? c.accent : c.line,
              }}
            >
              <Txt
                size={12}
                bold={tab === id}
                style={{ color: tab === id ? c.accent : c.muted }}
              >
                {label}
              </Txt>
            </Pressable>
          ))}
        </View>
        {tab === "overview" && (
          <>
            <Card style={{ gap: 6 }}>
              <View style={s.between}>
                <Txt muted size={13}>
                  {t("Ukupni troškovi grupe", "Total group expenses")}
                </Txt>
                <Txt size={22} bold>
                  {money(total)}
                </Txt>
              </View>
              <View style={{ height: 1, backgroundColor: c.line }} />
              <View style={s.between}>
                <Txt bold size={12} style={{ flex: 1 }}>
                  {t("MOJ SALDO", "MY BALANCE")}
                  {me ? ` · ${me.name}` : ""}
                </Txt>
                {me && (
                  <Txt
                    bold
                    size={28}
                    style={{
                      color: (balance?.balance ?? 0) < 0 ? c.debt : c.accent,
                    }}
                  >
                    {(balance?.balance ?? 0) > 0 ? "+" : ""}
                    {money(balance?.balance ?? 0)}
                  </Txt>
                )}
              </View>
              {me ? (
                <>
                  {outgoing.map((x, i) => (
                    <Txt key={"out" + i} size={13}>
                      {t("Duguješ", "You owe")} {x.toName}{" "}
                      <Txt bold style={{ color: c.danger }}>
                        {money(x.amount)}
                      </Txt>
                    </Txt>
                  ))}
                  {incoming.map((x, i) => (
                    <Txt key={"in" + i} size={13}>
                      {x.fromName} {t("ti duguje", "owes you")}{" "}
                      <Txt bold style={{ color: c.accent }}>
                        {money(x.amount)}
                      </Txt>
                    </Txt>
                  ))}
                  {!outgoing.length && !incoming.length && (
                    <Txt muted>
                      {t("Sve je poravnato.", "You are all settled up.")}
                    </Txt>
                  )}
                </>
              ) : (
                <Button
                  secondary
                  label={t(
                    "Odaberi tko si za svoj saldo",
                    "Choose your identity to see your balance",
                  )}
                  onPress={() => setTab("people")}
                />
              )}
            </Card>
            <View style={s.between}>
              <Txt size={21} bold>
                {t("Troškovi grupe", "Group expenses")}
              </Txt>
              <Txt muted>{g.expenses.length}</Txt>
            </View>
            {!g.expenses.length && (
              <Card>
                <Txt muted>
                  {t(
                    "Još nema računa. Dodaj prvi trošak ili fotografiraj račun.",
                    "No bills yet. Add an expense or take a receipt photo.",
                  )}
                </Txt>
              </Card>
            )}
            {g.expenses.map((e) => (
              <ExpenseCard
                key={e.id}
                expense={e}
                people={g.people}
                personId={participantId}
                expanded={expanded.includes(e.id)}
                onPress={() =>
                  setExpanded(
                    expanded.includes(e.id)
                      ? expanded.filter((id) => id !== e.id)
                      : [...expanded, e.id],
                  )
                }
              >
                <Txt muted size={12}>
                  {t(
                    "Označi samo svoje stavke. Promjena se sprema odmah i ponovno dijeli stavku jednako.",
                    "Select only your items. Changes save immediately and split the item equally again.",
                  )}
                </Txt>
                {!me && (
                  <Button
                    secondary
                    label={t("Odaberi tko si", "Choose your identity")}
                    onPress={() => setTab("people")}
                  />
                )}
                {e.legacyOwner && (
                  <Txt muted size={12}>
                    {t(
                      "Autor starog računa nije zabilježen. Dostupno je označavanje vlastitih stavki.",
                      "The author of this older bill was not recorded. You can update your own item selections.",
                    )}
                  </Txt>
                )}
                {[...e.items]
                  .sort((a, b) => a.ordinalNumber - b.ordinalNumber)
                  .map((item) => (
                    <View key={item.id} style={{ gap: 4 }}>
                      <ItemCheck
                        name={item.name}
                        price={Number(item.price)}
                        checked={
                          !!me && item.shares.some((x) => x.personId === me.id)
                        }
                        disabled={g.locked || !me}
                        onPress={() =>
                          void act(() =>
                            api.ownItem(
                              g.slug,
                              e.id,
                              item.id,
                              !item.shares.some((x) => x.personId === me?.id),
                              true,
                            ),
                          )
                        }
                      />
                      <Txt muted size={12}>
                        {item.shares
                          .map(
                            (x) => `${person(x.personId)} ${money(x.amount)}`,
                          )
                          .join(" · ")}
                      </Txt>
                    </View>
                  ))}
                <Txt bold>{t("Platili", "Paid by")}</Txt>
                {e.payers.map((p) => (
                  <View key={p.id} style={s.between}>
                    <Txt>{person(p.personId)}</Txt>
                    <Txt>{money(p.amount)}</Txt>
                  </View>
                ))}
                {e.canManage && (
                  <View style={s.row}>
                    <View style={{ flex: 1 }}>
                      <Button
                        secondary
                        label={t("Uredi račun", "Edit bill")}
                        disabled={g.locked}
                        onPress={() => onEdit(e)}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Button
                        danger
                        label={t("Obriši", "Delete")}
                        disabled={g.locked}
                        onPress={() =>
                          confirmDelete(
                            t("Obrisati ovaj račun?", "Delete this bill?"),
                            () => api.deleteExpense(g.slug, e.id),
                          )
                        }
                      />
                    </View>
                  </View>
                )}
              </ExpenseCard>
            ))}
          </>
        )}
        {tab === "debts" && <>
          <Card>
            <View style={s.between}>
              <View style={{ flex: 1 }}><Txt size={20} bold>{t("Moje dugovanje", "My balance")}</Txt><Txt muted size={13}>{me?.name || t("Odaberi svoj profil", "Choose your profile")}</Txt></View>
              {me && <Txt size={22} bold style={{ color: Number(balance?.balance ?? 0) < 0 ? c.debt : c.accent }}>{Number(balance?.balance ?? 0) > 0 ? "+" : ""}{money(balance?.balance ?? 0)}</Txt>}
            </View>
            {!me ? <Button secondary label={t("Odaberi tko si", "Choose who you are")} onPress={() => setTab("people")} /> : <>
              {!outgoing.length && !incoming.length && <Txt muted>{t("Sve je podmireno. Nemaš dugovanja ni potraživanja.", "All settled. You neither owe nor are owed anything.")}</Txt>}
              {outgoing.map((x, i) => <View key={`out${i}`} style={[s.between, { padding: 10, borderRadius: 12, backgroundColor: c.debtTint }]}>
                <View style={{ flex: 1 }}><Txt muted size={12}>{t("Duguješ", "You owe")}</Txt><Txt bold>{x.toName}</Txt></View><Txt bold style={{ color: c.debt }}>{money(x.amount)}</Txt>
              </View>)}
              {incoming.map((x, i) => <View key={`in${i}`} style={[s.between, { padding: 10, borderRadius: 12, backgroundColor: c.tint }]}>
                <View style={{ flex: 1 }}><Txt muted size={12}>{t("Duguje ti", "Owes you")}</Txt><Txt bold>{x.fromName}</Txt></View><Txt bold style={{ color: c.accent }}>{money(x.amount)}</Txt>
              </View>)}
            </>}
          </Card>
          <Card>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: allDebts }} onPress={() => setAllDebts(!allDebts)} style={[s.between, { minHeight: 44 }]}>
              <View style={{ flex: 1 }}><Txt bold size={18}>{t("Tko kome duguje", "Who owes whom")}</Txt><Txt muted size={12}>{t("Pregled cijele grupe", "Whole group overview")}</Txt></View><Txt style={{ color: c.info }}>{allDebts ? "⌃" : "⌄"}</Txt>
            </Pressable>
            {allDebts && (settlements.settlements.length ? settlements.settlements.map((x, i) => <View key={i} style={[s.between, { minHeight: 48, borderTopWidth: 1, borderColor: c.line, paddingTop: 8 }]}>
              <Txt style={{ flex: 1 }}>{x.fromName} → {x.toName}</Txt><Txt bold style={{ color: c.info }}>{money(x.amount)}</Txt>
            </View>) : <Txt muted>{t("Grupa je poravnata.", "The group is settled.")}</Txt>)}
          </Card>
        </>}
        {tab === "people" && (
          <>
            <Card>
              <Txt bold size={18}>
                {t("Pozovi ekipu", "Invite your people")}
              </Txt>
              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <Button
                    secondary
                    icon="share"
                    label={t("Pozovi", "Invite")}
                    onPress={() => void run(share)}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    secondary
                    label={t("Kopiraj kod", "Copy code")}
                    onPress={() =>
                      void run(async () => {
                        await Clipboard.setStringAsync(g.code);
                        Alert.alert(t("Kod kopiran", "Code copied"));
                      })
                    }
                  />
                </View>
              </View>
            </Card>
            <Card>
              <Txt bold size={18}>
                {t("Tko si ti?", "Who are you?")}
              </Txt>
              <View style={s.wrap}>
                {g.people.map((p) => (
                  <Chip
                    key={p.id}
                    selected={participantId === p.id}
                    label={p.name}
                    onPress={() => void run(() => choose(p.id))}
                  />
                ))}
              </View>
            </Card>
            <Card>
              <Field
                label={
                  editPerson
                    ? t("Uredi ime sudionika", "Edit participant name")
                    : t("Novi sudionik", "New participant")
                }
                value={name}
                onChange={setName}
                maxLength={60}
              />
              <Button
                label={
                  editPerson
                    ? t("Spremi ime", "Save name")
                    : t("Dodaj sudionika", "Add participant")
                }
                disabled={g.locked || !name.trim()}
                onPress={() =>
                  void act(async () => {
                    await api.person(
                      g.slug,
                      name.trim(),
                      editPerson ?? undefined,
                    );
                    setName("");
                    setEditPerson(null);
                  })
                }
              />
              {editPerson && (
                <Button
                  secondary
                  label={t("Odustani", "Cancel")}
                  onPress={() => {
                    setEditPerson(null);
                    setName("");
                  }}
                />
              )}
            </Card>
            {g.people.map((p) => (
              <Card key={p.id}>
                <Txt bold>
                  {p.name}
                  {p.id === participantId ? ` · ${t("ti", "you")}` : ""}
                </Txt>
                <View style={s.row}>
                  <View style={{ flex: 1 }}>
                    <Button
                      secondary
                      label={t("Uredi", "Edit")}
                      disabled={g.locked}
                      onPress={() => {
                        setEditPerson(p.id);
                        setName(p.name);
                      }}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      secondary
                      label={t("Ukloni", "Remove")}
                      disabled={g.locked}
                      onPress={() =>
                        confirmDelete(
                          t("Ukloniti sudionika?", "Remove participant?"),
                          () => api.deletePerson(g.slug, p.id),
                        )
                      }
                    />
                  </View>
                </View>
              </Card>
            ))}
            <Card>
              <Field
                label={t("Naziv grupe", "Group name")}
                value={rename}
                onChange={setRename}
                maxLength={80}
              />
              <Button
                secondary
                label={t("Spremi naziv", "Save name")}
                disabled={g.locked || !rename.trim()}
                onPress={() =>
                  void act(() => api.rename(g.slug, rename.trim()))
                }
              />
              {g.currentUserRole === "OWNER" && (
                <Button
                  secondary
                  label={
                    g.locked
                      ? t("Otključaj grupu", "Unlock group")
                      : t("Zaključaj grupu", "Lock group")
                  }
                  onPress={() => void act(() => api.lock(g.slug, !g.locked))}
                />
              )}
              <Txt muted size={12}>
                {g.accessType}
              </Txt>
            </Card>
            {g.members.length > 0 && (
              <Card>
                <Txt bold>
                  {t("Registrirani članovi", "Registered members")}
                </Txt>
                {g.members.map((m) => (
                  <Txt key={m.id}>
                    {m.username ?? m.userId} · {m.role}
                  </Txt>
                ))}
              </Card>
            )}
          </>
        )}
        {tab === "drafts" && (
          <>
            <Button
              secondary
              label={
                selectedDraft
                  ? t("Svi draft računi", "All drafts")
                  : t("Natrag na troškove", "Back to expenses")
              }
              onPress={() =>
                selectedDraft ? setSelectedDraft(null) : setTab("overview")
              }
            />
            {!selectedDraft && <Heading
              title={t("Računi u pripremi", "Bills in progress")}
              subtitle={t(
                "Podijelite stavke prije potvrde.",
                "Assign items before confirming.",
              )}
            />}
            {!drafts.length && (
              <Card>
                <Txt muted>
                  {t("Nema spremljenih nacrta.", "No saved drafts.")}
                </Txt>
              </Card>
            )}
            {!selectedDraft &&
              drafts.map((d, index) => (
                <Pressable
                  key={d.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${t("Otvori nacrt", "Open draft")}: ${d.note || index + 1}`}
                  onPress={() => setSelectedDraft(d.id)}
                  disabled={busy}
                  style={[
                    s.card,
                    { backgroundColor: c.card, borderColor: c.line },
                  ]}
                >
                  <View style={s.between}>
                    <View style={{ flex: 1, gap: 5 }}>
                      <Txt bold size={17}>
                        {d.note || `${t("Nacrt", "Draft")} ${index + 1}`}
                      </Txt>
                      <Txt size={12} style={{ color: c.info }}>
                        {draftReadiness(d).assigned}/{d.items.length} {t("stavki odabrano", "items assigned")}
                      </Txt>
                      <Txt muted size={12}>
                        {date(d.createdAt)} · {d.items.length}{" "}
                        {t("stavki", "items")}
                      </Txt>
                    </View>
                    <Txt bold style={{ color: c.accent }}>
                      {money(
                        d.items.reduce((sum, i) => sum + Number(i.price), 0),
                      )}
                    </Txt>
                    <Txt muted>›</Txt>
                  </View>
                </Pressable>
              ))}
            {drafts
              .filter((d) => d.id === selectedDraft)
              .map((d) => (
                <Card key={d.id}>
                  <View style={{ backgroundColor: c.infoTint, padding: 12, borderRadius: 12, gap: 6 }}>
                    <Txt bold style={{ color: c.info }}>{t("ZAJEDNIČKI DRAFT", "SHARED DRAFT")} · {draftReadiness(d).assigned}/{d.items.length}</Txt>
                    <Txt size={13}>{draftReadiness(d).missing ? `${t("Stavke bez odabira", "Unassigned items")}: ${draftReadiness(d).missing}` : t("Sve stavke imaju sudionike. Autor može pregledati i potvrditi račun.", "All items are assigned. The author can review and confirm the bill.")}</Txt>
                  </View>
                  <Txt bold size={20}>
                    {d.note || t("Nacrt računa", "Draft bill")}
                  </Txt>
                  <Txt muted>
                    {money(
                      d.items.reduce((sum, i) => sum + Number(i.price), 0),
                    )}{" "}
                    · {date(d.createdAt)}
                  </Txt>
                  {!me && (
                    <Button
                      secondary
                      label={t(
                        "Odaberi tko si za označavanje stavki",
                        "Choose your identity to select items",
                      )}
                      onPress={() => setTab("people")}
                    />
                  )}
                  <Txt muted size={12}>
                    {t(
                      "Kvačicom označi što si jeo/la ili kupio/la. Promjene se spremaju odmah.",
                      "Check what you ate or bought. Changes save immediately.",
                    )}
                  </Txt>
                  {d.legacyOwner && (
                    <Txt muted size={12}>
                      {t(
                        "Stariji nacrt nema zabilježenog autora; dostupne su samo vlastite kvačice.",
                        "Older draft has no recorded author; only personal selections are available.",
                      )}
                    </Txt>
                  )}
                  <View style={s.between}>
                    <View style={{ flex: 1 }}><Txt muted size={12}>{t("Tvoj trenutačni dio", "Your current share")}</Txt><Txt bold style={{ color: c.info }}>{me ? money(d.items.reduce((sum, item) => sum + item.shares.filter(x => x.personId === me.id).reduce((part, x) => part + Number(x.amount), 0), 0)) : "—"}</Txt></View>
                    <Button secondary info label={t("Osvježi", "Refresh")} onPress={() => void run(refresh)} />
                  </View>
                  {d.canManage && <Button secondary label={manageDraft === d.id ? t("Zatvori uređivanje podjele", "Close allocation controls") : t("Uredi podjelu · autor", "Edit allocation · author")} onPress={() => setManageDraft(manageDraft === d.id ? null : d.id)} />}
                  {d.items.map((item) => (
                    <View
                      key={item.id}
                      style={{
                        gap: 8,
                        paddingVertical: 10,
                        borderTopWidth: 1,
                        borderColor: c.line,
                      }}
                    >
                      <ItemCheck
                        name={item.name}
                        price={Number(item.price)}
                        checked={
                          !!me && item.shares.some((x) => x.personId === me.id)
                        }
                        disabled={g.locked || !me}
                        onPress={() =>
                          void act(() =>
                            api.ownItem(
                              g.slug,
                              d.id,
                              item.id,
                              !item.shares.some((x) => x.personId === me?.id),
                            ),
                          )
                        }
                      />
                      <Txt muted size={12}>
                        {item.shares
                          .map(
                            (x) => `${person(x.personId)} ${money(x.amount)}`,
                          )
                          .join(" · ") ||
                          t("Još nitko nije označio.", "No selections yet.")}
                      </Txt>
                      {d.canManage && manageDraft === d.id && (
                        <>
                          <Txt muted size={12}>
                            {t(
                              "Podjela stavke · autor",
                              "Item participants · author",
                            )}
                          </Txt>
                          <View style={s.wrap}>
                            {g.people.map((p) => (
                              <Chip
                                key={p.id}
                                label={p.name}
                                selected={item.shares.some(
                                  (x) => x.personId === p.id,
                                )}
                                disabled={g.locked}
                                onPress={() =>
                                  void act(() =>
                                    api.shares(
                                      g.slug,
                                      d.id,
                                      item.id,
                                      item.shares.some(
                                        (x) => x.personId === p.id,
                                      )
                                        ? item.shares
                                            .filter((x) => x.personId !== p.id)
                                            .map((x) => x.personId)
                                        : [
                                            ...item.shares.map(
                                              (x) => x.personId,
                                            ),
                                            p.id,
                                          ],
                                    ),
                                  )
                                }
                              />
                            ))}
                          </View>
                          <Button
                            secondary
                            label={t(
                              "Zavrti za ovu stavku",
                              "Spin for this item",
                            )}
                            disabled={g.locked || !g.people.length}
                            onPress={() =>
                              setWheel({ draft: d, itemId: item.id })
                            }
                          />
                        </>
                      )}
                    </View>
                  ))}
                  <Txt bold>{t("Platitelji", "Payers")}</Txt>
                  {d.payers.map((p) => (
                    <Txt key={p.id}>
                      {person(p.personId)} · {money(p.amount)}
                    </Txt>
                  ))}
                  {d.canManage && (
                    <>
                      <Button
                        secondary
                        label={t(
                          "Nasumična podjela računa",
                          "Random bill split",
                        )}
                        disabled={g.locked || !g.people.length}
                        onPress={() => setWheel({ draft: d })}
                      />
                      <Button
                        secondary
                        label={t("Uredi platitelje", "Edit payers")}
                        disabled={g.locked}
                        onPress={() =>
                          setPayerEdit({
                            id: d.id,
                            values: g.people.map((p) => ({
                              personId: p.id,
                              amount: String(
                                d.payers.find((x) => x.personId === p.id)
                                  ?.amount ?? 0,
                              ),
                            })),
                          })
                        }
                      />
                      {payerEdit?.id === d.id && (
                        <View style={{ gap: 10 }}>
                          {g.people.map((p) => (
                            <Field
                              key={p.id}
                              label={`${p.name} (€)`}
                              decimal
                              value={
                                payerEdit.values.find(
                                  (x) => x.personId === p.id,
                                )?.amount ?? "0"
                              }
                              onChange={(amount) =>
                                setPayerEdit({
                                  id: d.id,
                                  values: [
                                    ...payerEdit.values.filter(
                                      (x) => x.personId !== p.id,
                                    ),
                                    { personId: p.id, amount },
                                  ],
                                })
                              }
                            />
                          ))}
                          <Button
                            label={t("Spremi platitelje", "Save payers")}
                            onPress={() =>
                              void act(async () => {
                                const values = payerEdit.values.map((x) => ({
                                  personId: x.personId,
                                  amount: cents(x.amount || "0") / 100,
                                }));
                                if (
                                  values.reduce(
                                    (sum, x) =>
                                      sum + Math.round(x.amount * 100),
                                    0,
                                  ) !==
                                  d.items.reduce(
                                    (sum, i) =>
                                      sum + Math.round(Number(i.price) * 100),
                                    0,
                                  )
                                )
                                  throw new Error(
                                    t(
                                      "Zbroj uplata mora biti jednak računu.",
                                      "Payments must match the bill total.",
                                    ),
                                  );
                                await api.payers(
                                  g.slug,
                                  d.id,
                                  values.filter((x) => x.amount > 0),
                                );
                                setPayerEdit(null);
                              })
                            }
                          />
                        </View>
                      )}
                      {!draftReadiness(d).ready && <Txt size={13} style={{ color: c.debt }}>{draftReadiness(d).missing ? t("Prije potvrde dodijelite svaku stavku barem jednoj osobi.", "Assign every item to at least one person before confirming.") : t("Za potvrdu pozitivan iznos računa mora odgovarati uplatama.", "A positive bill total must match payments before confirming.")}</Txt>}
                      <Button
                        label={t("Potvrdi trošak", "Confirm expense")}
                        disabled={g.locked || !draftReadiness(d).ready}
                        onPress={() =>
                          void act(() => api.confirm(g.slug, d.id))
                        }
                      />
                    </>
                  )}
                </Card>
              ))}
          </>
        )}
        {tab === "history" && (
          <>
            <Heading title={t("Povijest grupe", "Group activity")} />
            {!history.length && (
              <Card>
                <Txt muted>{t("Još nema aktivnosti.", "No activity yet.")}</Txt>
              </Card>
            )}
            {history.map((h) => {
              const meta = historyDetails(h);
              const action =
                h.action === "CREATE"
                  ? t("dodao/la je račun", "added a bill")
                  : h.action === "UPDATE"
                    ? t("uredio/la je račun", "edited a bill")
                    : h.action === "DELETE"
                      ? t("obrisao/la je račun", "deleted a bill")
                      : h.action;
              return (
                <Card key={h.id}>
                  <View style={[s.row, { alignItems: "flex-start" }]}>
                    <View
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 19,
                        backgroundColor: c.tint,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Icon
                        name={h.entity === "EXPENSE" ? "receipt" : "groups"}
                        color={c.accent}
                        size={19}
                      />
                    </View>
                    <View style={{ flex: 1, gap: 5 }}>
                      {meta ? (
                        <>
                          <Txt size={13}>
                            <Txt bold size={13}>
                              {meta.actor?.name ??
                                t(
                                  "Autor nije zabilježen",
                                  "Author not recorded",
                                )}
                            </Txt>{" "}
                            {action}
                          </Txt>
                          <Txt bold size={17}>
                            {meta.title}
                          </Txt>
                          <Txt bold style={{ color: c.accent }}>
                            {money(meta.total)}
                          </Txt>
                          {meta.actor?.kind === "participant" && (
                            <Txt muted size={11}>
                              {t(
                                "Odabrani sudionik · gost",
                                "Selected participant · guest",
                              )}
                            </Txt>
                          )}
                        </>
                      ) : (
                        <>
                          <Txt>{h.message}</Txt>
                          {h.entity === "EXPENSE" && (
                            <Txt muted size={12}>
                              {t(
                                "Autor nije zabilježen za ovaj stariji zapis.",
                                "Author was not recorded for this older entry.",
                              )}
                            </Txt>
                          )}
                        </>
                      )}
                      <Txt muted size={11}>
                        {date(h.createdAt)}
                      </Txt>
                    </View>
                  </View>
                </Card>
              );
            })}
          </>
        )}
        {tab === "overview" && <View style={{ height: 180 }} />}
      </Page>
      {tab === "overview" && (
        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            right: 12,
            bottom: 12,
            width: 214,
            alignItems: "stretch",
            gap: 8,
          }}
        >
          <Button
            secondary
            info
            icon="receipt"
            label={`Draft · ${drafts.length}`}
            onPress={() => {
              setSelectedDraft(null);
              setTab("drafts");
            }}
          />
          <Button
            secondary
            icon="camera"
            label={t("Fotografiraj račun", "Photograph receipt")}
            disabled={g.locked || !g.people.length}
            onPress={() => onAdd(true)}
          />
          <Button
            icon="plus"
            label={t("Dodaj trošak", "Add expense")}
            disabled={g.locked || !g.people.length}
            onPress={() => onAdd(false)}
          />
        </View>
      )}
      {wheel && (
        <Wheel
          people={g.people}
          initial={
            wheel.itemId
              ? (wheel.draft.items
                  .find((i) => i.id === wheel.itemId)
                  ?.shares.map((x) => x.personId) ?? [])
              : g.people.map((p) => p.id)
          }
          amount={
            wheel.itemId
              ? Number(
                  wheel.draft.items.find((i) => i.id === wheel.itemId)?.price ??
                    0,
                )
              : wheel.draft.items.reduce((sum, i) => sum + Number(i.price), 0)
          }
          onClose={() => setWheel(null)}
          onConfirm={(ids) => void applyRandom(ids)}
        />
      )}
    </View>
  );
}
const white = { color: "#FFFFFF" };
const pill = {
  borderRadius: 30,
  paddingHorizontal: 12,
  paddingVertical: 8,
  backgroundColor: "#FFFFFF20",
};
