import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Copy, Lock, Plus, Users, X } from "lucide-react";
import { ThemeToggle } from "../components/ThemeToggle";
import { api } from "../api";
import { useLanguage } from "../i18n";
import type { Group } from "@splitit/shared";
import { getWhoAmI, saveWhoAmI, saveGroupToLocalStorage } from "../storage";

type DraftBill = {
  id: string;
  note?: string | null;
  createdAt: string;
  payers: Array<{ id: string; personId: string; amount: number }>;
  items: Array<{
    id: string;
    name: string;
    price: number;
    shares: Array<{ id: string; itemId: string; personId: string; amount: number }>;
  }>;
};

export const GroupPage = () => {
  const navigate = useNavigate();
  const { slug = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t, locale } = useLanguage();
  const [group, setGroup] = useState<Group | null>(null);
  const [personName, setPersonName] = useState("");
  const [showParticipants, setShowParticipants] = useState(false);
  const [showWhoAreYou, setShowWhoAreYou] = useState(false);
  const [showExpensesContainer, setShowExpensesContainer] = useState(false);
  const [showDrafts, setShowDrafts] = useState(false);
  const [drafts, setDrafts] = useState<DraftBill[]>([]);
  const [actionError, setActionError] = useState("");
  const [saving, setSaving] = useState(false);
  const [settlementData, setSettlementData] = useState<any>({ balances: [], settlements: [] });
  const [expandedDrafts, setExpandedDrafts] = useState<Set<string>>(new Set());
  const [expandedExpenses, setExpandedExpenses] = useState<Set<string>>(new Set());

  useEffect(() => {
    const load = async () => {
      try {
        const currentGroup = await api.getGroup(slug);
        saveGroupToLocalStorage(currentGroup);
        setGroup(currentGroup);
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
    const validSelection = storedParticipantId && group.people.some((person) => person.id === storedParticipantId);
    const shouldPrompt = searchParams.get("chooseParticipant") === "1" || !validSelection;
    setShowWhoAreYou(shouldPrompt);
  }, [group, slug, searchParams]);

  useEffect(() => {
    const loadDrafts = async () => {
      try {
        const nextDrafts = await api.getDraftExpenses(slug);
        setDrafts(
          nextDrafts.map((draft) => ({
            ...draft,
            items: draft.items.map((item) => ({
              ...item,
              shares: item.shares ?? []
            }))
          }))
        );
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

  const chooseParticipant = (participantId: string) => {
    const person = group?.people.find((entry) => entry.id === participantId);
    saveWhoAmI(slug, participantId, person?.name ?? null);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("chooseParticipant");
      return next;
    });
    setShowWhoAreYou(false);
  };

  const currentParticipantId = getWhoAmI(slug)?.participantId ?? null;
  const currentParticipant = group?.people.find((person) => person.id === currentParticipantId);

  const updateDraftShares = async (
    draftId: string,
    itemId: string,
    personIds: string[]
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
                          Math.max(uniquePersonIds.length, 1)
                      }))
                    }
              )
            }
      )
    );

    try {
      setActionError("");
      setSaving(true);

      const nextDraft = await api.updateDraftExpenseItem(
        slug,
        draftId,
        itemId,
        { shares }
      );

      setDrafts((current) =>
        current.map((entry) =>
          entry.id === draftId
            ? {
                ...nextDraft,
                items: nextDraft.items.map((nextItem) => ({
                  ...nextItem,
                  shares: nextItem.shares ?? []
                }))
              }
            : entry
        )
      );
    } catch (error) {
      try {
        const serverDrafts = await api.getDraftExpenses(slug);
        setDrafts(serverDrafts);
      } catch {
        // Keep the optimistic state if recovery fails.
      }

      setActionError(
        error instanceof Error
          ? error.message
          : t("somethingWentWrong")
      );
    } finally {
      setSaving(false);
    }
  };

  const assignDraftItemToCurrentParticipant = async (
    draftId: string,
    itemId: string
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

    const validItems = target.items.filter((item) => item.name.trim() && Number(item.price || 0) > 0);
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
      setActionError(error instanceof Error ? error.message : t("somethingWentWrong"));
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
      setActionError(error instanceof Error ? error.message : t("somethingWentWrong"));
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
      setActionError(error instanceof Error ? error.message : t("somethingWentWrong"));
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
      timeStyle: "short"
    }).format(date);
  };

  const formatPaymentLine = (payment: Group["payments"][number]) => {
    const payer = group?.people.find((person) => person.id === payment.personId);
    const participantIds = payment.participantIds ?? [];
    const splitNames = group?.people
      .filter((person) => participantIds.includes(person.id))
      .map((person) => person.name)
      .join(", ") ?? "";
    const share = payment.amount / Math.max(participantIds.length || (group?.people.length ?? 1), 1);
    const createdAtText = formatLocalDateTime(payment.createdAt);

    return `${payer?.name ?? t("someone")} ${t("paid")} ${payment.amount.toFixed(2)}${payment.note ? ` · ${payment.note}` : ""}${createdAtText ? ` · ${createdAtText}` : ""} · ${t("split")} ${splitNames || t("everyone")} · ${share.toFixed(2)} ${t("each")}`;
  };

  if (!group) {
    return null;
  }

  return (
    <main className="page wide">
      {saving && <div className="screenLoader"><div className="spinner large" /></div>}
      {actionError && <div className="toastError">{actionError}</div>}

      <div className="topBar">
        <ThemeToggle />
      </div>

      <Link className="backLink" to="/">
        <ArrowLeft size={18} /> {t("home")}
      </Link>

      <section className="groupHeader">
        <div>
          <p className="eyebrow">{t("code")}: {group.code}</p>
          <h1>{group.name}</h1>
          <div className="groupMetaRow">
            <p className="muted">{group.locked ? t("groupLocked") : ""}</p>
            <button type="button" className="participantsToggle" onClick={() => setShowParticipants((current) => !current)}>
              <Users size={16} />
              <span>{t("participantsLabel")}</span>
            </button>
          </div>
        </div>
        <div className="headerActions">
          <button
            className="secondaryButton"
            onClick={() => navigator.clipboard.writeText(`${window.location.origin}/join?code=${group.code}`)}
          >
            <Copy size={18} /> {t("copyLink")}
          </button>
          <button className="secondaryButton" onClick={toggleLock}>
            <Lock size={18} /> {group.locked ? t("unlockGroup") : t("lockGroup")}
          </button>
        </div>
      </section>

      {showWhoAreYou && (
        <div className="participantsOverlay" onClick={() => setShowWhoAreYou(false)}>
          <section className="card participantsCard" onClick={(event) => event.stopPropagation()}>
            <div className="participantsHeader">
              <h3>{t("whoAreYou")}</h3>
              <button type="button" className="iconButton" onClick={() => setShowWhoAreYou(false)} aria-label={t("whoAreYou")}>×</button>
            </div>
            <p className="muted" style={{ marginBottom: 12 }}>{t("selectYourParticipant")}</p>
            <div className="list">
              {group.people.map((person) => (
                <button
                  key={person.id}
                  type="button"
                  className="secondaryButton"
                  style={{ width: "100%", justifyContent: "flex-start", marginBottom: 8 }}
                  onClick={() => chooseParticipant(person.id)}
                >
                  {person.name}
                </button>
              ))}
            </div>
          </section>
        </div>
      )}

      {showParticipants && (
        <div className="participantsOverlay" onClick={() => setShowParticipants(false)}>
          <section className="card participantsCard" onClick={(event) => event.stopPropagation()}>
            <div className="participantsHeader">
              <h3>{t("participantsPanelTitle")}</h3>
              <button type="button" className="iconButton" onClick={() => setShowParticipants(false)} aria-label={t("participantsPanelTitle")}>×</button>
            </div>
            <div className="list">
              {group.people.map((person) => (
                <div className="personRow" key={person.id}>
                  <strong>{person.name}</strong>
                  <small>{person.payments.length} {person.payments.length === 1 ? t("expense") : t("expenses")}</small>
                </div>
              ))}
            </div>
            <form onSubmit={addPerson} className="inlineInput" style={{ marginTop: 16 }}>
              <input placeholder={t("addParticipantInput")} value={personName} onChange={(event) => setPersonName(event.target.value)} disabled={group.locked} />
              <button className="iconButton" type="submit" disabled={group.locked}><Plus size={18} /></button>
            </form>
          </section>
        </div>
      )}

      <section className="buttons-container-right">
        <button className="open-drafts-btn" onClick={() => setShowDrafts((current) => !current)}>{drafts.length}</button>
        <Link className="primaryButton compactButton" to={`/g/${slug}/add-expense`}>
            <Plus size={18} /> {t("addExpense")}
        </Link>
      </section>

      <section className="buttons-container-left">
        <button className="open-expenses-btn" onClick={() => setShowExpensesContainer((current) => !current)}>Expenses!</button>
      </section>


      <div className="grid">
        <section className="card resultCard">
          <h2>{t("balances")}</h2>
          <div style={{marginBottom:10}}>
            <div>
              <small>{t("totalSpent")}: </small>
              <strong>{balances.reduce((sum, balance) => sum + balance.paid, 0).toFixed(2)}</strong>
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
                  <em>{settlement.amount.toFixed(2)}</em>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {showDrafts && (
        <section className="drafts-container">
          <button
            type="button"
            className="close-drafts-btn"
            onClick={() => setShowDrafts((current) => !current)}
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        <div className="grid">
          <section className="card">
            <div className="sectionHeaderWithButton">
              <div>
                <h2>{t("draftBills")}</h2>
                <p className="muted">{t("draftBillsHint")}</p>
              </div>
              {currentParticipant && (
                <span className="eyebrow">{t("youAre")}: {currentParticipant.name}</span>
              )}
            </div>

            <div className="list">
              {drafts.map((draft) => {
                const itemTotal = draft.items.reduce((sum, item) => sum + Number(item.price || 0), 0);
                const assignedTotal = draft.items.reduce(
                  (sum, item) =>
                    sum +
                    item.shares.reduce(
                      (shareSum, share) => shareSum + Number(share.amount || 0),
                      0
                    ),
                  0
                );
                const payerTotal = draft.payers.reduce((sum, payer) => sum + Number(payer.amount || 0), 0);
                const unassignedCount = draft.items.filter((item) => item.shares.length === 0).length;
                const payerNames = draft.payers
                  .map((payer) => group.people.find((person) => person.id === payer.personId)?.name)
                  .filter(Boolean)
                  .join(", ");

                const expanded = expandedDrafts.has(draft.id);
                return (
                  <div key={draft.id} className="paymentRow draftCard">
                    <div className="contentRow" style={{ display: "block", width: "100%" }}>
                      <button type="button" className="expenseSummary" onClick={() => setExpandedDrafts((current) => { const next = new Set(current); if (next.has(draft.id)) next.delete(draft.id); else next.add(draft.id); return next; })}>
                        <div className="expenseSummaryMain">
                          <strong>{draft.note || t("draftBill")}</strong>
                          <small>{formatLocalDateTime(draft.createdAt)} · {draft.items.length} {t("itemsCount")}</small>
                        </div>
                        <strong>{itemTotal.toFixed(2)} €</strong>
                      </button>
                      {expanded ? (
                        <div>

                      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
                        <div className="stats">
                          <div><small>{t("itemsTotal")}</small><strong>{itemTotal.toFixed(2)}</strong></div>
                          <div><small>{t("paidTotal")}</small><strong>{payerTotal.toFixed(2)}</strong></div>
                          <div><small>{t("assignedTotal")}</small><strong>{assignedTotal.toFixed(2)}</strong></div>
                          <div><small>{t("unassignedItems")}</small><strong>{unassignedCount}</strong></div>
                        </div>
                        <p className="muted" style={{ marginBottom: 0 }}>
                          {t("billPayers")}: {payerNames || t("noPayersAdded")}
                        </p>  
                      </div>

                      <div className="list" style={{ marginTop: 12 }}>
                        {draft.items.map((item) => {
                          const isMine = item.shares.some(
                            (share) => share.personId === currentParticipantId
                          );

                          return (
                            <div
                              key={item.id}
                              className="draftItemRow"
                            >
                              <span>
                                <strong>{item.name}</strong>
                                {item.shares.length > 0 && (
                                  <small style={{ display: "block" }}>
                                    {item.shares
                                      .map((share) => {
                                        const name = group.people.find(
                                          (person) => share.personId === person.id
                                        )?.name;
                                        return name
                                          ? `${name} (${Number(share.amount).toFixed(2)} €)`
                                          : null;
                                      })
                                      .filter(Boolean)
                                      .join(", ")}
                                  </small>
                                )}
                                {isMine && (
                                  <small style={{ display: "block" }}>
                                    ✓ {t("assignedToYou")}
                                  </small>
                                )}
                              </span>

                              <em>{Number(item.price || 0).toFixed(2)}</em>

                              <div className="sharePicker" aria-label={t("assignedTo")}>
                                {group.people.map((person) => {
                                  const checked = item.shares.some((share) => share.personId === person.id);
                                  return (
                                    <label key={person.id} className="shareOption">
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        disabled={group.locked || saving}
                                        onChange={() => {
                                          const currentIds = item.shares.map((share) => share.personId);
                                          const nextIds = checked
                                            ? currentIds.filter((id) => id !== person.id)
                                            : [...currentIds, person.id];
                                          void updateDraftShares(draft.id, item.id, nextIds);
                                        }}
                                      />
                                      <span>{person.name}</span>
                                    </label>
                                  );
                                })}
                              </div>

                              <button
                                type="button"
                                className="secondaryButton compactButton"
                                onClick={() =>
                                  void assignDraftItemToCurrentParticipant(
                                    draft.id,
                                    item.id
                                  )
                                }
                                disabled={group.locked || saving}
                              >
                                {isMine ? t("assignedToYou") : t("assignToMe")}
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 14 }}>
                        <button
                          type="button"
                          className="primaryButton"
                          onClick={() => void finalizeDraft(draft.id)}
                          disabled={group.locked || saving}
                        >
                          {t("confirmSelection")}
                        </button>
                        {unassignedCount > 0 && (
                          <span className="muted">{t("assignItemsBeforeConfirm")}</span>
                        )}
                        </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
        </section>
      )}

      {showExpensesContainer && (<section id="expenses-container">
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
          {true && (() => {
            const expenses = ((group as any).expenses ?? []) as Array<any>;
            if (expenses.length === 0) return <p className="muted">{t("noExpensesYet")}</p>;
            return (
              <div className="list">
                {expenses.map((expense) => {
                  const expanded = expandedExpenses.has(expense.id);
                  return (
                    <div className="expenseCard" key={expense.id}>
                      <button
                        type="button"
                        className="expenseSummary"
                        onClick={() => setExpandedExpenses((current) => {
                          const next = new Set(current);
                          if (next.has(expense.id)) next.delete(expense.id); else next.add(expense.id);
                          return next;
                        })}
                      >
                        <div className="expenseSummaryMain">
                          <strong>{expense.note || t("expense")}</strong>
                          <small>{formatLocalDateTime(expense.createdAt)} · {expense.items?.length ?? 0} {t("itemsCount")}</small>
                        </div>
                        <strong>{Number(expense.totalAmount || 0).toFixed(2)} €</strong>
                      </button>

                      {expanded && (
                        <div className="expenseDetails">
                          <div className="expenseDetailsBlock expense-payers">
                            <strong>{t("billPayers")}</strong>
                            {(expense.payers ?? []).map((payer: any) => (
                              <div className="detailLine" key={payer.id}>
                                <span>{payer.person?.name ?? group.people.find((p) => p.id === payer.personId)?.name}</span>
                                <strong>{Number(payer.amount).toFixed(2)} €</strong>
                              </div>
                            ))}
                          </div>

                          <div className="expenseDetailsBlock expense-items">
                            <strong>{t("billItems")}</strong>
                            {(expense.items ?? []).map((item: any) => (
                              <div className="expenseDetailItem" key={item.id}>
                                <div className="expenseDetailItemTop">
                                  <strong>{item.name}</strong>
                                  <strong>{Number(item.price).toFixed(2)} €</strong>
                                </div>
                                <div className="shareNames">
                                  {(item.shares ?? []).length === 0
                                    ? t("noItemAssigned")
                                    : item.shares.map((share: any) => {
                                        const name = share.person?.name ?? group.people.find((p) => p.id === share.personId)?.name ?? share.personId;
                                        return `${name} (${Number(share.amount).toFixed(2)} €)`;
                                      }).join(", ")}
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="expenseDetailsBlock expense-participants">
                            <strong>{t("selectedParticipants")}</strong>
                            <div className="shareNames">
                              {(expense.shares ?? []).map((share: any) => {
                                const name = share.person?.name ?? group.people.find((p) => p.id === share.personId)?.name ?? share.personId;
                                return `${name} (${Number(share.amount).toFixed(2)} €)`;
                              }).join(", ")}
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
      </section>)}
      
    </main>
  );
};
