import { FormEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { ArrowLeft, Copy, Lock, Plus, Users, X, Dices, Pencil, Clock3, Receipt, ArrowLeftRight } from "lucide-react";
import { ThemeToggle } from "../components/ThemeToggle";
import { api } from "../api";
import { useLanguage } from "../i18n";
import type {
  ExpenseItem,
  ExpenseItemShare,
  ExpensePayer,
  Group,
  SettlementResult,
  Workflow,
} from "../types";
import { RandomSplitWheel } from "../components/RandomSplitWheel";
import { getWhoAmI, saveWhoAmI, saveGroupToLocalStorage } from "../storage";
import { showToast } from "../notifications";

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
  const [workflow,setWorkflow]=useState<Workflow>({
    avatar: "👥",
    archived: false,
    canAdmin: false,
    canOwn: false,
    people: [],
    selections: [],
    transfers: [],
  });
  const [group, setGroup] = useState<Group | null>(null);
  const [personName, setPersonName] = useState("");
  const [showWhoAreYou, setShowWhoAreYou] = useState(false);
  const [activeTab, setActiveTab] = useState<"expenses" | "debts" | "people" | "history">("expenses");
  const [expenseSearch, setExpenseSearch] = useState("");
  const [expenseMonth, setExpenseMonth] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("");
  const [pendingOnly, setPendingOnly] = useState(false);
  const [mineOnly, setMineOnly] = useState(false);
  const [historyFilter, setHistoryFilter] = useState("all");
  const [transferTo, setTransferTo] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferNote, setTransferNote] = useState("");
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState("");
  const [showDrafts, setShowDrafts] = useState(false);
  const [drafts, setDrafts] = useState<DraftBill[]>([]);
  const [actionError, setActionError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [groupChangedNotice, setGroupChangedNotice] = useState(false);
  const [refreshingChanges, setRefreshingChanges] = useState(false);
  const lastChangedAt = useRef<string | null>(null);
  const lastNotifiedChange = useRef<string | null>(null);
  const [settlementData, setSettlementData] = useState<SettlementResult>({
    balances: [],
    settlements: [],
  });
  const skipSettlementRefresh = useRef(false);
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
        lastChangedAt.current = currentGroup.lastChangedAt;
        saveGroupToLocalStorage(currentGroup);
        setGroup({...currentGroup,locked:currentGroup.locked||!!(currentGroup as any).archived});
        const flow=await api.workflow(slug);setWorkflow(flow);
        const mine=flow.people.find(p=>p.mine&&!p.inactive);
        saveWhoAmI(slug,mine?.id??"",mine?.name??null);
        setGroupName(currentGroup.name);
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
      group.accessType !== "REGISTERED_ONLY" &&
      (searchParams.get("chooseParticipant") === "1" || !validSelection);
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
    if (!group) return;
    if (skipSettlementRefresh.current) {
      skipSettlementRefresh.current = false;
      return;
    }
    void loadSettlements();
  }, [group, slug]);

  const refreshSnapshot = async () => {
    const snapshot = await api.getGroupSnapshot(slug);
    lastChangedAt.current = snapshot.group.lastChangedAt;
    lastNotifiedChange.current = snapshot.group.lastChangedAt;
    setGroupChangedNotice(false);
    const nextGroup = {
      ...snapshot.group,
      locked: snapshot.group.locked || !!(snapshot.group as any).archived,
    };
    skipSettlementRefresh.current = true;
    setGroup(nextGroup);
    setWorkflow(snapshot.workflow);
    setDrafts(snapshot.drafts.map(normalizeDraft));
    setSettlementData(snapshot.settlements);
    const mine = snapshot.workflow.people.find((person) => person.mine && !person.inactive);
    saveWhoAmI(slug, mine?.id ?? "", mine?.name ?? null);
    setGroupName(snapshot.group.name);
  };

  const refreshGroupChanges = async () => {
    if (refreshingChanges) return;
    setRefreshingChanges(true);
    try {
      await refreshSnapshot();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : t("somethingWentWrong"),
      );
    } finally {
      setRefreshingChanges(false);
    }
  };

  useEffect(() => {
    if (!group) return;

    let checking = false;
    let localChangePending = false;
    const checkForChanges = async (localChange = false) => {
      if (checking) {
        if (localChange) localChangePending = true;
        return;
      }
      if (document.visibilityState !== "visible") return;
      checking = true;
      try {
        const result = await api.getGroupLastChangedAt(slug);
        if (
          lastChangedAt.current !== null &&
          result.lastChangedAt !== lastChangedAt.current
        ) {
          lastChangedAt.current = result.lastChangedAt;
          if (localChange) {
            lastNotifiedChange.current = result.lastChangedAt;
          } else if (lastNotifiedChange.current !== result.lastChangedAt) {
            lastNotifiedChange.current = result.lastChangedAt;
            setGroupChangedNotice(true);
          }
        }
      } catch (error) {
        console.error("Failed to check for group changes", error);
      } finally {
        checking = false;
        if (localChangePending) {
          localChangePending = false;
          void checkForChanges(true);
        }
      }
    };

    const timer = window.setInterval(() => void checkForChanges(), 15000);
    const checkWhenVisible = () => {
      if (document.visibilityState === "visible") void checkForChanges();
    };
    const checkAfterLocalChange = (event: Event) => {
      if (
        (event as CustomEvent<{ slug: string }>).detail?.slug === slug
      ) {
        void checkForChanges(true);
      }
    };
    document.addEventListener("visibilitychange", checkWhenVisible);
    window.addEventListener("focus", checkWhenVisible);
    window.addEventListener("splitit:group-changed-locally", checkAfterLocalChange);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", checkWhenVisible);
      window.removeEventListener("focus", checkWhenVisible);
      window.removeEventListener("splitit:group-changed-locally", checkAfterLocalChange);
    };
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
  const currentBalance = balances.find((balance) => balance.id === currentParticipantId);
  const outgoingSettlements = settlements.filter((settlement) => settlement.from === currentParticipantId);
  const incomingSettlements = settlements.filter((settlement) => settlement.to === currentParticipantId);
  const filteredExpenses = (group?.expenses ?? []).filter((expense) => {
    const query = expenseSearch.trim().toLocaleLowerCase();
    const matchesSearch = !query || [
      expense.note ?? "",
      ...expense.items.map((item) => item.name),
      ...expense.payers.map((payer) => group?.people.find((person) => person.id === payer.personId)?.name ?? ""),
    ].join(" ").toLocaleLowerCase().includes(query);
    const expenseDate = expense.billDate || expense.createdAt;
    const matchesMonth = !expenseMonth || expenseDate.startsWith(expenseMonth);
    const matchesCategory = !expenseCategory || expense.category === expenseCategory;
    const matchesPending = !pendingOnly || expense.allocationComplete === false || expense.paymentIncomplete;
    const matchesMine = !mineOnly || expense.shares.some((share) => share.personId === currentParticipantId) ||
      expense.payers.some((payer) => payer.personId === currentParticipantId);
    return matchesSearch && matchesMonth && matchesCategory && matchesPending && matchesMine;
  });

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
    if (!group || group.locked) return;
    const nameError = !personName.trim()
      ? t("fieldRequired")
      : personName.trim().length > 60
        ? t("fieldMaxLength").replace("{count}", "60")
        : "";
    if (nameError) {
      setFieldErrors((current) => ({ ...current, personName: nameError }));
      showToast(t("formCorrectionToast"));
      return;
    }
    setFieldErrors((current) => ({ ...current, personName: "" }));

    await executeAction(async () => {
      const nextGroup = await api.addPerson(slug, { name: personName });
      setWorkflow(await api.workflow(slug));
      setPersonName("");
      setActiveTab("people");
      return nextGroup;
    });
  };

  const savePersonName = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingPersonId || !group || group.locked) return;
    const nameError = !personName.trim()
      ? t("fieldRequired")
      : personName.trim().length > 60
        ? t("fieldMaxLength").replace("{count}", "60")
        : "";
    if (nameError) {
      setFieldErrors((current) => ({ ...current, personName: nameError }));
      showToast(t("formCorrectionToast"));
      return;
    }
    setFieldErrors((current) => ({ ...current, personName: "" }));
    try {
      setSaving(true);
      setActionError("");
      await api.updatePerson(slug, editingPersonId, personName.trim());
      setPersonName("");
      setEditingPersonId(null);
      await refreshSnapshot();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t("somethingWentWrong"));
    } finally {
      setSaving(false);
    }
  };

  const setParticipantInactive = async (personId: string, inactive: boolean) => {
    if (!window.confirm(t("participantStatusConfirmation"))) return;
    try {
      setSaving(true);
      setActionError("");
      await api.setPersonInactive(slug, personId, inactive);
      await refreshSnapshot();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t("somethingWentWrong"));
    } finally {
      setSaving(false);
    }
  };

  const recordTransfer = async (event: FormEvent) => {
    event.preventDefault();
    const amount = Number(transferAmount);
    if (!currentParticipantId) {
      setFieldErrors((current) => ({ ...current, participant: t("fieldRequired") }));
      showToast(t("formCorrectionToast"));
      return;
    }
    const errors: Record<string, string> = {};
    if (!transferTo) errors.transferTo = t("fieldRequired");
    if (!transferAmount || !Number.isFinite(amount) || amount <= 0 || !/^\d+(\.\d{1,2})?$/.test(transferAmount)) {
      errors.transferAmount = transferAmount ? t("invalidAmount") : t("fieldRequired");
    }
    setFieldErrors((current) => ({ ...current, ...errors }));
    if (Object.keys(errors).length > 0) {
      showToast(t("formCorrectionToast"));
      return;
    }
    setFieldErrors((current) => ({
      ...current,
      participant: "",
      transferTo: "",
      transferAmount: "",
    }));
    try {
      setSaving(true);
      setActionError("");
      await api.transfer(slug, {
        requestId: crypto.randomUUID(),
        fromId: currentParticipantId,
        toId: transferTo,
        amount,
        note: transferNote.trim() || undefined,
        occurredAt: new Date().toISOString(),
      });
      setTransferAmount("");
      setTransferNote("");
      setTransferTo("");
      await refreshSnapshot();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t("somethingWentWrong"));
    } finally {
      setSaving(false);
    }
  };

  const voidTransfer = async (transferId: string) => {
    if (!window.confirm(t("voidTransferConfirmation"))) return;
    try {
      setSaving(true);
      setActionError("");
      await api.voidTransfer(slug, transferId);
      await refreshSnapshot();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t("somethingWentWrong"));
    } finally {
      setSaving(false);
    }
  };

  const saveGroupName = async (event: FormEvent) => {
    event.preventDefault();
    if (!group || group.locked) return;
    const nameError = !groupName.trim()
      ? t("fieldRequired")
      : groupName.trim().length > 80
        ? t("fieldMaxLength").replace("{count}", "80")
        : "";
    if (nameError) {
      setFieldErrors((current) => ({ ...current, groupName: nameError }));
      showToast(t("formCorrectionToast"));
      return;
    }
    setFieldErrors((current) => ({ ...current, groupName: "" }));
    await executeAction(() => api.updateGroup(slug, groupName.trim()));
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
      {groupChangedNotice && (
        <div className="groupChangedNotice" role="status" aria-live="polite">
          <span>{t("groupChangedNotice")}</span>
          <button
            type="button"
            className="groupChangedRefresh"
            disabled={refreshingChanges}
            onClick={() => void refreshGroupChanges()}
          >
            {t("refreshGroup")}
          </button>
          <button
            type="button"
            className="groupChangedDismiss"
            aria-label={t("dismiss")}
            onClick={() => setGroupChangedNotice(false)}
          >
            <X size={18} />
          </button>
        </div>
      )}

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
          <div className="groupTitleRow">
            <span className="groupAvatar" aria-hidden="true">{workflow.avatar || "👥"}</span>
            <div>
              <h1>{group.name}</h1>
              <p>{group.currency || "EUR"}</p>
            </div>
          </div>

          <div className="groupMetaRow">
            <p className="muted">{group.locked ? t("groupLocked") : ""}</p>
            <button
              type="button"
              className="participantsToggle"
              onClick={() => setActiveTab("people")}
            >
              <Users size={16} />
              <span>{t("participantsLabel")} ({group.people.length})</span>
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

      {showWhoAreYou && createPortal(
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
                  disabled={saving || !!workflow.people.find((member) => member.id === person.id && (member.inactive || (member.claimed && !member.mine)))}
                  onClick={() => void chooseParticipant(person.id)}
                >
                  {person.name}
                </button>
              ))}
            </div>
          </section>
        </div>,
        document.body,
      )}

      <nav className="groupTabBar" role="tablist" aria-label={t("groupSections")}>
        {([
          ["expenses", t("groupTabExpenses"), Receipt],
          ["debts", t("groupTabDebts"), ArrowLeftRight],
          ["people", t("groupTabPeople"), Users],
          ["history", t("groupTabHistory"), Clock3],
        ] as const).map(([id, label, Icon]) => (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            className={`groupTab${activeTab === id ? " groupTabActive" : ""}`}
            key={id}
            onClick={() => setActiveTab(id)}
          >
            <Icon size={17} aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
        {activeTab === "expenses" && !group.locked && !workflow.archived && group.people.length > 0 && currentParticipantId && (
          <Link className="primaryButton compactButton groupAddExpense" to={`/g/${slug}/add-expense`}>
            <Plus size={18} /> {t("addExpense")}
          </Link>
        )}
      </nav>

      {activeTab === "debts" && (
        <section className="groupTabContent">
          <section className="card">
            <div className="sectionHeaderWithButton">
              <div>
                <h2>{t("myBalance")}</h2>
                <p className="muted">{currentParticipant?.name ?? t("selectYourParticipant")}</p>
              </div>
              {currentBalance && (
                <strong className={`groupBalanceAmount${currentBalance.balance < 0 ? " groupBalanceDebt" : ""}`}>
                  {currentBalance.balance > 0 ? "+" : ""}{currentBalance.balance.toFixed(2)} {group.currency || "EUR"}
                </strong>
              )}
            </div>
            {!currentParticipantId && group.accessType !== "REGISTERED_ONLY" ? (
              <button className="secondaryButton" onClick={() => setShowWhoAreYou(true)}>{t("whoAreYou")}</button>
            ) : !currentParticipantId ? (
              <p className="muted">{t("registeredParticipantsAutoAdded")}</p>
            ) : outgoingSettlements.length || incomingSettlements.length ? (
              <div className="list">
                {outgoingSettlements.map((settlement, index) => (
                  <div className="settlement groupOwes" key={`out-${index}`}>
                    <span>{t("youOwe")} {settlement.toName}</span>
                    <strong>{settlement.amount.toFixed(2)} {group.currency || "EUR"}</strong>
                  </div>
                ))}
                {incomingSettlements.map((settlement, index) => (
                  <div className="settlement groupOwed" key={`in-${index}`}>
                    <span>{settlement.fromName} {t("owesYou")}</span>
                    <strong>{settlement.amount.toFixed(2)} {group.currency || "EUR"}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <p className="success">{t("everythingBalanced")}</p>
            )}
          </section>

          <section className="card">
            <h2>{t("groupBalances")}</h2>
            <p className="muted">{t("totalSpent")}: {group.expenses.reduce((sum, expense) => sum + Number(expense.totalAmount), 0).toFixed(2)} {group.currency || "EUR"}</p>
            <div className="list">
              {balances.map((balance) => (
                <div className="settlement" key={balance.id}>
                  <span>{balance.name}</span>
                  <strong className={balance.balance < 0 ? "groupBalanceDebt" : ""}>
                    {balance.balance > 0 ? "+" : ""}{balance.balance.toFixed(2)} {group.currency || "EUR"}
                  </strong>
                </div>
              ))}
            </div>
            <h3>{t("whoOwesWhom")}</h3>
            {settlements.length === 0 ? <p className="success">{t("everythingBalanced")}</p> : (
              <div className="list">
                {settlements.map((settlement, index) => (
                  <div className="settlement" key={`settlement-${index}`}>
                    <span>{settlement.fromName} → {settlement.toName}</span>
                    <strong>{settlement.amount.toFixed(2)} {group.currency || "EUR"}</strong>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card">
            <h2>{t("repaymentRecords")}</h2>
            <p className="muted">{t("repaymentRecordsHint")}</p>
            <form className="repaymentForm" onSubmit={(event) => void recordTransfer(event)} noValidate>
              <label>
                {t("paidTo")}
                <select value={transferTo} onChange={(event) => {
                  const personId = event.target.value;
                  setTransferTo(personId);
                  setFieldErrors((current) => ({ ...current, transferTo: "" }));
                  const suggested = settlements.find((settlement) => settlement.from === currentParticipantId && settlement.to === personId);
                  setTransferAmount(suggested ? String(suggested.amount) : "");
                }} disabled={!currentParticipantId || group.locked || workflow.archived} aria-invalid={Boolean(fieldErrors.transferTo)}>
                  <option value="">{t("chooseParticipant")}</option>
                  {group.people.filter((person) => person.id !== currentParticipantId && !workflow.people.find((member) => member.id === person.id)?.inactive).map((person) => (
                    <option key={person.id} value={person.id}>{person.name}</option>
                  ))}
                </select>
                {fieldErrors.transferTo && <span className="validationMessage">{fieldErrors.transferTo}</span>}
              </label>
              <label>
                {t("amountPaid")} ({group.currency || "EUR"})
                <input type="number" min="0.01" step="0.01" value={transferAmount} onChange={(event) => {
                  setTransferAmount(event.target.value);
                  setFieldErrors((current) => ({ ...current, transferAmount: "" }));
                }} disabled={!currentParticipantId || group.locked || workflow.archived} aria-invalid={Boolean(fieldErrors.transferAmount)} />
                {fieldErrors.transferAmount && <span className="validationMessage">{fieldErrors.transferAmount}</span>}
              </label>
              <label>
                {t("note")}
                <input value={transferNote} maxLength={200} onChange={(event) => setTransferNote(event.target.value)} disabled={!currentParticipantId || group.locked || workflow.archived} />
              </label>
              <button className="primaryButton" type="submit" disabled={saving || group.locked || workflow.archived}>
                {t("saveRepayment")}
              </button>
            </form>
            {!currentParticipantId && <p className={fieldErrors.participant ? "validationMessage" : "muted"}>{t("selectParticipantToRecordRepayment")}</p>}
            {!workflow.transfers.length && <p className="muted">{t("noRepaymentRecords")}</p>}
            <div className="list repaymentList">
              {workflow.transfers.map((transfer) => (
                <article className={`repaymentRow${transfer.voidedAt ? " repaymentVoided" : ""}`} key={transfer.id}>
                  <div>
                    <strong>{group.people.find((person) => person.id === transfer.fromId)?.name ?? t("someone")} → {group.people.find((person) => person.id === transfer.toId)?.name ?? t("someone")}</strong>
                    <small>{formatLocalDateTime(transfer.occurredAt)}{transfer.voidedAt ? ` · ${t("voided")}` : ""}</small>
                    {transfer.note && <small>{transfer.note}</small>}
                  </div>
                  <div className="repaymentAmount">
                    <strong>{Number(transfer.amount).toFixed(2)} {group.currency || "EUR"}</strong>
                    {transfer.canManage && !transfer.voidedAt && (
                      <button type="button" className="secondaryButton compact" disabled={group.locked || workflow.archived || saving} onClick={() => void voidTransfer(transfer.id)}>{t("voidRepayment")}</button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </section>
      )}

      {activeTab === "people" && (
        <section className="groupTabContent">
          <section className="card">
            <div className="sectionHeaderWithButton">
              <div><h2>{t("participantsPanelTitle")}</h2><p className="muted">{group.people.length} {t("participantsLabel").toLocaleLowerCase()}</p></div>
              <button type="button" className="secondaryButton compact" onClick={() => void navigator.clipboard.writeText(`${window.location.origin}/join?code=${group.code}`)}><Copy size={16} /> {t("copyLink")}</button>
            </div>
            {group.accessType === "REGISTERED_ONLY" ? (
              <p className="muted">{t("registeredParticipantsAutoAdded")}</p>
            ) : (
              <>
                <h3>{t("whoAreYou")}</h3>
                <p className="muted">{t("selectYourParticipant")}</p>
                <div className="participantChoices">
                  {group.people.filter((person) => !workflow.people.find((member) => member.id === person.id)?.inactive).map((person) => {
                    const member = workflow.people.find((entry) => entry.id === person.id);
                    return (
                      <button
                        className={`participantChoice${person.id === currentParticipantId ? " participantChoiceSelected" : ""}`}
                        type="button"
                        key={person.id}
                        disabled={saving || Boolean(member?.claimed && !member.mine)}
                        onClick={() => void chooseParticipant(person.id)}
                      >
                        {person.name}{person.id === currentParticipantId ? ` · ${t("youAre")}` : ""}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </section>
          <section className="card">
            {group.accessType !== "REGISTERED_ONLY" && (
              <>
                <h2>{editingPersonId ? t("editParticipant") : t("addParticipant")}</h2>
                <form className="inlineInput addParticipantForm" onSubmit={editingPersonId ? savePersonName : addPerson} noValidate>
                  <input
                    placeholder={t("addParticipantInput")}
                    value={personName}
                    onChange={(event) => {
                      setPersonName(event.target.value);
                      setFieldErrors((current) => ({ ...current, personName: "" }));
                    }}
                    maxLength={60}
                    disabled={group.locked || saving}
                    aria-invalid={Boolean(fieldErrors.personName)}
                  />
                  {fieldErrors.personName && <span className="validationMessage">{fieldErrors.personName}</span>}
                  <button className="primaryButton" type="submit" disabled={group.locked || saving}>
                    {editingPersonId ? t("saveChanges") : <><Plus size={18} /> {t("addParticipant")}</>}
                  </button>
                  {editingPersonId && <button type="button" className="secondaryButton" onClick={() => { setEditingPersonId(null); setPersonName(""); }}>{t("cancel")}</button>}
                </form>
              </>
            )}
            <div className="list participantManagementList">
              {group.people.map((person) => {
                const member = workflow.people.find((entry) => entry.id === person.id);
                return (
                  <article className={`participantManagementRow${member?.inactive ? " participantInactive" : ""}`} key={person.id}>
                    <div><strong>{person.name}{person.id === currentParticipantId ? ` · ${t("youAre")}` : ""}</strong><small>{person.payments.length} {person.payments.length === 1 ? t("expense") : t("expenses")}{member?.inactive ? ` · ${t("inactive")}` : ""}</small></div>
                    {group.accessType !== "REGISTERED_ONLY" && <div className="participantActions">
                      <button type="button" className="secondaryButton compact" disabled={group.locked || !workflow.canAdmin || saving} onClick={() => { setEditingPersonId(person.id); setPersonName(person.name); }}>{t("edit")}</button>
                      <button type="button" className="secondaryButton compact" disabled={group.locked || !workflow.canAdmin || saving} onClick={() => void setParticipantInactive(person.id, !member?.inactive)}>{member?.inactive ? t("reactivate") : t("deactivate")}</button>
                    </div>}
                  </article>
                );
              })}
            </div>
          </section>
          <section className="card">
            <h2>{t("groupSettings")}</h2>
            <form className="inlineInput" onSubmit={(event) => void saveGroupName(event)} noValidate>
              <input value={groupName} onChange={(event) => {
                setGroupName(event.target.value);
                setFieldErrors((current) => ({ ...current, groupName: "" }));
              }} maxLength={80} disabled={group.locked || !workflow.canAdmin || saving} aria-label={t("groupName")} aria-invalid={Boolean(fieldErrors.groupName)} />
              {fieldErrors.groupName && <span className="validationMessage">{fieldErrors.groupName}</span>}
              <button type="submit" className="secondaryButton" disabled={group.locked || !workflow.canAdmin || saving}>{t("saveChanges")}</button>
            </form>
            <p className="muted">{group.locked ? t("groupLocked") : ""}</p>
          </section>
        </section>
      )}

      {activeTab === "history" && (
        <section className="groupTabContent">
          <section className="card">
            <h2>{t("groupHistory")}</h2>
            <div className="groupHistoryFilters" role="group" aria-label={t("historyFilters")}>
              {[
                ["all", t("allActivity")],
                ["EXPENSE", t("expenses")],
                ["TRANSFER", t("repaymentRecords")],
                ["PERSON", t("participantsLabel")],
              ].map(([filter, label]) => (
                <button type="button" className={`secondaryButton compact${historyFilter === filter ? " filterSelected" : ""}`} key={filter} onClick={() => setHistoryFilter(filter)} aria-pressed={historyFilter === filter}>{label}</button>
              ))}
            </div>
            {!(group.history ?? []).filter((entry) => historyFilter === "all" || entry.entity === historyFilter).length ? (
              <p className="muted">{t("noActivityYet")}</p>
            ) : (
              <div className="list">
                {(group.history ?? []).filter((entry) => historyFilter === "all" || entry.entity === historyFilter).map((entry) => (
                  <article className="groupHistoryEntry" key={entry.id}>
                    <span className="groupHistoryIcon">{entry.entity === "EXPENSE" ? <Receipt size={18} /> : entry.entity === "TRANSFER" ? <ArrowLeftRight size={18} /> : <Users size={18} />}</span>
                    <div><strong>{entry.message}</strong><small>{formatLocalDateTime(entry.createdAt)} · {entry.action.toLocaleLowerCase()}</small></div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </section>
      )}

      {activeTab === "expenses" && (
        <section id="expenses-container">
          <div className="grid">
            <section className="card">
              <div className="sectionHeaderWithButton">
                <div>
                  <h2>{t("expenses")}</h2>
                  <p className="muted">{group.expenses.length} · {group.expenses.reduce((sum, expense) => sum + Number(expense.totalAmount), 0).toFixed(2)} {group.currency || "EUR"}</p>
                </div>
              </div>
              <div className="expenseBalanceSummary">
                <span>{currentParticipant ? `${t("myBalance")} · ${currentParticipant.name}` : t("selectYourParticipant")}</span>
                <strong>{currentBalance ? `${currentBalance.balance > 0 ? "+" : ""}${currentBalance.balance.toFixed(2)} ${group.currency || "EUR"}` : "—"}</strong>
                <button type="button" className="textButton" onClick={() => setActiveTab("debts")}>{t("groupTabDebts")}</button>
              </div>
              <div className="expenseFilters">
                <input aria-label={t("searchExpenses")} placeholder={t("searchExpenses")} value={expenseSearch} onChange={(event) => setExpenseSearch(event.target.value)} />
                <label>{t("monthFilter")}<input type="month" value={expenseMonth} onChange={(event) => setExpenseMonth(event.target.value)} /></label>
                <label>{t("categoryFilter")}<select value={expenseCategory} onChange={(event) => setExpenseCategory(event.target.value)}><option value="">{t("allCategories")}</option><option value="other">{t("categoryOther")}</option><option value="food">{t("categoryFood")}</option><option value="travel">{t("categoryTravel")}</option><option value="home">{t("categoryHome")}</option><option value="fun">{t("categoryFun")}</option><option value="taxi">{t("categoryTaxi")}</option><option value="shopping">{t("categoryShopping")}</option><option value="health">{t("categoryHealth")}</option></select></label>
                <button type="button" className={`secondaryButton compact${pendingOnly ? " filterSelected" : ""}`} aria-pressed={pendingOnly} onClick={() => setPendingOnly((value) => !value)}>{t("pendingExpenses")} ({group.expenses.filter((expense) => expense.allocationComplete === false || expense.paymentIncomplete).length})</button>
                <button type="button" className={`secondaryButton compact${mineOnly ? " filterSelected" : ""}`} aria-pressed={mineOnly} onClick={() => setMineOnly((value) => !value)} disabled={!currentParticipantId}>{t("myExpenses")}</button>
                {(expenseSearch || expenseMonth || expenseCategory || pendingOnly || mineOnly) && <button type="button" className="textButton" onClick={() => { setExpenseSearch(""); setExpenseMonth(""); setExpenseCategory(""); setPendingOnly(false); setMineOnly(false); }}>{t("clearFilters")}</button>}
              </div>
              {(() => {
                  const expenses = filteredExpenses;
                  if (group.expenses.length === 0)
                    return <p className="muted">{t("noExpensesYet")}</p>;
                  if (expenses.length === 0)
                    return <p className="muted">{t("noExpensesMatch")}</p>;
                  return (
                    <div className="list">
                      {expenses.map((expense) => {
                        const expanded = expandedExpenses.has(expense.id);
                        const currentPayerTotal = expense.payers
                          .filter((payer) => payer.personId === currentParticipantId)
                          .reduce((sum, payer) => sum + Number(payer.amount), 0);
                        const currentShare = expense.shares.find(
                          (share) => share.personId === currentParticipantId,
                        )?.amount ?? 0;
                        const currentNet = currentPayerTotal - Number(currentShare);
                        const currentInvolved = currentPayerTotal > 0 || Number(currentShare) > 0;
                        return (
                          <div className="expenseCard" key={expense.id}>
                            <div className="expenseSummaryRow">
                              <button
                                type="button"
                                className="expenseSummary"
                                aria-expanded={expanded}
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
                                  {expense.allocationComplete === false && (
                                    <small className="expenseStatusPending">
                                      {t("expenseAwaitingSplit")} · {expense.unassignedCount}/{expense.items.length} {t("itemsCount")}
                                    </small>
                                  )}
                                  {expense.paymentIncomplete && (
                                    <small className="expenseStatusPending">{t("expenseCheckPayers")}</small>
                                  )}
                                  <small>
                                    {formatLocalDateTime(expense.createdAt)} ·{" "}
                                    {expense.items?.length ?? 0} {t("itemsCount")}
                                  </small>
                                  {currentParticipant && (
                                    <small className={`expensePersonalStatus${currentInvolved ? currentNet < 0 ? " expenseDebt" : "" : " muted"}`}>
                                      {!currentInvolved
                                        ? t("expenseNotInvolved")
                                        : currentNet > 0
                                          ? `${t("expenseYouLent")} ${currentNet.toFixed(2)} ${group.currency || "EUR"}`
                                          : currentNet < 0
                                            ? `${t("expenseYouOwe")} ${Math.abs(currentNet).toFixed(2)} ${group.currency || "EUR"}`
                                            : t("expenseSettled")}
                                    </small>
                                  )}
                                </div>
                                <strong className="expenseSummaryAmount">
                                  {Number(expense.totalAmount || 0).toFixed(2)} {group?.currency||"EUR"}
                                </strong>
                              </button>
                              {expense.canManage && (
                                <button
                                  type="button"
                                  className="expenseEditButton"
                                  aria-label={`${t("editExpense")}: ${expense.note || t("expense")}`}
                                  title={t("editExpense")}
                                  disabled={group.locked}
                                  onClick={() => navigate(`/g/${slug}/add-expense?edit=${encodeURIComponent(expense.id)}`)}
                                >
                                  <Pencil size={17} aria-hidden="true" />
                                </button>
                              )}
                            </div>

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
                                        {item.splitMode === "units" ? <label>{t("myUnits")}
                                          <select aria-label={`Moja količina: ${item.name}`} disabled={group.locked||saving||!currentParticipantId}
                                            value={item.shares.find(s=>s.personId===currentParticipantId)?.units||0}
                                            onChange={async event=>{const units=Number(event.target.value);setSaving(true);setActionError("");try{await api.ownItem(slug,expense.id,item.id,units,true);await refreshSnapshot();}catch(e){setActionError(e instanceof Error?e.message:"Error");}finally{setSaving(false);}}}>
                                            {Array.from({length:Math.max(0,(item.quantity||1)-item.shares.filter(s=>s.personId!==currentParticipantId).reduce((n,s)=>n+(s.units||0),0))+1},(_,n)=><option key={n} value={n}>{n}</option>)}
                                          </select>
                                          <span> {t("remainingUnits")}: {Math.max(0,(item.quantity||1)-item.shares.reduce((n,s)=>n+(s.units||0),0))}</span>
                                        </label> : <>
                                        <label>
                                          <input
                                            className="expenseSelectionCheckbox"
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
                                                await refreshSnapshot();
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
                                          {t("myItem")}
                                        </label>
                                        </>}
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
                                                    return `${name}${item.splitMode==="units"?` · ${share.units} kom.`:""} (${Number(share.amount).toFixed(2)} ${group?.currency||"EUR"})`;
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
