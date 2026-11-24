import {BillReveal} from "../components/BillReveal";
import {GroupAdminTools,groupSettingsCopy} from "../components/GroupAdminTools";
import {avInner} from "../components/PersonAv";
import {pendingBills,snapshotForEditor,syncBills} from "../offlineBills";
import {CategoryIcon,inferCategory} from "../components/ExpenseCategory";
import "../styles/receiptParity.css";
import {ReceiptItem} from "../components/ReceiptItem";
import {HistoryList} from "../components/HistoryList";
import { FormEvent, Fragment, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { Camera, ArrowLeft, Copy, Lock, Plus, Users, X, Pencil, Clock3, Receipt, ArrowLeftRight, Search, SlidersHorizontal, CloudOff, LogOut } from "lucide-react";
import { api } from "../api";
import { useLanguage } from "../i18n";
import type {
  ExpenseItem,

  Group,
  SettlementResult,
  Workflow,
} from "../types";
import { getWhoAmI, saveWhoAmI, saveGroupToLocalStorage, clearWhoAmI, removeSavedGroup } from "../storage";
import { ConfirmationModal } from "../components/ConfirmationModal";
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
  const { t, locale, language } = useLanguage();
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
  const [activeTab, setActiveTab] = useState<"expenses" | "debts" | "people" | "history">(() => (new URLSearchParams(window.location.search).get("tab") === "debts" ? "debts" : "expenses"));
  const [expenseSearch, setExpenseSearch] = useState("");
  const [expenseMonth, setExpenseMonth] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("");
  const [pendingOnly, setPendingOnly] = useState(false);
  const [mineOnly, setMineOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [historyFilter, setHistoryFilter] = useState("all");
  const [transferTo, setTransferTo] = useState(() => new URLSearchParams(window.location.search).get("to") ?? "");
  const [transferAmount, setTransferAmount] = useState(() => new URLSearchParams(window.location.search).get("amount") ?? "");
  const [transferNote, setTransferNote] = useState("");
  const [transferDir, setTransferDir] = useState<"out" | "in">("out");
  const [paySheet, setPaySheet] = useState(() => new URLSearchParams(window.location.search).get("pay") === "1");
  const [claimId, setClaimId] = useState<string | null>(() => new URLSearchParams(window.location.search).get("expense"));
  const [detailSlot, setDetailSlot] = useState<HTMLElement | null>(null);
  const [isDesk, setIsDesk] = useState(() => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const on = () => setIsDesk(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const autoPicked = useRef(false);
  const [personSheet, setPersonSheet] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const personSubmitted = useRef(false);
  const [remindTarget, setRemindTarget] = useState<{ name: string; amount: number } | null>(null);
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

  const avatarOf=(id?:string|null)=>id?workflow.people.find(p=>p.id===id)?.avatar??null:null;
  const [leaveAsk,setLeaveAsk]=useState(false);
  const [pending,setPending]=useState<{count:number,error?:string,rows:{key:string,title:string,total:number,currency:string,error?:string}[]}>({count:0,rows:[]});
  useEffect(()=>{
    let live=true;
    const load=()=>refreshSnapshot(()=>live).catch(()=>{if(live)navigate("/")});
    const count=()=>pendingBills(slug).then(rows=>{if(live)setPending({count:rows.length,error:rows.find(x=>x.row.error)?.row.error,rows:rows.map(({key,row})=>({key,title:row.body.note||t("expense"),total:row.body.payers.reduce((a,p)=>a+Number(p.amount),0),currency:row.body.currency||row.base,error:row.error}))})}).catch(()=>{});
    const uploaded=(e:Event)=>{if((e as CustomEvent).detail===slug)void load()};
    void load();void count();
    window.addEventListener("splitit:queue",count);window.addEventListener("splitit:uploaded",uploaded);
    return()=>{live=false;window.removeEventListener("splitit:queue",count);window.removeEventListener("splitit:uploaded",uploaded)};
  },[slug,navigate]);
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

  const refreshSnapshot = async (valid=()=>true) => {
    const snapshot = await snapshotForEditor(slug);
    if(!valid())return;
    saveGroupToLocalStorage(snapshot.group);
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

  useEffect(() => {
    if (personSubmitted.current && personName === "") { personSubmitted.current = false; setPersonSheet(false); }
  }, [personName]);

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
        fromId: transferDir === "in" ? transferTo : currentParticipantId,
        toId: transferDir === "in" ? currentParticipantId : transferTo,
        amount,
        note: transferNote.trim() || undefined,
        occurredAt: new Date().toISOString(),
      });
      setTransferAmount("");
      setTransferNote("");
      setTransferTo("");
      setPaySheet(false);
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

  const fmtMoney = (n: number) => n.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + ((group?.currency || "EUR") === "EUR" ? "€" : group?.currency);
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

  useEffect(() => {
    if (!group || !isDesk || autoPicked.current || claimId || activeTab !== "expenses") return;
    const first = [...(group.expenses ?? [])].sort((a, b) => String(b.billDate ?? b.createdAt).localeCompare(String(a.billDate ?? a.createdAt)))[0];
    if (first) { autoPicked.current = true; setClaimId(first.id); }
  }, [group, isDesk, claimId, activeTab]);

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

      

      <Link className="backLink" to="/">
        <ArrowLeft size={18} /> {t("home")}
      </Link>

      <section className="groupHeader">
        <div>
          <p className="eyebrow">
            {t("code")}: {group.code}
          </p>
          <div className="groupTitleRow">
            <span className="groupAvatar" aria-hidden="true">{workflow.avatar?.startsWith("data:image/") ? <img src={workflow.avatar} alt="" /> : (workflow.avatar || "👥")}</span>
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
      </nav>
        {activeTab === "expenses" && !group.locked && !workflow.archived && group.people.length > 0 && currentParticipantId && (
          <div className="flActions"><Link className="secondaryButton" to={`/g/${slug}/add-expense?scan=1`}><Camera size={18}/>{t("scanBill")}</Link><Link className="primaryButton" to={`/g/${slug}/add-expense`}>
            <Plus size={18} /> {t("addExpense")}
          </Link></div>
        )}
      

      {activeTab === "debts" && (
        <section className="groupTabContent zPage">
          <div className="zCols">
          <div className="zPage">
            <div className="zHero"><small>{t("settleHeroLabel")}</small><strong>{settlements.length} {t("settleHeroPayments")}</strong></div>
            <div className="zCard">
              {settlements.length === 0 ? <p className="zPos">{t("everythingBalanced")}</p> : settlements.map((settlement, index) => {
                const mine = settlement.from === currentParticipantId;
                const owedToMe = settlement.to === currentParticipantId;
                return (
                  <div className="zRow zSettleRow" key={`settlement-${index}`}>
                    <i className={`zAv c${(index % 4) + 1}`}>{avInner(settlement.fromName,avatarOf(settlement.from))}</i>
                    <div className="grow"><b className="zSettleNames">{settlement.fromName} → {settlement.toName}</b><span className="zMuted">{settlement.amount.toFixed(2).replace(".", ",")} {(group.currency || "EUR") === "EUR" ? "€" : group.currency}</span></div>
                    {mine && <button type="button" className="zPill" disabled={group.locked || workflow.archived} onClick={() => { setTransferDir("out"); setTransferTo(settlement.to); setTransferAmount(String(settlement.amount)); setPaySheet(true); }}>{t("recordShort")}</button>}
                    {owedToMe && <button type="button" className="zPill" disabled={group.locked || workflow.archived} onClick={() => { setTransferDir("in"); setTransferTo(settlement.from); setTransferAmount(String(settlement.amount)); setPaySheet(true); }}>{t("receivedShort")}</button>}
                    {owedToMe && <button type="button" className="zPill zPillGhost" onClick={() => setRemindTarget({ name: settlement.fromName, amount: settlement.amount })}>{t("remindShort")}</button>}
                  </div>
                );
              })}
            </div>
            <div className="zCard">
              <div className="zRow" style={{ padding: 0 }}><div className="grow"><h2 className="zH2">{t("repaymentRecords")}</h2><span className="zMuted">{t("repaymentRecordsHint")}</span></div>
                <button type="button" className="zPill" disabled={!currentParticipantId || group.locked || workflow.archived} onClick={() => setPaySheet(true)}>+ {t("recordShort")}</button></div>
              {!currentParticipantId && <p className={fieldErrors.participant ? "validationMessage" : "zMuted"}>{t("selectParticipantToRecordRepayment")}</p>}
              {!workflow.transfers.length && <p className="zMuted">{t("noRepaymentRecords")}</p>}
              {workflow.transfers.map((transfer) => (
                <div className="zRow" key={transfer.id} style={transfer.voidedAt ? { opacity: 0.5 } : undefined}>
                  <div className="grow"><b>{group.people.find((person) => person.id === transfer.fromId)?.name ?? t("someone")} → {group.people.find((person) => person.id === transfer.toId)?.name ?? t("someone")}</b>
                    <span className="zMuted">{formatLocalDateTime(transfer.occurredAt)}{transfer.voidedAt ? ` · ${t("voided")}` : ""}{transfer.note ? ` · ${transfer.note}` : ""}</span></div>
                  <span className="zPos">{Number(transfer.amount).toFixed(2).replace(".", ",")} €</span>
                  {transfer.canManage && !transfer.voidedAt && <button type="button" className="zPill" disabled={group.locked || workflow.archived || saving} onClick={() => void voidTransfer(transfer.id)}>{t("voidRepayment")}</button>}
                </div>
              ))}
            </div>
          </div>
          <div className="zCard"><h2 className="zH2">{t("groupBalances")}</h2><span className="zMuted">{t("totalSpent")}: {group.expenses.reduce((sum, expense) => sum + Number(expense.totalAmount), 0).toFixed(2).replace(".", ",")} €</span>
            {balances.map((balance, index) => (
              <div className="zRow" key={balance.id}><i className={`zAv c${(index % 4) + 1}`}>{avInner(balance.name,avatarOf(balance.id))}</i><b className="grow">{balance.name}</b>
                <span className={balance.balance < 0 ? "zNeg" : "zPos"}>{balance.balance > 0 ? "+" : ""}{balance.balance.toFixed(2).replace(".", ",")} €</span></div>
            ))}
          </div>
          </div>

          {paySheet && (
            <div className="zOverlay" onClick={() => setPaySheet(false)}>
              <form className="zSheet" onClick={(event) => event.stopPropagation()} onSubmit={(event) => void recordTransfer(event)} noValidate>
                <h2 className="zH2">{t("saveRepayment")}</h2><span className="zMuted">{t("repaymentRecordsHint")}</span>
                <div className="zSeg2" role="radiogroup" aria-label={t("saveRepayment")}>
                  <button type="button" role="radio" aria-checked={transferDir === "out"} className={transferDir === "out" ? "on" : ""} onClick={() => { setTransferDir("out"); setTransferAmount(""); setTransferTo(""); }}>{t("iPaid")}</button>
                  <button type="button" role="radio" aria-checked={transferDir === "in"} className={transferDir === "in" ? "on" : ""} onClick={() => { setTransferDir("in"); setTransferAmount(""); setTransferTo(""); }}>{t("iReceived")}</button>
                </div>
                <label className="zField"><b>{transferDir === "in" ? t("receivedFrom") : t("paidTo")}</b>
                  <select value={transferTo} onChange={(event) => {
                    const personId = event.target.value;
                    setTransferTo(personId);
                    setFieldErrors((current) => ({ ...current, transferTo: "" }));
                    const suggested = transferDir === "in" ? settlements.find((settlement) => settlement.to === currentParticipantId && settlement.from === personId) : settlements.find((settlement) => settlement.from === currentParticipantId && settlement.to === personId);
                    setTransferAmount(suggested ? String(suggested.amount) : "");
                  }} disabled={!currentParticipantId || group.locked || workflow.archived} aria-invalid={Boolean(fieldErrors.transferTo)}>
                    <option value="">{t("chooseParticipant")}</option>
                    {group.people.filter((person) => person.id !== currentParticipantId && !workflow.people.find((member) => member.id === person.id)?.inactive).map((person) => (
                      <option key={person.id} value={person.id}>{person.name}</option>
                    ))}
                  </select>
                  {fieldErrors.transferTo && <span className="validationMessage">{fieldErrors.transferTo}</span>}
                </label>
                <label className="zField"><b>{t("amountPaid")} ({group.currency || "EUR"})</b>
                  <input type="number" min="0.01" step="0.01" value={transferAmount} onChange={(event) => { setTransferAmount(event.target.value); setFieldErrors((current) => ({ ...current, transferAmount: "" })); }} disabled={!currentParticipantId || group.locked || workflow.archived} aria-invalid={Boolean(fieldErrors.transferAmount)} />
                  {fieldErrors.transferAmount && <span className="validationMessage">{fieldErrors.transferAmount}</span>}
                </label>
                <label className="zField"><b>{t("note")}</b>
                  <input value={transferNote} maxLength={200} onChange={(event) => setTransferNote(event.target.value)} disabled={!currentParticipantId || group.locked || workflow.archived} />
                </label>
                <button className="zBtn" type="submit" disabled={saving || group.locked || workflow.archived}>{t("saveRepayment")}</button>
                <button className="zBtnG" type="button" onClick={() => setPaySheet(false)}>{t("cancel")}</button>
              </form>
            </div>
          )}

          {remindTarget && (() => {
            const text = t("remindMessage").replace("{name}", remindTarget.name).replace("{amount}", remindTarget.amount.toFixed(2).replace(".", ",") + " " + (group.currency || "EUR")).replace("{group}", group.name) + ` ${window.location.origin}/join?code=${group.code}`;
            return (
              <div className="zOverlay" onClick={() => setRemindTarget(null)}>
                <div className="zSheet" onClick={(event) => event.stopPropagation()}>
                  <h2 className="zH2">{t("remindShort")} {remindTarget.name}</h2>
                  <div className="zCard" style={{ background: "var(--tint)", fontSize: 14, lineHeight: 1.5 }}>{text}</div>
                  {typeof navigator.share === "function" && <button className="zBtn" type="button" onClick={() => void navigator.share({ text }).catch(() => {})}>{t("shareMessage")}</button>}
                  <button className="zBtnG" type="button" onClick={() => { void navigator.clipboard.writeText(text); showToast(t("copied")); setRemindTarget(null); }}>{t("copyText")}</button>
                </div>
              </div>
            );
          })()}
        </section>
      )}

      {activeTab === "people" && (
        <section className="groupTabContent zPage">
          <p className="zMuted" style={{ margin: 0 }}>{group.people.length} {t("participantsLabel").toLocaleLowerCase()} · {t(group.accessType === "REGISTERED_ONLY" ? "registeredAccess" : group.accessType === "MIXED" ? "mixedAccess" : "anonymousAccess").toLocaleLowerCase()}</p>
          <div className="zCols">
          <div className="zPage">
            <div className="zCard">
              {group.accessType !== "REGISTERED_ONLY" && !currentParticipantId && <p className="zMuted" style={{ margin: "0 0 4px" }}>{t("selectYourParticipant")}</p>}
              {group.people.map((person, index) => {
                const member = workflow.people.find((entry) => entry.id === person.id);
                const bal = balances.find((b) => b.id === person.id);
                const me = person.id === currentParticipantId;
                const takenByOther = Boolean(member?.claimed && !member.mine);
                return (
                  <div className="zRow zMember" key={person.id} style={member?.inactive ? { opacity: 0.55 } : undefined}>
                    <i className={`zAv c${(index % 4) + 1}`}>{avInner(person.name,avatarOf(person.id))}</i>
                    <div className="grow"><b>{person.name}{me ? ` (${t("youAre").toLocaleLowerCase()})` : ""}</b>
                      <span className="zMuted">{member?.role === "ADMIN" ? "Admin" : member?.claimed ? t("participant") : t("notClaimed")}{member?.inactive ? ` · ${t("inactive")}` : ""}</span></div>
                    {bal && <span className={bal.balance < 0 ? "zNeg" : bal.balance > 0 ? "zPos" : "zMuted"}>{bal.balance > 0 ? "+" : ""}{bal.balance.toFixed(2).replace(".", ",")} €</span>}
                    <div className="zMemberActions">
                      {group.accessType !== "REGISTERED_ONLY" && !me && !currentParticipantId && !member?.inactive && <button type="button" className="zPill" disabled={saving || takenByOther} onClick={() => void chooseParticipant(person.id)}>{t("thisIsMe")}</button>}
                      {group.accessType !== "REGISTERED_ONLY" && <button type="button" className="zPill" disabled={group.locked || !workflow.canAdmin || saving} onClick={() => { setEditingPersonId(person.id); setPersonName(person.name); setPersonSheet(true); }}>{t("edit")}</button>}
                      {group.accessType !== "REGISTERED_ONLY" && <button type="button" className="zPill" disabled={group.locked || !workflow.canAdmin || saving} onClick={() => void setParticipantInactive(person.id, !member?.inactive)}>{member?.inactive ? t("reactivate") : t("deactivate")}</button>}
                    </div>
                  </div>
                );
              })}
            </div>
            {group.accessType === "REGISTERED_ONLY"
              ? <p className="zMuted">{t("registeredParticipantsAutoAdded")}</p>
              : <button type="button" className="zBtnG" disabled={group.locked || saving} onClick={() => { setEditingPersonId(null); setPersonName(""); setPersonSheet(true); }}>+ {t("addParticipant")}</button>}
            <section className="zLeave">
              <div className="grow"><b>{t("leaveGroup")}</b><small>{workflow.canOwn ? t("leaveOwnerHint") : t("leaveGroupHint")}</small></div>
              {!workflow.canOwn && <button type="button" className="zBtnD sm" disabled={saving} onClick={() => setLeaveAsk(true)}><LogOut size={16} />&nbsp;{t("leaveGroup")}</button>}
            </section>
            <ConfirmationModal open={leaveAsk} title={t("leaveGroupAsk")} message={t("leaveGroupMsg")} confirmLabel={t("leaveGroup")} cancelLabel={t("cancel")} danger
              onCancel={() => setLeaveAsk(false)}
              onConfirm={() => { setLeaveAsk(false); void (async () => {
                try { setSaving(true); await api.leaveGroup(slug); clearWhoAmI(slug); removeSavedGroup(slug); showToast(t("leftGroup")); navigate("/", { replace: true }); }
                catch (e) { showToast(e instanceof Error ? e.message : String(e)); }
                finally { setSaving(false); }
              })(); }} />
          </div>
          <div className="zPage">
            <div className="zCard" style={{ background: "var(--tint)" }}>
              <span className="zMuted">{t("groupCode")}</span>
              <b className="zCodeBig">{group.code}</b>
              <div className="zCodeBtns">
                <button type="button" className="zBtnG" onClick={() => { void navigator.clipboard.writeText(group.code); showToast(t("copied")); }}>{t("copyCode")}</button>
                <button type="button" className="zBtn" onClick={() => void navigator.clipboard.writeText(`${window.location.origin}/join?code=${group.code}`).then(() => showToast(t("copied")))}><Copy size={16} />&nbsp;{t("copyLink")}</button>
              </div>
            </div>
            <button type="button" className="zCard zManageRow" onClick={() => setManageOpen((v) => !v)}><b>{t("groupSettings")}</b><span>{manageOpen ? "⌃" : "›"}</span></button>
          </div>
          </div>
          {manageOpen && (() => {
            const gc = groupSettingsCopy[(language as "hr"|"en"|"de"|"ja")] ?? groupSettingsCopy.hr;
            const lockRow = <div className="zGSetRow"><div className="grow"><b>{group.locked ? t("unlockGroup") : t("lockGroup")}</b><small>{gc.lockHint}</small></div><button type="button" className={"zToggle" + (group.locked ? " on" : "")} aria-label={t("lockGroup")} aria-pressed={group.locked} onClick={toggleLock} /></div>;
            const nameForm = <form className="zGSetBlock" onSubmit={(event) => void saveGroupName(event)} noValidate>
                <label className="zGSetField"><b>{t("groupName")}</b>
                  <div className="zGSetInline">
                    <input value={groupName} onChange={(event) => { setGroupName(event.target.value); setFieldErrors((current) => ({ ...current, groupName: "" })); }} maxLength={80} disabled={group.locked || !workflow.canAdmin || saving} aria-invalid={Boolean(fieldErrors.groupName)} />
                    <button type="submit" className="zBtn sm" disabled={group.locked || !workflow.canAdmin || saving || groupName.trim() === group.name}>{t("saveChanges")}</button>
                  </div>
                  {fieldErrors.groupName && <span className="validationMessage">{fieldErrors.groupName}</span>}
                </label>
              </form>;
            return workflow.canAdmin
              ? <GroupAdminTools group={group} workflow={workflow} refresh={refreshSnapshot} nameForm={nameForm} lockRow={lockRow} />
              : <div className="zGSet"><section className="zCard zGSetCard">{lockRow}{nameForm}</section></div>;
          })()}
          {personSheet && (
            <div className="zOverlay" onClick={() => { setPersonSheet(false); setEditingPersonId(null); setPersonName(""); }}>
              <form className="zSheet" onClick={(event) => event.stopPropagation()} onSubmit={(event) => { personSubmitted.current = true; void (editingPersonId ? savePersonName(event) : addPerson(event)); }} noValidate>
                <h2 className="zH2">{editingPersonId ? t("editParticipant") : t("addParticipant")}</h2>
                <label className="zField"><b>{t("addParticipantInput")}</b>
                  <input value={personName} onChange={(event) => { setPersonName(event.target.value); setFieldErrors((current) => ({ ...current, personName: "" })); }} maxLength={60} disabled={group.locked || saving} aria-invalid={Boolean(fieldErrors.personName)} autoFocus />
                  {fieldErrors.personName && <span className="validationMessage">{fieldErrors.personName}</span>}
                </label>
                <button className="zBtn" type="submit" disabled={group.locked || saving}>{editingPersonId ? t("saveChanges") : t("addParticipant")}</button>
                <button type="button" className="zBtnG" onClick={() => { setPersonSheet(false); setEditingPersonId(null); setPersonName(""); }}>{t("cancel")}</button>
              </form>
            </div>
          )}
        </section>
      )}

      {activeTab === "history" && (
        <section className="groupTabContent zPage">
          <div className="zTabs small zHistFilters" role="group" aria-label={t("historyFilters")}>
            {[
              ["all", t("allActivity")],
              ["EXPENSE", t("expenses")],
              ["TRANSFER", t("repaymentRecords")],
              ["PERSON", t("participantsLabel")],
            ].map(([filter, label]) => (
              <button type="button" className={`zTab${historyFilter === filter ? " on" : ""}`} key={filter} onClick={() => setHistoryFilter(filter)} aria-pressed={historyFilter === filter}>{label}</button>
            ))}
          </div>
          <div className="zCard">
            <HistoryList group={group} entries={(group.history ?? []).filter((entry) => historyFilter === "all" || entry.entity === historyFilter)} />
          </div>
        </section>
      )}

      {activeTab === "expenses" && (
        <section id="expenses-container">
          <div className="grid">
            <section className="card">
              <div className="zSideCol">
              <div className="facetStats"><div className="facetTotal">
                <div>
                  <span>{t("expenses")} · {group.expenses.length}</span>
                  <strong>{group.expenses.reduce((sum, expense) => sum + Number(expense.totalAmount), 0).toFixed(2)} {group.currency || "EUR"}</strong>
                </div>
              </div>
              <div className={"facetBalance"+(currentBalance && currentBalance.balance < 0 ? " negative" : "")}>
                <span>{currentParticipant ? `${t("myBalance")} · ${currentParticipant.name}` : t("selectYourParticipant")}</span>
                <strong>{currentBalance ? `${currentBalance.balance > 0 ? "+" : ""}${currentBalance.balance.toFixed(2).replace(".", ",")} ${(group.currency || "EUR") === "EUR" ? "€" : group.currency}` : "—"}</strong>
                {currentBalance && Math.abs(currentBalance.balance) >= 0.005 && <button type="button" className="textButton" onClick={() => setActiveTab("debts")}>{(settlementData?.settlements ?? []).filter((x) => x.to === currentBalance.id || x.from === currentBalance.id).length} {t("groupTabDebts")}</button>}
              </div>
              </div>
              {/* "Tko ti duguje" je maknut iz Troškova — detalji su u kartici Dugovanja (gumb na saldu). */}
              {isDesk && <div className="zDetailSlot" ref={setDetailSlot} />}
              </div>
              <div className="zFilterBar">
                <div className="zSearch"><Search size={18} aria-hidden="true" /><input aria-label={t("searchExpenses")} placeholder={t("searchExpenses")} value={expenseSearch} onChange={(event) => setExpenseSearch(event.target.value)} /></div>
                <button type="button" className={"zFilterBtn" + (filtersOpen ? " on" : "")} aria-expanded={filtersOpen} aria-controls="expense-filters" onClick={() => setFiltersOpen((v) => !v)}>
                  <SlidersHorizontal size={18} aria-hidden="true" /><span>{t("filtersLabel")}</span>
                  {[expenseMonth, expenseCategory, pendingOnly, mineOnly].filter(Boolean).length > 0 && <i className="zCount">{[expenseMonth, expenseCategory, pendingOnly, mineOnly].filter(Boolean).length}</i>}
                </button>
              </div>
              <div className="expenseFilters zFilterPanel" id="expense-filters" hidden={!filtersOpen}>
                <label>{t("monthFilter")}<input type="month" value={expenseMonth} onChange={(event) => setExpenseMonth(event.target.value)} /></label>
                <label>{t("categoryFilter")}<select value={expenseCategory} onChange={(event) => setExpenseCategory(event.target.value)}><option value="">{t("allCategories")}</option><option value="other">{t("categoryOther")}</option><option value="food">{t("categoryFood")}</option><option value="travel">{t("categoryTravel")}</option><option value="home">{t("categoryHome")}</option><option value="fun">{t("categoryFun")}</option><option value="taxi">{t("categoryTaxi")}</option><option value="shopping">{t("categoryShopping")}</option><option value="health">{t("categoryHealth")}</option></select></label>
                <div className="zFilterChips">
                <button type="button" className={`secondaryButton compact${pendingOnly ? " filterSelected" : ""}`} aria-pressed={pendingOnly} onClick={() => setPendingOnly((value) => !value)}>{t("pendingExpenses")} ({group.expenses.filter((expense) => expense.allocationComplete === false || expense.paymentIncomplete).length})</button>
                <button type="button" className={`secondaryButton compact${mineOnly ? " filterSelected" : ""}`} aria-pressed={mineOnly} onClick={() => setMineOnly((value) => !value)} disabled={!currentParticipantId}>{t("myExpenses")}</button>
                </div>
                {(expenseSearch || expenseMonth || expenseCategory || pendingOnly || mineOnly) && <button type="button" className="textButton" onClick={() => { setExpenseSearch(""); setExpenseMonth(""); setExpenseCategory(""); setPendingOnly(false); setMineOnly(false); }}>{t("clearFilters")}</button>}
              </div>
              {pending.count > 0 && <section role="status" className="zPending" aria-label={t("pendingTitle")}>
                <h3 className="zDayHead zPendTitle"><CloudOff size={15} aria-hidden="true" />{t("pendingTitle")}<span className="zCount">{pending.count}</span></h3>
                {pending.rows.map((r) => <div key={r.key} className="zExp zPendExp">
                  <div className="zExpMain">
                    <span className="zExpIc"><CloudOff size={20} aria-hidden="true" /></span>
                    <span className="zExpTxt"><b>{r.title}</b><span className={"zPendBadge" + (r.error ? " err" : "")}><Clock3 size={12} aria-hidden="true" />{r.error ? r.error : t("pendingWaiting")}</span></span>
                    <span className="zExpRight"><b>{r.total.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {r.currency === "EUR" ? "€" : r.currency}</b></span>
                  </div>
                </div>)}
                <div className="zPendFoot"><small>{t("pendingHint")}</small>{navigator.onLine && <button type="button" className="zPill zPillGhost" onClick={() => void syncBills(true)}>{t("retrySync")}</button>}</div>
              </section>}
              {(() => {
                  const expenses = [...filteredExpenses].sort((a, b) => String(b.billDate ?? b.createdAt).localeCompare(String(a.billDate ?? a.createdAt)));
                  if (group.expenses.length === 0)
                    return pending.count > 0 ? null : <p className="muted zEmptyNote">{t("noExpensesYet")}</p>;
                  if (expenses.length === 0)
                    return <p className="muted">{t("noExpensesMatch")}</p>;
                  return (
                    <div className="list">
                      {expenses.map((expense, expenseIndex) => {
                        const dayOf = (e: typeof expense) => String(e.billDate ?? e.createdAt).slice(0, 10);
                        const day = dayOf(expense);
                        const newDay = expenseIndex === 0 || dayOf(expenses[expenseIndex - 1]) !== day;
                        const lk = (d: Date) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); const todayKey = lk(new Date()), yKey = lk(new Date(Date.now() - 864e5));
                        const dayLabel = day === todayKey ? t("today") : day === yKey ? t("yesterday") : new Date(day + "T12:00:00").toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });
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
                          <Fragment key={expense.id}>{newDay && <h3 className="zDayHead">{dayLabel}</h3>}
                          <div className={"zExp" + (isDesk && claimId === expense.id ? " sel" : "")}>
                            <button type="button" className="zExpMain" aria-haspopup={isDesk ? undefined : "dialog"} aria-current={isDesk && claimId === expense.id ? "true" : undefined} onClick={() => setClaimId(expense.id)}>
                              <span className="zExpIc" data-category={expense.category ?? inferCategory(expense.note || "")}><CategoryIcon category={expense.category ?? inferCategory(expense.note || "")} /></span>
                              <span className="zExpTxt">
                                <b>{expense.note || t("expense")}</b>
                                <small>{(expense.payers ?? []).map((p) => p.person?.name ?? group.people.find((x) => x.id === p.personId)?.name ?? t("someone")).join(", ")} · {new Date(expense.createdAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}{(expense.items?.length ?? 0) > 1 ? ` · ${expense.items.length} ${t("itemsCount")}` : ""}</small>
                                {(expense.allocationComplete === false || expense.paymentIncomplete) && <span className="zExpPills">{expense.allocationComplete === false && <span className="zTag warn">{t("expenseAwaitingSplit")}</span>}{expense.paymentIncomplete && <span className="zTag warn">{t("expenseCheckPayers")}</span>}</span>}
                              </span>
                              <span className="zExpRight">
                                <b>{fmtMoney(Number(expense.totalAmount || 0))}</b>
                                {currentParticipant && <small className={!currentInvolved ? "muted" : currentNet > 0 ? "pos" : currentNet < 0 ? "neg" : "muted"}>{!currentInvolved ? t("expenseNotInvolved") : currentNet > 0 ? `${t("expenseYouLentShort")} ${fmtMoney(currentNet)}` : currentNet < 0 ? `${t("expenseYouOweShort")} ${fmtMoney(Math.abs(currentNet))}` : t("expenseSettled")}</small>}
                              </span>
                            </button>
                            {expense.canManage && (
                              <button type="button" className="zExpEdit" aria-label={`${t("editExpense")}: ${expense.note || t("expense")}`} title={t("editExpense")} disabled={group.locked} onClick={() => navigate(`/g/${slug}/add-expense?edit=${encodeURIComponent(expense.id)}`)}>
                                <Pencil size={16} aria-hidden="true" />
                              </button>
                            )}
                          </div></Fragment>
                        );
                      })}
                    </div>
                  );
                })()}
            </section>
          </div>
        </section>
      )}

      {(() => {
        const expense = claimId ? group.expenses.find((x) => x.id === claimId) : null;
        if (!expense) return null;
        const cur0 = (group.currency || "EUR") === "EUR" ? "€" : group.currency;
        const inner = (
          <>
              <div className="zSheetHead">
                <div className="grow"><b>{expense.note || t("expense")}</b><small>{Number(expense.totalAmount || 0).toFixed(2).replace(".", ",")} {cur0}</small></div>
                <button type="button" className="zBack" aria-label={t("cancel")} onClick={() => setClaimId(null)}><X size={18} aria-hidden="true" /></button>
              </div>
              <div className="zSheetBody">
                {(() => {
                                  const items = (expense.items ?? []) as ExpenseItem[];
                                  const cur = (group.currency || "EUR") === "EUR" ? "€" : group.currency;
                                  const fmt = (n: number) => n.toFixed(2).replace(".", ",") + " " + cur;
                                  const activePeople = group.people.filter((p) => !workflow.people.find((m) => m.id === p.id)?.inactive);
                                  const doneIds = new Set(items.flatMap((it) => (it.shares ?? []).map((sh) => sh.personId)));
                                  const mineTotal = items.reduce((sum, it) => sum + Number(it.shares.find((sh) => sh.personId === currentParticipantId)?.amount || 0), 0);
                                  const total = Number(expense.totalAmount || 0) || 1;
                                  return (
                                    <>
                                      {items.length > 0 && (
                                        <div className="zClaimBanner"><div className="grow"><b>{t("claimTitle")}</b><span>{t("claimProgress").replace("{done}", String(doneIds.size)).replace("{total}", String(activePeople.length))}</span></div>
                                          <span className="zAvs">{activePeople.slice(0, 5).map((p, i) => <i key={p.id} className={`zAv s c${(i % 4) + 1}`} style={doneIds.has(p.id) ? undefined : { opacity: 0.35 }}>{avInner(p.name,avatarOf(p.id))}</i>)}</span></div>
                                      )}
                                      <div className="zItems expense-items">
                                        {items.map((item: ExpenseItem) => <ReceiptItem key={item.id} item={item} currency={group.currency||"EUR"} people={group.people} mine={currentParticipantId} disabled={group.locked||saving||!currentParticipantId} onChange={async value=>{
                                      setSaving(true);setActionError("");try{await api.ownItem(slug,expense.id,item.id,value,true);await refreshSnapshot()}catch(err){setActionError(err instanceof Error?err.message:t("somethingWentWrong"))}finally{setSaving(false)}
                                    }}/>)}
                                      </div>
                                      {currentParticipantId && items.length > 0 && (
                                        <div className="zShareBar" role="status"><div><small>{t("yourShareLabel").toLocaleUpperCase()}</small><strong>{fmt(mineTotal)}</strong></div>
                                          <button type="button" className="zBtn sm" onClick={() => setClaimId(null)}>{t("doneLabel")}</button></div>
                                      )}
                                      {(expense.shares ?? []).length > 0 && <>
                                      <h3 className="zLbl zWhoHead">{t("whoAteWhat")}</h3>
                                      <div className="zWhoList">
                                        {(expense.shares ?? []).map((share, si) => {
                                          const person = group.people.find((p) => p.id === share.personId);
                                          const name = share.person?.name ?? person?.name ?? share.personId;
                                          const mineRow = share.personId === currentParticipantId;
                                          const parts = items.map((it) => ({ it, sh: it.shares.find((x) => x.personId === share.personId) })).filter((x) => x.sh).map((x) => x.it.name);
                                          return (
                                            <div className="zWhoRow" key={share.personId}>
                                              <i className={`zAv c${(si % 4) + 1}`}>{avInner(name,avatarOf(share.personId))}</i>
                                              <span className="grow"><b>{name}{mineRow ? ` (${t("youShort")})` : ""}</b>{parts.length > 0 && <small>{parts.join(", ")}</small>}</span>
                                              <span className="zWhoAmt"><b>{fmt(Number(share.amount))}</b><i style={{ width: `${Math.min(100, (Number(share.amount) / total) * 100)}%` }} /></span>
                                            </div>
                                          );
                                        })}
                                      </div></>}
                                    </>
                                  );
                                })()}
              </div>
          </>
        );
        if (isDesk && (!detailSlot || activeTab !== "expenses")) return null;
        if (isDesk && detailSlot) return createPortal(<aside className="zDetail" aria-label={expense.note || t("expense")}>{inner}</aside>, detailSlot);
        return (
          <div className="zOverlay" onClick={() => setClaimId(null)}>
            <div className="zSheet zClaimSheet" role="dialog" aria-modal="true" aria-label={expense.note || t("expense")} onClick={(event) => event.stopPropagation()}>{inner}</div>
          </div>
        );
      })()}
    </main>
  );
};
