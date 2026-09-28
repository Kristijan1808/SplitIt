import {Comments,IdentityPanel,TransferPanel,GroupUtilities,ask} from "./WorkflowPanels";
import {AppState} from "react-native";
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
import { ExpenseCard } from "./ExpenseCard";
import { historyDetails } from "./domain.mjs";
import type {
  Expense,
  Group,
  DraftExpense,
  SettlementResult,
  HistoryItem,
  Workflow,
} from "./types";
export type Snapshot = {
  group: Group;
  drafts: DraftExpense[];
  settlements: SettlementResult;
  history: HistoryItem[];
  workflow: Workflow;
  offline?: boolean;
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
  onDuplicate,
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
  onDuplicate: (expense: Expense) => void;
}) {
  const { c, t, busy } = useUI();
  const { group: rawGroup, drafts, settlements, history, workflow } = data;
  const g = {...rawGroup, locked: rawGroup.locked || workflow.archived || !!data.offline};
  const [receiptFilter,setReceiptFilter]=useState("all");
  const pending=g.expenses.filter(e=>e.allocationComplete===false||e.paymentIncomplete);
  const [allDebts,setAllDebts]=useState(false);
  const [search,setSearch]=useState("");
  const [category,setCategory]=useState("all");
  const [month,setMonth]=useState("");
  const [showFilters,setShowFilters]=useState(false);
  const [filter,setFilter]=useState("all");
  const [historyFilter,setHistoryFilter]=useState("all");
  const [limit,setLimit]=useState(30);
  const visibleExpenses=g.expenses.filter(e=>(receiptFilter!=="pending"||e.allocationComplete===false||e.paymentIncomplete)&&(category==="all"||e.category===category)&&(!month||(e.billDate||e.createdAt).startsWith(month))&&(!search||`${e.note} ${e.items.map(i=>i.name).join(' ')} ${e.payers.map(p=>g.people.find(x=>x.id===p.personId)?.name).join(' ')}`.toLowerCase().includes(search.toLowerCase()))&&(filter!=="mine"||e.shares.some(p=>p.personId===participantId)||e.payers.some(p=>p.personId===participantId)));

  const [name, setName] = useState("");
  const [rename, setRename] = useState(g.name);
  const [editPerson, setEditPerson] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string[]>([]);
  useEffect(()=>{if(tab!=="overview"||busy||data.offline)return;let running=false;const timer=setInterval(()=>{if(AppState.currentState!=="active"||running)return;running=true;refresh().catch(()=>{}).finally(()=>{running=false})},15000);return()=>clearInterval(timer)},[tab,busy,data.offline,refresh]);
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
    ask(title, t("Račun se može vratiti iz Mojih obrisanih računa.", "Bills can be restored from My deleted bills."), () => void act(fn));

  }
  async function share() {
    await Share.share({
      message: `${g.name}\n${t("Kod grupe", "Group code")}: ${g.code}${WEB_URL && !WEB_URL.includes("YOUR-") ? `\n${WEB_URL}/join?code=${g.code}` : ""}\nsplitit://join?code=${g.code}`,
    });
  }
  return (
    <View style={{ flex: 1 }}>
      <Page refresh={() => void run(refresh)}>
        {data.offline&&<Card><Txt bold>{t("Prikaz spremljenih podataka · bez veze", "Cached data · offline")}</Txt><Txt muted>{t("Izmjene su onemogućene dok se ponovno ne povežeš.", "Changes are disabled until you reconnect.")}</Txt><Button secondary label={t("Pokušaj ponovno", "Retry")} onPress={()=>void run(refresh)}/></Card>}
        {!workflow.people.some(p=>p.mine&&!p.inactive)&&!data.offline&&<IdentityPanel group={g} workflow={workflow} choose={async id=>{await run(()=>choose(id))}}/>}
        

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
              <Txt size={26}>{workflow.avatar||"👥"}</Txt>
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
            <View accessibilityRole="tablist" style={s.row}>{[["all",`${t("Računi","Bills")} (${g.expenses.length})`],["pending",`${t("Čekaju podjelu","Awaiting split")} (${pending.length})`]].map(([id,label])=><Pressable key={id} accessibilityRole="tab" accessibilityState={{selected:receiptFilter===id}} onPress={()=>setReceiptFilter(id)} style={{flex:1,minHeight:46,padding:8,borderBottomWidth:2,borderColor:receiptFilter===id?c.info:c.line}}><Txt bold style={{color:receiptFilter===id?c.info:c.muted}}>{label}</Txt></Pressable>)}</View>
            {!!pending.length&&<Txt muted size={12}>{t("Saldo je privremen: nedodijeljene stavke ostaju na platiteljima dok ih članovi ne označe.","Balances are provisional: unclaimed items remain with payers until members select them.")}</Txt>}
            <Button secondary label={t("Pretraži i filtriraj račune", "Search and filter bills")} onPress={()=>setShowFilters(!showFilters)}/>
            {showFilters&&<Card><Field label={t("Pretraži račune ili platitelje", "Search bills or payers")} value={search} onChange={value=>{setSearch(value);setLimit(30)}}/><View style={s.wrap}><Chip label={t("Svi računi", "All bills")} selected={filter==="all"} onPress={()=>setFilter("all")}/><Chip label={t("Moji računi", "My bills")} selected={filter==="mine"} onPress={()=>setFilter("mine")}/></View><Field label={t("Mjesec (GGGG-MM)", "Month (YYYY-MM)")} value={month} onChange={setMonth} maxLength={7}/><View style={s.wrap}>{[["all",t("Sve", "All")],["food",t("Hrana", "Food")],["travel",t("Putovanje", "Travel")],["home",t("Dom", "Home")],["fun",t("Zabava", "Fun")],["other",t("Ostalo", "Other")]].map(([id,label])=><Chip key={id} selected={category===id} label={label} onPress={()=>setCategory(id)}/>)}</View><Button secondary label={t("Poništi filtre", "Clear filters")} onPress={()=>{setSearch("");setMonth("");setCategory("all");setFilter("all")}}/></Card>}
            {!visibleExpenses.length&&!!g.expenses.length&&<Txt muted>{t("Nema računa za odabrane filtre.", "No bills match these filters.")}</Txt>}
            {visibleExpenses.slice(0,limit).map((e) => (
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
                {!!e.unassignedAmount&&<Txt bold style={{color:c.info}}>{t("Nedodijeljeno", "Unassigned")}: {money(e.unassignedAmount)}</Txt>}
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
                        name={`${item.name} · ${item.quantity||1} × ${(Number(item.price)/(item.quantity||1)).toFixed(2)} €`}
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
                        {!item.shares.length?t("Nedodijeljeno — označi ako dijeliš ovu stavku.","Unassigned — select if you shared this item."):item.shares
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
                <Comments slug={g.slug} expenseId={e.id} disabled={g.locked||!participantId} run={run}/>
                <Button secondary label={t("Dupliciraj račun", "Duplicate bill")} disabled={g.locked} onPress={()=>onDuplicate(e)} />
              </ExpenseCard>
            ))}
            {visibleExpenses.length>limit&&<Button secondary label={t("Prikaži više računa", "Show more bills")} onPress={()=>setLimit(n=>n+30)}/>}
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
              <TransferPanel group={g} workflow={workflow} personId={participantId} run={run} refresh={refresh} settlements={settlements}/>
          <Txt muted size={12}>{t("Preporučene uplate pojednostavljuju dugovanja i ne moraju pratiti pojedini račun.", "Suggested repayments simplify balances and may not match individual bills.")}</Txt>
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
            <GroupUtilities group={g} workflow={workflow} run={run} refresh={refresh}/>
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
                    disabled={!!p.inactive || (workflow.people.some(x=>x.id===p.id&&x.claimed&&!x.mine))}
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
                      disabled={g.locked || !workflow.canAdmin}
                      onPress={() => {
                        setEditPerson(p.id);
                        setName(p.name);
                      }}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      secondary
                      label={p.inactive?t("Vrati sudionika", "Reactivate"):t("Deaktiviraj", "Deactivate")}
                      disabled={g.locked || !workflow.canAdmin}
                      onPress={() =>
                        confirmDelete(
                          t("Ukloniti sudionika?", "Remove participant?"),
                          () => api.inactive(g.slug, p.id, !p.inactive),
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
                disabled={g.locked || !workflow.canAdmin || !rename.trim()}
                onPress={() =>
                  void act(() => api.rename(g.slug, rename.trim()))
                }
              />
              {workflow.canAdmin && (
                <Button
                  secondary
                  label={
                    rawGroup.locked
                      ? t("Otključaj grupu", "Unlock group")
                      : t("Zaključaj grupu", "Lock group")
                  }
                  onPress={() => void act(() => api.lock(g.slug, !rawGroup.locked))}
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
        {tab === "history" && (
          <>
            <Heading title={t("Povijest grupe", "Group activity")} />
            {!history.length && (
              <Card>
                <Txt muted>{t("Još nema aktivnosti.", "No activity yet.")}</Txt>
              </Card>
            )}
            <View style={s.wrap}>{[["all",t("Sve", "All")],["EXPENSE",t("Računi", "Bills")],["TRANSFER",t("Uplate", "Repayments")],["PERSON",t("Sudionici", "People")]].map(([id,label])=><Chip key={id} label={label} selected={historyFilter===id} onPress={()=>setHistoryFilter(id)}/>)}</View>
            {history.filter(h=>historyFilter==="all"||h.entity===historyFilter).map((h) => {
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
        {tab === "overview" && <View style={{ height: 120 }} />}
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
