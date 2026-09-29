import { FormEvent, useEffect, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { ArrowLeft, Copy, Lock, Plus, Users, X, Dices } from "lucide-react";
import { ThemeToggle } from "../components/ThemeToggle";
import { api } from "../api";
import { useLanguage } from "../i18n";
import type {
  ExpenseItem,
  ExpenseItemShare,
  ExpensePayer,
  Group,
  SettlementResult,
} from "../types";
import { RandomSplitWheel } from "../components/RandomSplitWheel";
import { getWhoAmI, saveWhoAmI, saveGroupToLocalStorage } from "../storage";

type DraftBill = {
  requireResponses?: boolean;
  canManage?: boolean;
  legacyOwner?: boolean;
  id: string;
  note?: string | null;
  createdAt: string;
  payers: Array<{ id: string; personId: string; amount: number }>;
  items: Array<{
    id: string;
    ordinalNumber: number;
    name: string;
    price: number;
    shares: Array<{
      id: string;
      itemId: string;
      personId: string;
      amount: number;
    }>;
  }>;
};

const normalizeDraft = (draft: DraftBill): DraftBill => ({
  ...draft,
  items: [...draft.items]
    .sort((a, b) => a.ordinalNumber - b.ordinalNumber)
    .map((item, index) => ({
      ...item,
      ordinalNumber: index + 1,
      shares: item.shares ?? [],
    })),
});

export const GroupPage = () => {
  const navigate = useNavigate();
  const { slug = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t, locale } = useLanguage();
  const [workflow,setWorkflow]=useState<any>(null);
  const [group, setGroup] = useState<Group | null>(null);
  const [personName, setPersonName] = useState("");
  const [showParticipants, setShowParticipants] = useState(false);
  const [showWhoAreYou, setShowWhoAreYou] = useState(false);
  const [showExpensesContainer, setShowExpensesContainer] = useState(true);
  const [receiptFilter,setReceiptFilter]=useState("all");
  const [showDrafts, setShowDrafts] = useState(false);
  const [drafts, setDrafts] = useState<DraftBill[]>([]);
  const [actionError, setActionError] = useState("");
  const [saving, setSaving] = useState(false);
  const [settlementData, setSettlementData] = useState<SettlementResult>({
    balances: [],
    settlements: [],
  });
  const [expandedDrafts, setExpandedDrafts] = useState<Set<string>>(new Set());
  const [expandedExpenses, setExpandedExpenses] = useState<Set<string>>(
    new Set(),
  );
  const [randomSplitTarget, setRandomSplitTarget] = useState<{
    draftId: string;
    itemId?: string;
  } | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const currentGroup = await api.getGroup(slug);
        saveGroupToLocalStorage(currentGroup);
        setGroup({...currentGroup,locked:currentGroup.locked||!!(currentGroup as any).archived});
        const flow=await api.workflow(slug);setWorkflow(flow);
        const mine=flow.people.find((p:any)=>p.mine&&!p.inactive);
        saveWhoAmI(slug,mine?.id??"",mine?.name??null);
      } catch {
        navigate("/");
      }
    };

    void load();
  }, [slug, navigate]);

  useEffect(() => {
    if (!group) return;

    const storedWhoAmI = getWhoAmI(slug);
    const storedParticipantId = storedWhoAmI?.participantId ?? null;
    const validSelection =
      storedParticipantId &&
      group.people.some((person) => person.id === storedParticipantId);
    const shouldPrompt =
      searchParams.get("chooseParticipant") === "1" || !validSelection;
    setShowWhoAreYou(shouldPrompt);
  }, [group, slug, searchParams]);

  useEffect(() => {
    const loadDrafts = async () => {
      try {
        const nextDrafts = await api.getDraftExpenses(slug);
        setDrafts(nextDrafts.map(normalizeDraft));
      } catch {
        setDrafts([]);
      }
    };

    void loadDrafts();
  }, [slug]);

  useEffect(() => {
    const loadSettlements = async () => {
      try {
        setSettlementData(await api.getSettlements(slug));
      } catch {
        setSettlementData({ balances: [], settlements: [] });
      }
    };
    if (group) void loadSettlements();
  }, [group, slug]);

  const balances = settlementData.balances ?? [];
  const settlements = settlementData.settlements ?? [];

  const setGroupState = (nextGroup: Group) => {
    setGroup(nextGroup);
    setPersonName("");
  };

  const chooseParticipant = async (participantId: string) => {
    if(saving)return;
    setSaving(true);setActionError("");
    try {
    await api.claim(slug,participantId);
    setWorkflow(await api.workflow(slug));
    const person = group?.people.find((entry) => entry.id === participantId);
    saveWhoAmI(slug, participantId, person?.name ?? null);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("chooseParticipant");
      return next;
    });
    setShowWhoAreYou(false);
    }catch(e){setActionError(e instanceof Error?e.message:String(e))}finally{setSaving(false)}
  };

  const currentParticipantId = getWhoAmI(slug)?.participantId ?? null;
  const currentParticipant = group?.people.find(
    (person) => person.id === currentParticipantId,
  );

  const updateDraftShares = async (
    draftId: string,
    itemId: string,
    personIds: string[],
  ) => {
    const uniquePersonIds = [...new Set(personIds)];
    const draft = drafts.find((entry) => entry.id === draftId);
    const item = draft?.items.find((entry) => entry.id === itemId);

    if (!item) return;

    const shares = uniquePersonIds.map((personId) => ({ personId }));

    // Optimistic UI update. The backend calculates equal amounts when
    // share amounts are omitted.
    setDrafts((current) =>
      current.map((entry) =>
        entry.id !== draftId
          ? entry
          : {
              ...entry,
              items: entry.items.map((currentItem) =>
                currentItem.id !== itemId
                  ? currentItem
                  : {
                      ...currentItem,
                      shares: uniquePersonIds.map((personId, index) => ({
                        id: `pending-${itemId}-${personId}`,
                        itemId,
                        personId,
                        amount:
                          Number(item.price) /
                          Math.max(uniquePersonIds.length, 1),
                      })),
                    },
              ),
            },
      ),
    );

    try {
      setActionError("");
      setSaving(true);

      const nextDraft =
        !draft?.canManage && currentParticipantId
          ? await api.ownItem(
              slug,
              draftId,
              itemId,
              uniquePersonIds.includes(currentParticipantId),
            )
          : await api.updateDraftExpenseItem(slug, draftId, itemId, { shares });

      setWorkflow(await api.workflow(slug));
      setDrafts((current) =>
        current.map((entry) =>
          entry.id === draftId
            ? {
                ...normalizeDraft(nextDraft),
              }
            : entry,
        ),
      );
    } catch (error) {
      try {
        const serverDrafts = await api.getDraftExpenses(slug);
        setDrafts(serverDrafts);
      } catch {
        // Keep the optimistic state if recovery fails.
      }

      setActionError(
        error instanceof Error ? error.message : t("somethingWentWrong"),
      );
    } finally {
      setSaving(false);
    }
  };

  const applyRandomSplit = async (personIds: string[]) => {
    if (!randomSplitTarget) return;

    const targetDraft = drafts.find(
      (draft) => draft.id === randomSplitTarget.draftId,
    );
    if (!targetDraft) {
      setRandomSplitTarget(null);
      return;
    }

    if (randomSplitTarget.itemId) {
      await updateDraftShares(
        targetDraft.id,
        randomSplitTarget.itemId,
        personIds,
      );
      setRandomSplitTarget(null);
      return;
    }

    // Global mode: apply the same random participant selection to every item.
    for (const item of targetDraft.items) {
      await updateDraftShares(targetDraft.id, item.id, personIds);
    }

    setRandomSplitTarget(null);
  };

  const assignDraftItemToCurrentParticipant = async (
    draftId: string,
    itemId: string,
  ) => {
    if (!currentParticipantId) {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.set("chooseParticipant", "1");
        return next;
      });
      setShowWhoAreYou(true);
      return;
    }

    const draft = drafts.find((entry) => entry.id === draftId);
    const item = draft?.items.find((entry) => entry.id === itemId);

    if (!item) return;

    const currentIds = item.shares.map((share) => share.personId);
    const nextIds = currentIds.includes(currentParticipantId)
      ? currentIds
      : [...currentIds, currentParticipantId];

    await updateDraftShares(draftId, itemId, nextIds);
  };

  const finalizeDraft = async (draftId: string) => {
    const target = drafts.find((draft) => draft.id === draftId);
    if (!target || !group) return;

    const validItems = target.items.filter(
      (item) => item.name.trim() && Number(item.price || 0) > 0,
    );
    if (validItems.length === 0) {
      setActionError(t("noAssignment"));
      return;
    }

    setSaving(true);
    setActionError("");

    try {
      const result = await api.confirmDraftExpense(slug, draftId);
      setDrafts((current) => current.filter((draft) => draft.id !== draftId));
      setGroup(result.group);
      setExpandedExpenses((current) => {
        const next = new Set(current);
        next.add(result.expense.id);
        return next;
      });
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : t("somethingWentWrong"),
      );
    } finally {
      setSaving(false);
    }
  };

  const executeAction = async (callback: () => Promise<Group>) => {
    try {
      setSaving(true);
      setActionError("");
      const nextGroup = await callback();
      setGroupState(nextGroup);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : t("somethingWentWrong"),
      );
      window.setTimeout(() => setActionError(""), 3500);
    } finally {
      setSaving(false);
    }
  };

  const addPerson = async (event: FormEvent) => {
    event.preventDefault();
    if (!personName.trim() || !group || group.locked) return;

    await executeAction(async () => {
      const nextGroup = await api.addPerson(slug, { name: personName });
      setPersonName("");
      setShowParticipants(true);
      return nextGroup;
    });
  };

  const toggleLock = async () => {
    if (!group) return;
    try {
      setSaving(true);
      const nextGroup = await api.lockGroup(slug, !group.locked);
      setGroup(nextGroup);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : t("somethingWentWrong"),
      );
    } finally {
      setSaving(false);
    }
  };

  const formatLocalDateTime = (dateString?: string | null) => {
    if (!dateString) return "";

    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "";

    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  };

  const formatPaymentLine = (payment: Group["payments"][number]) => {
    const payer = group?.people.find(
      (person) => person.id === payment.personId,
    );
    const participantIds = payment.participantIds ?? [];
    const splitNames =
      group?.people
        .filter((person) => participantIds.includes(person.id))
        .map((person) => person.name)
        .join(", ") ?? "";
    const share =
      payment.amount /
      Math.max(participantIds.length || (group?.people.length ?? 1), 1);
    const createdAtText = formatLocalDateTime(payment.createdAt);

    return `${payer?.name ?? t("someone")} ${t("paid")} ${payment.amount.toFixed(2)}${payment.note ? ` · ${payment.note}` : ""}${createdAtText ? ` · ${createdAtText}` : ""} · ${t("split")} ${splitNames || t("everyone")} · ${share.toFixed(2)} ${t("each")}`;
  };

  if (!group) {
    return null;
  }

  return (
    <main className="page wide">
      {saving && (
        <div className="screenLoader">
          <div className="spinner large" />
        </div>
      )}
      {actionError && <div className="toastError">{actionError}</div>}

      <div className="topBar">
        <ThemeToggle />
      </div>

      <Link className="backLink" to="/">
        <ArrowLeft size={18} /> {t("home")}
      </Link>

      <section className="groupHeader">
        <div>
          <p className="eyebrow">
            {t("code")}: {group.code}
          </p>
          <h1>{group.name}</h1><p>{group.currency||"EUR"}</p>

          <div className="groupMetaRow">
            <p className="muted">{group.locked ? t("groupLocked") : ""}</p>
            <button
              type="button"
              className="participantsToggle"
              onClick={() => setShowParticipants((current) => !current)}
            >
              <Users size={16} />
              <span>{t("participantsLabel")},</span>
              {currentParticipant && (
                <span className="">
                  {t("youAre")}: {currentParticipant.name}
                </span>
              )}
            </button>
          </div>
        </div>
        <div className="headerActions">
          <button
            className="secondaryButton"
            onClick={() =>
              navigator.clipboard.writeText(
                `${window.location.origin}/join?code=${group.code}`,
              )
            }
          >
            <Copy size={18} /> {t("copyLink")}
          </button>
          <button className="secondaryButton" onClick={toggleLock}>
            <Lock size={18} />{" "}
            {group.locked ? t("unlockGroup") : t("lockGroup")}
          </button>
        </div>
      </section>

      {showWhoAreYou && (
        <div
          className="participantsOverlay"
          onClick={() => setShowWhoAreYou(false)}
        >
          <section
            className="card participantsCard"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="participantsHeader">
              <h3>{t("whoAreYou")}</h3>
              <button
                type="button"
                className="iconButton"
                onClick={() => setShowWhoAreYou(false)}
                aria-label={t("whoAreYou")}
              >
                ×
              </button>
            </div>
            <p className="muted participantPrompt">
              {t("selectYourParticipant")}
            </p>
            <div className="list">
              {group.people.map((person) => (
                <button
                  key={person.id}
                  type="button"
                  className="secondaryButton participantChoiceButton"
                  disabled={saving || !!workflow?.people.find((p:any)=>p.id===person.id&&(p.inactive||(p.claimed&&!p.mine)))}
                  onClick={() => void chooseParticipant(person.id)}
                >
                  {person.name}
                </button>
              ))}
            </div>
          </section>
        </div>
      )}

      {showParticipants && (
        <div
          className="participantsOverlay"
          onClick={() => setShowParticipants(false)}
        >
          <section
            className="card participantsCard"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="participantsHeader">
              <h3>{t("participantsPanelTitle")}</h3>
              <button
                type="button"
                className="iconButton"
                onClick={() => setShowParticipants(false)}
                aria-label={t("participantsPanelTitle")}
              >
                ×
              </button>
            </div>
            <div className="list">
              {group.people.map((person) => (
                <div className="personRow" key={person.id}>
                  <strong>{person.name}</strong>
                  <small>
                    {person.payments.length}{" "}
                    {person.payments.length === 1
                      ? t("expense")
                      : t("expenses")}
                  </small>
                </div>
              ))}
            </div>
            <form
              onSubmit={addPerson}
              className="inlineInput addParticipantForm"
            >
              <input
                placeholder={t("addParticipantInput")}
                value={personName}
                onChange={(event) => setPersonName(event.target.value)}
                disabled={group.locked}
              />
              <button
                className="iconButton"
                type="submit"
                disabled={group.locked}
              >
                <Plus size={18} />
              </button>
            </form>
          </section>
        </div>
      )}

      <section className="buttons-container-right">
        <Link
          className="primaryButton compactButton"
          to={`/g/${slug}/add-expense`}
        >
          <Plus size={18} /> {t("addExpense")}
        </Link>
      </section>

      <section className="buttons-container-left">
        <button
          className="open-expenses-btn"
          onClick={() => setShowExpensesContainer((current) => !current)}
        >
          Računi
        </button>
      </section>

      <div className="grid">
        <section className="card resultCard">
          <h2>{t("balances")}</h2>
          <div className="totalSpentSummary">
            <div>
              <small>{t("totalSpent")}: </small>
              <strong>
                {balances
                  .reduce((sum, balance) => sum + balance.paid, 0)
                  .toFixed(2)}
              </strong>
            </div>
          </div>
          {settlements.length === 0 ? (
            <p className="success">{t("everythingBalanced")}</p>
          ) : (
            <div className="list">
              {settlements.map((settlement, index) => (
                <div className="settlement" key={index}>
                  <span>{settlement.fromName}</span>
                  <strong>→ {settlement.toName}</strong>
                  <em>{settlement.amount.toFixed(2)} {group?.currency||"EUR"}</em>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {showExpensesContainer && (
        <section id="expenses-container">
          <button
            type="button"
            className="close-drafts-btn"
            onClick={() => setShowExpensesContainer((current) => !current)}
          ></button>
          <div className="grid">
            <section className="card">
              <div className="sectionHeaderWithButton">
                <div>
                  <h2>{t("expenses")}</h2>
                </div>
              </div>
              <div role="tablist" style={{display:"flex",gap:12,marginBottom:16}}>{[["all","Računi"],["pending","Čekaju podjelu"]].map(([id,label])=><button type="button" role="tab" aria-selected={receiptFilter===id} key={id} onClick={()=>setReceiptFilter(id)}>{label} ({group.expenses.filter(e=>id==="all"||e.allocationComplete===false||e.paymentIncomplete).length})</button>)}</div>
              <p className="muted">Nedodijeljeni dio privremeno ostaje na platiteljima. Saldo se osvježava čim članovi označe stavke.</p>
              {true &&
                (() => {
                  const expenses = group.expenses.filter(e=>receiptFilter!=="pending"||e.allocationComplete===false||e.paymentIncomplete);
                  if (expenses.length === 0)
                    return <p className="muted">{t("noExpensesYet")}</p>;
                  return (
                    <div className="list">
                      {expenses.map((expense) => {
                        const expanded = expandedExpenses.has(expense.id);
                        return (
                          <div className="expenseCard" key={expense.id} style={expense.allocationComplete===false?{border:"2px solid #4681d8",backgroundColor:"rgba(70,129,216,.1)"}:undefined}>
                            <button
                              type="button"
                              className="expenseSummary"
                              onClick={() =>
                                setExpandedExpenses((current) => {
                                  const next = new Set(current);
                                  if (next.has(expense.id))
                                    next.delete(expense.id);
                                  else next.add(expense.id);
                                  return next;
                                })
                              }
                            >
                              <div className="expenseSummaryMain">
                                <strong>{expense.note || t("expense")}</strong>
                                {expense.allocationComplete===false&&<small>Čeka podjelu · {expense.unassignedCount}/{expense.items.length} stavki</small>}
                                {expense.paymentIncomplete&&<small>Provjeri platitelje</small>}
                                <small>
                                  {formatLocalDateTime(expense.createdAt)} ·{" "}
                                  {expense.items?.length ?? 0} {t("itemsCount")}
                                </small>
                              </div>
                              <strong>
                                {Number(expense.totalAmount || 0).toFixed(2)} {group?.currency||"EUR"}
                              </strong>
                            </button>

                            {expanded && (
                              <div className="expenseDetails">
                                <div className="expenseDetailsBlock expense-payers">
                                  <strong>{t("billPayers")}</strong>
                                  {(expense.payers ?? []).map(
                                    (payer: ExpensePayer) => (
                                      <div
                                        className="detailLine"
                                        key={payer.id}
                                      >
                                        <span>
                                          {payer.person?.name ??
                                            group.people.find(
                                              (p) => p.id === payer.personId,
                                            )?.name}
                                        </span>
                                        <strong>
                                          {Number(payer.amount).toFixed(2)} {group?.currency||"EUR"}
                                        </strong>
                                      </div>
                                    ),
                                  )}
                                </div>

                                <div className="expenseDetailsBlock expense-items">
                                  <strong>{t("billItems")}</strong>
                                  {(expense.items ?? []).map(
                                    (item: ExpenseItem) => (
                                      <div
                                        className="expenseDetailItem"
                                        key={item.id}
                                      >
                                        <label>
                                          <input
                                            type="checkbox"
                                            checked={item.shares.some(
                                              (s) =>
                                                s.personId ===
                                                currentParticipantId,
                                            )}
                                            disabled={
                                              group.locked ||
                                              saving ||
                                              !currentParticipantId
                                            }
                                            onChange={async (event) => {
                                              const selected =
                                                event.target.checked;
                                              setSaving(true);
                                              setActionError("");
                                              try {
                                                await api.ownItem(
                                                  slug,
                                                  expense.id,
                                                  item.id,
                                                  selected,
                                                  true,
                                                );
                                                setGroup(
                                                  await api.getGroup(slug),
                                                );
                                                setSettlementData(
                                                  await api.getSettlements(
                                                    slug,
                                                  ),
                                                );
                                              } catch (error) {
                                                setActionError(
                                                  error instanceof Error
                                                    ? error.message
                                                    : "Error",
                                                );
                                              } finally {
                                                setSaving(false);
                                              }
                                            }}
                                          />
                                          {locale.startsWith("hr")
                                            ? "Moja stavka"
                                            : "My item"}
                                        </label>
                                        <div className="expenseDetailItemTop">
                                          <strong>
                                            {item.ordinalNumber}. {item.name} · {item.quantity||1} × {(Number(item.price)/(item.quantity||1)).toFixed(2)} {group?.currency||"EUR"}
                                          </strong>
                                          <strong>
                                            {Number(item.price).toFixed(2)} {group?.currency||"EUR"}
                                          </strong>
                                        </div>
                                        <div className="shareNames">
                                          {(item.shares ?? []).length === 0
                                            ? t("noItemAssigned")
                                            : item.shares
                                                .map(
                                                  (share: ExpenseItemShare) => {
                                                    const name =
                                                      share.person?.name ??
                                                      group.people.find(
                                                        (p) =>
                                                          p.id ===
                                                          share.personId,
                                                      )?.name ??
                                                      share.personId;
                                                    return `${name} (${Number(share.amount).toFixed(2)} ${group?.currency||"EUR"})`;
                                                  },
                                                )
                                                .join(", ")}
                                        </div>
                                      </div>
                                    ),
                                  )}
                                </div>

                                <div className="expenseDetailsBlock expense-participants">
                                  <strong>{t("selectedParticipants")}</strong>
                                  <div className="shareNames">
                                    {(expense.shares ?? [])
                                      .map((share) => {
                                        const name =
                                          share.person?.name ??
                                          group.people.find(
                                            (p) => p.id === share.personId,
                                          )?.name ??
                                          share.personId;
                                        return `${name} (${Number(share.amount).toFixed(2)} ${group?.currency||"EUR"})`;
                                      })
                                      .join(", ")}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
            </section>
          </div>
        </section>
      )}

      <RandomSplitWheel currency={group?.currency||"EUR"}
        open={randomSplitTarget !== null}
        title={
          randomSplitTarget?.itemId
            ? `${t("randomSplitItem")} ${
                drafts
                  .find((draft) => draft.id === randomSplitTarget.draftId)
                  ?.items.find((item) => item.id === randomSplitTarget.itemId)
                  ?.name ?? ""
              }`.trim()
            : t("randomSplitGlobal")
        }
        amount={
          randomSplitTarget?.itemId
            ? Number(
                drafts
                  .find((draft) => draft.id === randomSplitTarget.draftId)
                  ?.items.find((item) => item.id === randomSplitTarget.itemId)
                  ?.price ?? 0,
              )
            : (drafts
                .find((draft) => draft.id === randomSplitTarget?.draftId)
                ?.items.reduce(
                  (sum, item) => sum + Number(item.price || 0),
                  0,
                ) ?? 0)
        }
        people={group.people}
        initialSelectedIds={
          randomSplitTarget?.itemId
            ? (drafts
                .find((draft) => draft.id === randomSplitTarget.draftId)
                ?.items.find((item) => item.id === randomSplitTarget.itemId)
                ?.shares.map((share) => share.personId) ?? [])
            : (drafts
                .find((draft) => draft.id === randomSplitTarget?.draftId)
                ?.items[0]?.shares.map((share) => share.personId) ?? [])
        }
        onConfirm={(personIds) => void applyRandomSplit(personIds)}
        onClose={() => setRandomSplitTarget(null)}
      />
    </main>
  );
};
