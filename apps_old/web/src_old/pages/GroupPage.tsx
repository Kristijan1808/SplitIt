import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Copy, Lock, Plus, Users } from "lucide-react";
import { ThemeToggle } from "../components/ThemeToggle";
import { api } from "../api";
import { useLanguage } from "../i18n";
import { calculateSettlements } from "@splitit/shared";
import type { Group } from "@splitit/shared";

type DraftBill = {
  id: string;
  note?: string | null;
  payerPersonId?: string | null;
  paidAmount?: number | null;
  createdAt: string;
  items: Array<{ id: string; name: string; price: number; assignedPersonId?: string | null }>;
};

const getStoredGroupParticipantId = (slug: string) => {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(`splititGroupParticipantId:${slug}`);
};

const setStoredGroupParticipantId = (slug: string, participantId: string) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`splititGroup:${slug}`, slug);
  window.localStorage.setItem(`splititGroupParticipantId:${slug}`, participantId);
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
  const [showExpenses, setShowExpenses] = useState(true);
  const [drafts, setDrafts] = useState<DraftBill[]>([]);
  const [actionError, setActionError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const currentGroup = await api.getGroup(slug);
        setGroup(currentGroup);
      } catch {
        navigate("/");
      }
    };

    void load();
  }, [slug, navigate]);

  useEffect(() => {
    if (!group) return;

    const storedParticipantId = getStoredGroupParticipantId(slug);
    const validSelection = storedParticipantId && group.people.some((person) => person.id === storedParticipantId);
    const shouldPrompt = searchParams.get("chooseParticipant") === "1" || !validSelection;
    setShowWhoAreYou(shouldPrompt);
  }, [group, slug, searchParams]);

  useEffect(() => {
    const loadDrafts = async () => {
      try {
        const nextDrafts = await api.getDraftExpenses(slug);
        setDrafts(nextDrafts);
      } catch {
        setDrafts([]);
      }
    };

    void loadDrafts();
  }, [slug]);

  const balances = useMemo(() => {
    if (!group) return [];

    const entries = group.people.map((person) => ({
      id: person.id,
      name: person.name,
      paid: person.payments.reduce((sum, payment) => sum + payment.amount, 0),
      balance: 0
    }));

    const totalPaid = entries.reduce((sum, entry) => sum + entry.paid, 0);
    const share = totalPaid / Math.max(entries.length, 1);

    return entries.map((entry) => ({ ...entry, balance: Number((entry.paid - share).toFixed(2)) }));
  }, [group]);

  const settlements = useMemo(() => {
    if (!group) return [];

    return calculateSettlements(
      group.people.map((person) => ({
        id: person.id,
        name: person.name,
        paid: person.payments.reduce((sum, payment) => sum + payment.amount, 0)
      }))
    ).settlements;
  }, [group]);

  const setGroupState = (nextGroup: Group) => {
    setGroup(nextGroup);
    setPersonName("");
  };

  const chooseParticipant = (participantId: string) => {
    setStoredGroupParticipantId(slug, participantId);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("chooseParticipant");
      return next;
    });
    setShowWhoAreYou(false);
  };

  const updateDraftAssignment = async (draftId: string, itemId: string, personId: string) => {
    try {
      const nextDraft = await api.updateDraftExpenseItem(slug, draftId, itemId, {
        assignedPersonId: personId || null
      });
      setDrafts((current) => current.map((draft) => draft.id === draftId ? nextDraft : draft));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t("somethingWentWrong"));
    }
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
      const refreshedGroup = await api.confirmDraftExpense(slug, draftId);
      setDrafts((current) => current.filter((draft) => draft.id !== draftId));
      setGroup(refreshedGroup);
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
            <p className="muted">{group.locked ? t("groupLocked") : t("groupOpen")}</p>
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

      <div className="grid">
        <section className="card">
          <div className="sectionHeaderWithButton">
            <h2>{t("summary")}</h2>
            <Link className="primaryButton compactButton" to={`/g/${slug}/add-expense`}>
              <Plus size={18} /> {t("addExpense")}
            </Link>
          </div>
          <div className="summaryHint">
            <p className="muted">{t("shareSummary")}</p>
          </div>
        </section>

        <section className="card resultCard">
          <h2>{t("balances")}</h2>
          <div className="stats">
            <div>
              <small>{t("totalSpent")}</small>
              <strong>{balances.reduce((sum, balance) => sum + balance.paid, 0).toFixed(2)}</strong>
            </div>
            <div>
              <small>{t("eachShare")}</small>
              <strong>{(balances.reduce((sum, balance) => sum + balance.paid, 0) / Math.max(balances.length, 1)).toFixed(2)}</strong>
            </div>
          </div>
          {settlements.length === 0 ? (
            <p className="success">{t("everythingBalanced")}</p>
          ) : (
            <div className="list">
              {settlements.map((settlement, index) => (
                <div className="settlement" key={index}>
                  <span>{settlement.from}</span>
                  <strong>→ {settlement.to}</strong>
                  <em>{settlement.amount.toFixed(2)}</em>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {drafts.length > 0 && (
        <div className="grid">
          <section className="card">
            <div className="sectionHeaderWithButton">
              <h2>{t("draftBills")}</h2>
            </div>
            <div className="list">
              {drafts.map((draft) => (
                <div key={draft.id} className="paymentRow">
                  <div className="contentRow" style={{ display: "block" }}>
                    <strong>{draft.note || t("draftBill")}</strong>
                    <small>{formatLocalDateTime(draft.createdAt)}</small>
                    <div className="list" style={{ marginTop: 12 }}>
                      {draft.items.map((item) => (
                        <div key={item.id} className="settlement" style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 1.3fr", gap: 8 }}>
                          <span>{item.name}</span>
                          <em>{Number(item.price || 0).toFixed(2)}</em>
                          <select
                            value={item.assignedPersonId ?? ""}
                            onChange={(event) => updateDraftAssignment(draft.id, item.id, event.target.value)}
                          >
                            <option value="">{t("noItemAssigned")}</option>
                            {group.people.map((person) => (
                              <option key={person.id} value={person.id}>{person.name}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                    <button type="button" className="primaryButton" style={{ marginTop: 12 }} onClick={() => finalizeDraft(draft.id)}>
                      {t("confirmSelection")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      <div className="grid">
        <section className="card">
          <div className="sectionHeaderWithButton">
            <h2>{t("expenses")}</h2>
            <button type="button" className="secondaryButton compactButton" onClick={() => setShowExpenses((current) => !current)}>
              {showExpenses ? t("hideExpenses") : t("showExpenses")}
            </button>
          </div>
          {showExpenses && (
            <div className="list">
              {group.payments.length === 0 ? (
                <p className="muted">{t("noExpensesYet")}</p>
              ) : (
                group.payments.map((payment) => (
                  <div className="paymentRow" key={payment.id}>
                    <div className="contentRow">
                      <strong>{payment.amount.toFixed(2)}</strong>
                      <span className="margin-left-4">
                        <small>{formatPaymentLine(payment)}</small>
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
};
