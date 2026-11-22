import {queueBill,snapshotForEditor,syncBills} from "../offlineBills";
import {avInner} from "../components/PersonAv";
import {CategoryIcon,inferCategory,labels,type Category} from "../components/ExpenseCategory";
import {getWhoAmI,saveWhoAmI} from "../storage";
import "../styles/receiptParity.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Camera, ImagePlus, Plus, RefreshCw, Trash2, Users, ChevronDown, Check } from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api,type FxQuote } from "../api";
import { useLanguage } from "../i18n";
import type { Expense, Group } from "../types";
import { showToast } from "../notifications";
//push comment
type DraftItem = {
  quantity?:string;
  id: string;
  ordinalNumber: number;
  name: string;
  price: string;
  assignedPersonIds: string[];
  splitMode?: "shared" | "units";
  assignedUnits?: Record<string, number>;
  originalLineTotal?:number;
  originalShares?: Array<{ personId: string; amount: number; units?: number | null }>;
};

const lineTotal=(item:DraftItem)=>item.originalLineTotal??Math.round(Number(item.price)*100)*Number(item.quantity||1)/100;
const units=(item:DraftItem)=>(item.splitMode??(Number(item.quantity||1)>1?"units":"shared"))==="units";
type DraftPayer = {
  id: string;
  personId: string;
  amount: string;
};


const sanitizeDecimalInput = (value: string): string => {
  const sanitized = value.replace(",", ".").replace(/[^0-9.]/g, "");
  const firstDotIndex = sanitized.indexOf(".");

  if (firstDotIndex === -1) {
    return sanitized;
  }

  return (
    sanitized.slice(0, firstDotIndex + 1) +
    sanitized.slice(firstDotIndex + 1).replace(/\./g, "")
  );
};

type EqualSplitMode = "equal" | "amount" | "percent" | "weight";

const decimalToCents = (value: string): number | null => {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
};

const allocateEqualShares = (
  totalCents: number,
  participantIds: string[],
  values: Record<string, string>,
  mode: Exclude<EqualSplitMode, "equal">,
): { shares: number[]; valid: boolean } => {
  const numbers = participantIds.map((id) => decimalToCents(values[id] ?? ""));
  if (numbers.some((value) => value === null)) return { shares: [], valid: false };
  const amounts = numbers.filter((value): value is number => value !== null);

  if (mode === "amount") {
    return {
      shares: amounts,
      valid: amounts.reduce((sum, amount) => sum + amount, 0) === totalCents,
    };
  }
  if (mode === "percent" && amounts.reduce((sum, amount) => sum + amount, 0) !== 10000) {
    return { shares: [], valid: false };
  }

  const weightTotal = amounts.reduce((sum, amount) => sum + amount, 0);
  if (weightTotal <= 0) return { shares: [], valid: false };
  const rawAmounts = amounts.map((amount) => totalCents * amount / weightTotal);
  const shares = rawAmounts.map(Math.floor);
  const remainderOrder = rawAmounts
    .map((amount, index) => ({ index, fraction: amount - shares[index] }))
    .sort((left, right) => right.fraction - left.fraction || left.index - right.index);
  const remainder = totalCents - shares.reduce((sum, amount) => sum + amount, 0);
  for (let index = 0; index < remainder; index += 1) {
    shares[remainderOrder[index % remainderOrder.length].index] += 1;
  }
  return { shares, valid: true };
};

export const GroupAddExpensePage = () => {
  const navigate = useNavigate();
  const { slug = "" } = useParams();
  const [searchParams] = useSearchParams();
  const { t, locale } = useLanguage();
  // Iznosi se interno drže s točkom ("10.5"); prikazuju se s decimalnim zarezom za hr/de i na izlasku iz polja dobiju dvije decimale.
  const decSep = (1.5).toLocaleString(locale).charAt(1) === "," ? "," : ".";
  const showDec = (v?: string) => (v ?? "").replace(".", decSep);
  const fix2 = (v?: string) => { const raw = (v ?? "").trim(); if (!raw) return ""; const n = Number(raw); return Number.isFinite(n) ? n.toFixed(2) : raw; };
  const editExpenseId = searchParams.get("edit");

  const [group, setGroup] = useState<Group | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [entryMode, setEntryMode] = useState<"equal" | "items">(searchParams.get("scan")==="1"?"items":"equal");
  const [equalAmount, setEqualAmount] = useState("");
  const [equalParticipantIds, setEqualParticipantIds] = useState<string[]>([]);
  const [equalSplitMode, setEqualSplitMode] = useState<EqualSplitMode>("equal");
  const [equalSplitValues, setEqualSplitValues] = useState<Record<string, string>>({});
  const [assignNow,setAssignNow]=useState(false);
  const [mine,setMine]=useState<Record<string,number>>({});
  const [showPeople,setShowPeople]=useState(false);
  const [requestId]=useState(()=>crypto.randomUUID());
  const [saved,setSaved]=useState(false);
  const [note, setNote] = useState("");
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [amounts,setAmounts]=useState<Record<string,string>>({});
  const [avatars,setAvatars]=useState<Record<string,string|null|undefined>>({});
  const [single,setSingle]=useState("");
  const [multiple,setMultiple]=useState(false);
  const [payerOpen,setPayerOpen]=useState(false);
  const [override,setOverride]=useState<Category|null>(null);
  const category=override??inferCategory(note);
  const baseCurrency=group?.currency||"EUR";
  const [overrideCurrency,setCurrency]=useState("");
  const currency=overrideCurrency||baseCurrency;
  const [currencies,setCurrencies]=useState<{code:string;name:string}[]>([]);
  const [quote,setQuote]=useState<FxQuote|null>(null);
  const [quoteError,setQuoteError]=useState("");
  useEffect(()=>{let active=true;api.currencies().then(v=>{if(active)setCurrencies(v)}).catch(()=>{});return()=>{active=false}},[]);
  useEffect(()=>{let active=true;setQuote(null);setQuoteError("");if(currency===baseCurrency)return;const load=()=>api.fxQuote(slug,currency).then(v=>{if(active){setQuote(v);setQuoteError("")}}).catch(e=>{if(active)setQuoteError(e.message)});void load();const id=setInterval(load,300000);return()=>{active=false;clearInterval(id)}},[slug,currency,baseCurrency]);
  const [scanPreview,setScanPreview]=useState(false);
  const [actor,setActor]=useState("");
  const [date,setDate]=useState(()=>new Date().toISOString().slice(0,10));
  const [actionError, setActionError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [parsingBill, setParsingBill] = useState(false);
  const [billImageFile, setBillImageFile] = useState<File | null>(null);
  const [billParseRetryAvailable, setBillParseRetryAvailable] = useState(false);
  const [billParseRetryUsed, setBillParseRetryUsed] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const {group:currentGroup,workflow}=await snapshotForEditor(slug);
        setAvatars(Object.fromEntries(workflow.people.map(p=>[p.id,p.avatar])));
        setGroup(currentGroup);
        setEqualParticipantIds(currentGroup.people.map((person) => person.id));
        const expense = editExpenseId
          ? currentGroup.expenses.find((entry) => entry.id === editExpenseId)
          : undefined;
        if (editExpenseId && !expense) {
          navigate(`/g/${slug}`);
          return;
        }
        if (expense) {
          setEditingExpense(expense);
          setNote(expense.note ?? "");
          setAssignNow(true);
          setDraftItems(expense.items.map((item, index) => ({
            id: item.id,
            ordinalNumber: index + 1,
            name: item.name,
            quantity: String(item.quantity ?? 1),
            price: (Number(item.price) / (item.quantity || 1)).toFixed(2),
            splitMode: item.splitMode ?? "shared",
            assignedPersonIds: item.shares.map((share) => share.personId),
            assignedUnits: Object.fromEntries(
              item.shares.map((share) => [share.personId, share.units ?? 1]),
            ),
            originalLineTotal:Number(item.price),
            originalShares: item.shares.map((share) => ({
              personId: share.personId,
              amount: Number(share.amount),
              units: share.units,
            })),
          })));
          setMultiple(expense.payers.length>1);
          setSingle(expense.payers[0]?.personId||"");
          setAmounts(Object.fromEntries(expense.payers.map(p=>[p.personId,String(p.amount)])));
          setOverride(expense.category??null);
          if(expense.billDate)setDate(expense.billDate.slice(0,10));
          return;
        }

        setDraftItems([
          {
            id: crypto.randomUUID(),
            ordinalNumber: 1,
            name: "",
            price: "",
            assignedPersonIds: currentGroup.people.map((person) => person.id)
          }
        ]);

        const me=workflow.people.find(p=>p.mine&&!p.inactive)?.id??getWhoAmI(slug)?.participantId;const id=currentGroup.people.find(p=>p.id===me)?.id||"";if(id)saveWhoAmI(slug,id,currentGroup.people.find(p=>p.id===id)?.name);setSingle(id);setActor(id);setPayerOpen(!id);
      } catch {
        navigate(`/g/${slug}`);
      }
    };

    void load();
  }, [slug, navigate, editExpenseId]);

  const equalMode = !editingExpense && entryMode === "equal";

  const itemTotal = useMemo(
    () => {
      if (equalMode) {
        const amount = Number(equalAmount);
        return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) / 100 : 0;
      }
      return draftItems.reduce((sum, item) => {
        const value = lineTotal(item);
        return sum + (Number.isFinite(value) && value >= 0 ? value : 0);
      }, 0);
    },
    [draftItems, equalAmount, equalMode]
  );

  const draftPayers:DraftPayer[]=useMemo(()=>multiple
    ? Object.entries(amounts).filter(([,v])=>v!==""&&Number(v)!==0).map(([personId,amount])=>({id:personId,personId,amount}))
    : single?[{id:single,personId:single,amount:itemTotal.toFixed(2)}]:[],[amounts,multiple,single,itemTotal]);
  const payerTotal = useMemo(
    () =>
      draftPayers.reduce((sum, payer) => {
        const value = Number(payer.amount);
        return sum + (Number.isFinite(value) && value > 0 ? value : 0);
      }, 0),
    [draftPayers]
  );

  const difference = Number((payerTotal - itemTotal).toFixed(2));

  const assignedTotal = useMemo(
    () => {
      if (equalMode) return equalParticipantIds.length > 0 ? itemTotal : 0;
      return draftItems.reduce((sum, item) => {
        if (!assignNow || item.assignedPersonIds.length === 0) return sum;
        const value = units(item)?Math.round(lineTotal(item)*100*Object.values(item.assignedUnits??{}).reduce((a,b)=>a+b,0)/Number(item.quantity||1))/100:lineTotal(item);
        return sum + (Number.isFinite(value) && value > 0 ? value : 0);
      }, 0);
    },
    [draftItems, assignNow, equalMode, equalParticipantIds.length, itemTotal]
  );

  const unassignedAmount = Number((itemTotal - (equalMode || assignNow ? assignedTotal : 0)).toFixed(2));

  const allItemsAssigned = useMemo(
    () =>
      equalMode
        ? equalParticipantIds.length > 0
        : draftItems.length > 0 &&
          draftItems.every((item) => item.assignedPersonIds.length > 0),
    [draftItems, equalMode, equalParticipantIds.length]
  );

  const assignmentAmountInvalid = assignedTotal - itemTotal > 0.009;
  const paymentOverpaid = payerTotal - itemTotal > 0.009;
  const allAmountsPaid = Math.abs(difference) < 0.01;
  const canAddExpense =
    allItemsAssigned &&
    !assignmentAmountInvalid &&
    !paymentOverpaid &&
    Math.abs(unassignedAmount) < 0.01 &&
    allAmountsPaid;

  const updateDraftItem = (
    id: string,
    field: keyof Omit<DraftItem, "id" | "ordinalNumber">,
    value: string | string[]
  ) => {
    setFieldErrors((current) => ({ ...current, [`item-${id}-${field}`]: "" }));
    setDraftItems((current) =>
      current.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value, originalLineTotal: field==="price"||field==="quantity"?undefined:item.originalLineTotal };
        if (field !== "quantity" || typeof value !== "string" || !/^\d+$/.test(value)) {
          return field === "price" || field === "assignedPersonIds"
            ? { ...updated, originalShares: undefined }
            : updated;
        }
        const quantity = Number(value);
        let left=quantity;
        const assignedUnits=Object.fromEntries(Object.entries(item.assignedUnits??{}).map(([id,n])=>{const take=Math.min(n,left);left-=take;return [id,take]}));
        return {...updated,originalShares:undefined,splitMode:quantity>1?"units":"shared",assignedUnits,assignedPersonIds:quantity>1?Object.keys(assignedUnits).filter(id=>assignedUnits[id]>0):item.assignedPersonIds};
      })
    );
  };

  const addDraftItem = () => {
    if (!group) return;
    const personIds = group.people.map((person) => person.id);
    setDraftItems((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        ordinalNumber: current.length + 1,
        name: "",
        price: "",
        assignedPersonIds: personIds
      }
    ]);
  };

  const removeDraftItem = (id: string) => {
    setDraftItems((current) => {
      if (current.length <= 1) return current;
      return current
        .filter((item) => item.id !== id)
        .map((item, index) => ({
          ...item,
          ordinalNumber: index + 1
        }));
    });
  };

  const resizeImageForUpload = (
  file: File,
  maxWidth = 1600,
  maxHeight = 1600,
  quality = 0.85
): Promise<File> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;

      const scale = Math.min(
        maxWidth / width,
        maxHeight / height,
        1
      );

      width = Math.round(width * scale);
      height = Math.round(height * scale);

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");

      if (!ctx) {
        reject(new Error("Could not create canvas context"));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Could not convert image"));
            return;
          }

          resolve(
            new File(
              [blob],
              "bill.jpg",
              {
                type: "image/jpeg",
                lastModified: Date.now()
              }
            )
          );
        },
        "image/jpeg",
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not load image"));
    };

    img.src = objectUrl;
  });
};

  const parseBillImage = async (file: File, attempt: number) => {
    try {
      setParsingBill(true);
      setActionError("");

      const result = await api.parseBillImage(file, attempt);

      if (result.items.length === 0) {
        setActionError(t("billNoItemsRecognized"));
        return;
      }

      setDraftItems(
        result.items.map((item, index) => ({
          id: crypto.randomUUID(),
          ordinalNumber: index + 1,
          name: item.name,
          originalLineTotal:Number(item.price),
          price: (item.unitPrice ?? item.price / (item.quantity ?? 1)).toFixed(2),
          quantity: String(item.quantity ?? 1),
          assignedPersonIds: group?.people.map((person) => person.id) ?? []
        }))
      );
      setEntryMode("items");setScanPreview(true);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : t("billParseFailed")
      );
    } finally {
      setParsingBill(false);
      if (attempt === 1) {
        setBillParseRetryAvailable(true);
      } else {
        setBillParseRetryAvailable(false);
        setBillParseRetryUsed(true);
      }
    }
  };

  const handleBillAsImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setBillImageFile(file);
    setBillParseRetryAvailable(false);
    setBillParseRetryUsed(false);
    try {
      const resizedFile = await resizeImageForUpload(
      file,
      1600,
      1600,
      0.85
    );

    setBillImageFile(resizedFile);
      await parseBillImage(resizedFile, 1);
    } finally {
      event.target.value = "";
    }
  };

  const handleRetryBillParse = () => {
    if (!billImageFile || parsingBill || billParseRetryUsed) return;
    void parseBillImage(billImageFile, 2);
  };

  const saveDraftBill = async () => {
    if (!group || group.locked || saving) return;
    if(saved){navigate(`/g/${slug}`);return;}
    setActionError("");
    const errors: Record<string, string> = {};
    if (equalMode) {
      if (!equalAmount.trim()) {
        errors.equalAmount = t("fieldRequired");
      } else if (!/^\d+(\.\d{1,2})?$/.test(equalAmount) || Number(equalAmount) <= 0) {
        errors.equalAmount = t("invalidPrice");
      }
      if (equalParticipantIds.length === 0) {
        errors.equalParticipants = t("selectAtLeastOneParticipant");
      }
    } else {
      if (draftItems.length === 0) errors.items = t("atLeastOneItem");
      for (const item of draftItems) {
        if (!item.name.trim()) {
          errors[`item-${item.id}-name`] = t("fieldRequired");
        } else if (item.name.trim().length > 120) {
          errors[`item-${item.id}-name`] = t("fieldMaxLength").replace("{count}", "120");
        }
        if (!item.price.trim()) {
          errors[`item-${item.id}-price`] = t("fieldRequired");
        } else if (!/^\d+(\.\d{1,2})?$/.test(item.price)) {
          errors[`item-${item.id}-price`] = t("invalidPrice");
        }
        if (!Number.isInteger(Number(item.quantity ?? 1)) || Number(item.quantity ?? 1) < 1 || Number(item.quantity ?? 1) > 999) {
          errors[`item-${item.id}-quantity`] = t("invalidQuantity");
        }
      }
    }
    if (draftPayers.length === 0) errors.payers = t("atLeastOnePayer");
    for (const payer of draftPayers) {
      const amount = Number(payer.amount);
      if (!payer.personId) errors[`payer-${payer.id}-personId`] = t("fieldRequired");
      if (!payer.amount || !Number.isFinite(amount) || amount <= 0 || !/^\d+(\.\d{1,2})?$/.test(payer.amount)) {
        errors[`payer-${payer.id}-amount`] = payer.amount ? t("invalidAmount") : t("fieldRequired");
      }
    }
    const payerIdsForValidation = draftPayers.map((payer) => payer.personId);
    const duplicatePayerIds = new Set(
      payerIdsForValidation.filter((personId, index) => payerIdsForValidation.indexOf(personId) !== index),
    );
    if (duplicatePayerIds.size > 0) {
      for (const payer of draftPayers) {
        if (duplicatePayerIds.has(payer.personId)) {
          errors[`payer-${payer.id}-personId`] = t("duplicatePayer");
        }
      }
    }
    const totalForValidation = equalMode
      ? Math.round(Number(equalAmount) * 100) / 100
      : draftItems.reduce(
          (sum, item) => sum + lineTotal(item),
          0,
        );
    const equalShareAllocation = equalMode && equalSplitMode !== "equal"
      ? allocateEqualShares(
          Math.round(totalForValidation * 100),
          equalParticipantIds,
          equalSplitValues,
          equalSplitMode,
        )
      : { shares: [], valid: true };
    if (equalMode && equalSplitMode !== "equal" && !equalShareAllocation.valid) {
      const inputsValid = equalParticipantIds.every((id) => decimalToCents(equalSplitValues[id] ?? "") !== null);
      errors.equalSplit = !inputsValid
        ? t("invalidAmount")
        : equalSplitMode === "amount"
          ? t("splitAmountTotalMustMatch")
          : equalSplitMode === "percent"
            ? t("splitPercentTotalMustBe100")
            : t("invalidSplitValues");
    }
    const paidForValidation = draftPayers.reduce((sum, payer) => sum + (Number(payer.amount) || 0), 0);
    if (draftPayers.length > 0 && Math.abs(paidForValidation - totalForValidation) >= 0.01) {
      errors.paymentTotal = t("paidTotalMustMatch");
    }
    if (paymentOverpaid) errors.paymentTotal = t("paidTotalMustMatch");
    if (assignmentAmountInvalid) errors.assignmentTotal = t("invalidAmount");
    if(multiple&&draftPayers.length<2)errors.payers=t("twoPayers");
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      showToast(t("formCorrectionToast"));
      return;
    }

    const validItems = equalMode
      ? []
      : draftItems.filter(
          (item) =>
            item.name.trim().length > 0 &&
            Number.isFinite(lineTotal(item)) &&
            lineTotal(item) >= 0
        );

    if (!equalMode && validItems.length === 0) {
      setActionError(t("atLeastOneItem"));
      showToast(t("formCorrectionToast"));
      return;
    }

    const allValidItemsAssigned = equalMode
      ? equalParticipantIds.length > 0
      : validItems.every((item) => item.assignedPersonIds.length > 0);

    const validItemsTotal = equalMode
      ? totalForValidation
      : validItems.reduce(
          (sum, item) => sum + lineTotal(item),
          0
        );

    const validPayers = draftPayers.filter(
      (payer) =>
        payer.personId &&
        Number.isFinite(Number(payer.amount)) &&
        Number(payer.amount) > 0
    );

    if (validPayers.length === 0) {
      setActionError(t("atLeastOnePayer"));
      showToast(t("formCorrectionToast"));
      return;
    }

    const payerIds = validPayers.map((payer) => payer.personId);
    if (new Set(payerIds).size !== payerIds.length) {
      setActionError(t("duplicatePayer"));
      showToast(t("formCorrectionToast"));
      return;
    }

    const validPayersTotal = validPayers.reduce(
      (sum, payer) => sum + Number(payer.amount),
      0
    );

    const validAssignedTotal = equalMode
      ? validItemsTotal
      : validItems.reduce((sum, item) => {
          if (item.assignedPersonIds.length === 0) return sum;
          const value = lineTotal(item);
          return sum + (Number.isFinite(value) && value > 0 ? value : 0);
        }, 0);
    const finalUnassignedAmount = Number(
      (validItemsTotal - validAssignedTotal).toFixed(2)
    );
    const finalPaymentDifference = Number(
      (validPayersTotal - validItemsTotal).toFixed(2)
    );

    // A draft may be saved while items are still unassigned or the payer
    // total is incomplete. It can only become a real expense when every
    // item is assigned, no assignment amount is over the item total, and
    // the full item total has been paid.
    {
      if (Math.abs(finalPaymentDifference) >= 0.01) {
        setActionError(
          t("paidTotalMustMatch")
        );
        showToast(t("formCorrectionToast"));
        return;
      }
    }

    try {
      setSaving(true);
      setActionError("");

      const currentQuote=currency===baseCurrency||(!editingExpense&&!navigator.onLine)?null:quote?.base===currency&&Date.parse(quote.expiresAt)>Date.now()?quote:await api.fxQuote(slug,currency);
      const body = {
        currency,quoteId:currentQuote?.id,
        note: note.trim() || undefined,
        billDate:editingExpense?.billDate?.slice(0,10)===date ? editingExpense.billDate : new Date(date+"T12:00:00Z").toISOString(),
        category,
        payers: validPayers.map((payer) => ({
          personId: payer.personId,
          amount: Number(payer.amount)
        })),
        items: equalMode
          ? [{
              ordinalNumber: 1,
              quantity: 1,
              splitMode: "shared" as const,
              name: note.trim() || t("expense"),
              price: validItemsTotal,
              shares: equalParticipantIds.map((personId, index) => ({
                personId,
                ...(equalSplitMode === "equal" ? {} : { amount: equalShareAllocation.shares[index] / 100 }),
              })),
            }]
          : validItems.map((item, index) => ({
          ordinalNumber: index + 1,
          quantity:Number(item.quantity??1),
          splitMode: item.splitMode ?? (Number(item.quantity??1)>1 ? "units" : "shared"),
          name: item.name.trim(),
          price: lineTotal(item),
          shares: (assignNow ? units(item)?Object.keys(item.assignedUnits??{}).filter(id=>item.assignedUnits![id]>0):item.assignedPersonIds : (!editingExpense&&actor&&mine[item.id]?[actor]:[])).map((personId) => {
            const originalShare = item.originalShares?.find(
              (share) => share.personId === personId,
            );
            return {
              personId,
              ...(units(item)
                ? { units: assignNow ? item.assignedUnits?.[personId] ?? 1 : Math.min(mine[item.id]??1, Number(item.quantity??1)) }
                : originalShare
                  ? { amount: originalShare.amount }
                  : {}),
            };
          })
        }))
      };

      if (editingExpense) {
        await api.updateExpense(slug, editingExpense.id, {
          ...body,
          expectedUpdatedAt: editingExpense.updatedAt,
        });
      } else {
        const createBody={...body,requestId};
        try{
          if(!navigator.onLine)throw new TypeError("offline");
          await api.createExpense(slug,createBody);
        }catch(e){
          if(!(e instanceof TypeError))throw e;
          await queueBill(slug,actor,baseCurrency,createBody);
          void syncBills().catch(()=>{});
        }
      }

      setSaved(true);
      navigate(`/g/${slug}`);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : t("somethingWentWrong")
      );
    } finally {
      setSaving(false);
    }
  };

  const preview = useMemo(() => {
    if (!group) return { rows: [] as { id: string; name: string; cents: number }[], open: 0 };
    const name = (id: string) => group.people.find((p) => p.id === id)?.name ?? "?";
    if (equalMode) {
      const total = Math.round((Number(equalAmount) || 0) * 100);
      const ids = equalParticipantIds;
      if (!total || !ids.length) return { rows: [], open: 0 };
      const alloc = equalSplitMode === "equal"
        ? allocateEqualShares(total, ids, Object.fromEntries(ids.map((id) => [id, "1"])), "weight")
        : allocateEqualShares(total, ids, equalSplitValues, equalSplitMode);
      return { rows: ids.map((id, i) => ({ id, name: name(id), cents: alloc.valid ? alloc.shares[i] ?? 0 : 0 })), open: 0 };
    }
    const acc: Record<string, number> = {};
    let open = 0;
    for (const item of draftItems) {
      const line = Math.round(lineTotal(item) * 100);
      if (!Number.isFinite(line) || line <= 0) continue;
      const qty = Number(item.quantity ?? 1) || 1;
      if (assignNow || editingExpense) {
        if (units(item)) {
          let used = 0;
          for (const [id, u] of Object.entries(item.assignedUnits ?? {})) { if (u > 0) { const c = Math.round(line * u / qty); acc[id] = (acc[id] ?? 0) + c; used += c; } }
          open += line - used;
        } else if (item.assignedPersonIds.length) {
          const n = item.assignedPersonIds.length, base = Math.floor(line / n);
          item.assignedPersonIds.forEach((id, i) => { acc[id] = (acc[id] ?? 0) + base + (i < line - base * n ? 1 : 0); });
        } else open += line;
      } else if (actor && mine[item.id]) {
        const c = units(item) ? Math.round(line * Math.min(mine[item.id], qty) / qty) : line;
        acc[actor] = (acc[actor] ?? 0) + c; open += line - c;
      } else open += line;
    }
    return { rows: Object.entries(acc).map(([id, cents]) => ({ id, name: name(id), cents })), open };
  }, [group, equalMode, equalAmount, equalParticipantIds, equalSplitMode, equalSplitValues, draftItems, assignNow, editingExpense, actor, mine]);
  const saveRef = useRef(saveDraftBill);
  saveRef.current = saveDraftBill;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); void saveRef.current(); }
      else if (e.key === "Escape" && !document.querySelector(".zOverlay")) navigate(`/g/${slug}`);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, slug]);
  const money = (c: number) => (c / 100).toFixed(2).replace(".", ",") + " " + (currency === "EUR" ? "€" : currency);
  const payerName = multiple ? t("manyPayers") : group?.people.find((p) => p.id === single)?.name;
  const myCents = preview.rows.find((r) => r.id === actor)?.cents ?? 0;
  const previewPanel = (
    <aside className="zExpPreview" aria-live="polite">
      <div className="zLbl">{t("splitPreviewTitle")}</div>
      <div className="zExpPreviewTotal">{money(Math.round(itemTotal * 100))}</div>
      <div className="zMuted">{payerName ? t("paidByName").replace("{name}", payerName) : t("billPayers")}{preview.rows.length > 1 ? ` · ${preview.rows.length} ${t("peopleShort")}` : ""}</div>
      <div className="zExpPreviewRows">
        {preview.rows.map((r) => (
          <div key={r.id} className="zExpPreviewRow"><span className="zAv s">{avInner(r.name,avatars[r.id])}</span><b>{r.name}{r.id === actor ? ` (${t("youShort")})` : ""}</b><span>{money(r.cents)}</span></div>
        ))}
        {preview.open > 0 && <div className="zExpPreviewRow open"><span className="zAv s">?</span><b>{t("waitingForPicks")}</b><span>{money(preview.open)}</span></div>}
        {!preview.rows.length && !preview.open && <p className="zMuted">{t("splitPreviewEmpty")}</p>}
      </div>
      {actor && preview.rows.length > 0 && <div className="zExpPreviewMine"><span>{t("yourShareLabel")}</span><b>{money(myCents)}</b></div>}
      <button className="zBtn zExpPreviewSave" type="button" onClick={saveDraftBill} disabled={!group || group.locked || saving}>{editingExpense ? t("saveChanges") : t("createExpense")} <span className="kbd">Ctrl ↵</span></button>
    </aside>
  );

  if (!group) return null;

  return (
    <main className="page wide">
      {saving && (
        <div className="screenLoader">
          <div className="spinner large" />
        </div>
      )}

      {actionError && <div className="toastError">{actionError}</div>}

      <div className="zTop zExpenseTop"><Link className="zBack" to={`/g/${slug}`} aria-label={t("backToGroup")}>&#8249;</Link>
        <h1 className="zH2" style={{ flex: 1, textAlign: "center" }}>{editingExpense ? t("editExpense") : t("newExpense")}</h1><span style={{ width: 44 }} /></div>

      <div className="zExpGrid">
      <section className="card formCard">
        <div className="sectionHeaderWithButton">
          <div>
            <p className="zMuted" style={{ margin: 0 }}>{currency}</p>
          </div>
          <div className="randomSplitHeaderAction">
            <strong>{itemTotal.toFixed(2)}</strong>
          </div>
        </div>

        {/* ITEMS */}
        <div className="form">
          {!editingExpense && entryMode === "equal" && <div className="zAmountHero">              <label className="zAmountLabel">
                <span>{t("amount")} ({currency})</span>
                <input
                  className="equalExpenseAmount zAmountInput"
                  type="text"
                  inputMode="decimal"
                  value={showDec(equalAmount)}
                  onBlur={() => setEqualAmount((v) => fix2(v))}
                  onChange={(event) => {
                    setEqualAmount(sanitizeDecimalInput(event.target.value));
                    setFieldErrors((current) => ({ ...current, equalAmount: "" }));
                  }}
                  placeholder={decSep === "," ? "0,00" : "0.00"}
                  disabled={group.locked}
                  aria-invalid={Boolean(fieldErrors.equalAmount)}
                />
                {fieldErrors.equalAmount && <span className="validationMessage">{fieldErrors.equalAmount}</span>}
              </label>
          </div>}
          {!editingExpense && <div className="expenseModeSelector" role="radiogroup" aria-label={t("newExpense")}>
            <button
              type="button"
              role="radio"
              aria-checked={entryMode === "equal"}
              className={`expenseModeOption${entryMode === "equal" ? " selected" : ""}`}
              disabled={group.locked}
              onClick={() => setEntryMode("equal")}
            >
              <strong>{t("withoutItems")}</strong>
              <span>{t("oneAmountForAll")}</span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={entryMode === "items"}
              className={`expenseModeOption${entryMode === "items" ? " selected" : ""}`}
              disabled={group.locked}
              onClick={() => setEntryMode("items")}
            >
              <strong>{t("byItems")}</strong>
              <span>{t("everyonePicksItems")}</span>
            </button>
          </div>}

          {!editingExpense && entryMode === "items" && <div className="billImageActions">
            {/* Camera */}
            <input
              id="bill-camera"
              className="billImageInput"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleBillAsImage}
              disabled={group.locked || parsingBill}
            />

            <label
              onClick={e=>{if(!navigator.onLine){e.preventDefault();setActionError(t("offlineScan"))}}} htmlFor="bill-camera"
              className="billImageActionButton"
            >
              <Camera size={18} />
              {parsingBill ? t("readingBill") : t("scanBill")}
            </label>

            {/* Upload */}
            <input
              id="bill-image"
              className="billImageInput"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleBillAsImage}
              disabled={group.locked || parsingBill}
            />

            <label
              onClick={e=>{if(!navigator.onLine){e.preventDefault();setActionError(t("offlineScan"))}}} htmlFor="bill-image"
              className="billImageActionButton"
            >
              <ImagePlus size={18} />
              {t("uploadBillImage")}
            </label>

            {billParseRetryAvailable && !billParseRetryUsed && (
              <button
                type="button"
                className="billImageActionButton"
                onClick={handleRetryBillParse}
                disabled={group.locked || parsingBill}
              >
                <RefreshCw size={18} />
                {t("retryBillParse")}
              </button>
            )}
          </div>}
          {!editingExpense && entryMode === "items" && billParseRetryUsed && <p className="billImageHint">{t("billRetryGuidance")}</p>}

          <div className="rpTitle"><label className="rpCategory" title={t(labels[category])}><CategoryIcon category={category}/><select aria-label={t("categoryFilter")} value={override??"auto"} disabled={group.locked} onChange={e=>setOverride(e.target.value==="auto"?null:e.target.value as Category)}><option value="auto">Auto · {t(labels[inferCategory(note)])}</option>{(Object.keys(labels) as Category[]).map(k=><option value={k} key={k}>{t(labels[k])}</option>)}</select></label>
          <input aria-label={t("note")} className="zTitleInput" autoFocus={!editingExpense} enterKeyHint="next" value={note} onChange={e=>setNote(e.target.value)} placeholder={t("billTitlePh")} maxLength={200} disabled={group.locked}/></div>
          <label className="zCurrency">{t("billCurrency")}<select value={currency} disabled={group.locked} onChange={e=>setCurrency(e.target.value)}>{!currencies.some(c=>c.code===baseCurrency)&&<option>{baseCurrency}</option>}{currencies.map(c=><option key={c.code} value={c.code}>{c.code} · {c.name}</option>)}</select></label>
          {!editingExpense && entryMode === "equal" ? (
            <div className="equalExpenseSection">
              <div className="zPeopleSummary">
                <div className="grow"><strong>{t("selectedParticipants")}</strong>
                  <span className="zMuted">{equalParticipantIds.length === group.people.length ? t("everyoneParticipates").replace("{n}", String(group.people.length)) : group.people.filter((p) => equalParticipantIds.includes(p.id)).map((p) => p.name).join(", ") || "—"}{equalSplitMode !== "equal" ? " · " + t(equalSplitMode === "amount" ? "splitModeAmounts" : equalSplitMode === "percent" ? "splitModePercent" : "splitModeWeights") : ""}</span></div>
                <button type="button" className="zPill" aria-expanded={showPeople} onClick={() => setShowPeople((v) => !v)}>{showPeople ? t("doneLabel") : t("chooseWho")}</button>
              </div>
              {fieldErrors.equalParticipants && !showPeople && <p className="validationMessage">{fieldErrors.equalParticipants}</p>}
              <div className="equalExpenseParticipants" hidden={!showPeople}>
                <p className="muted">{t("chooseParticipantsHint")}</p>
                <div className="sharePicker">
                  {group.people.map((person) => {
                    const selected = equalParticipantIds.includes(person.id);
                    return (
                      <button
                        key={person.id}
                        type="button"
                        className={`expenseModeParticipant${selected ? " selected" : ""}`}
                        aria-pressed={selected}
                        disabled={group.locked}
                        onClick={() => {
                          setEqualParticipantIds((current) =>
                            current.includes(person.id)
                              ? current.filter((id) => id !== person.id)
                              : [...current, person.id],
                          );
                          setFieldErrors((current) => ({ ...current, equalParticipants: "" }));
                        }}
                      >
                        {person.name}
                      </button>
                    );
                  })}
                </div>
                {fieldErrors.equalParticipants && <p className="validationMessage">{fieldErrors.equalParticipants}</p>}
                <div className="equalSplitModes" role="group" aria-label={t("split")}>
                  {([
                    ["equal", t("splitEqually")],
                    ["amount", t("splitModeAmounts")],
                    ["percent", t("splitModePercent")],
                    ["weight", t("splitModeWeights")],
                  ] as const).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      className={`expenseModeParticipant${equalSplitMode === mode ? " selected" : ""}`}
                      aria-pressed={equalSplitMode === mode}
                      disabled={group.locked}
                      onClick={() => {
                        setEqualSplitMode(mode);
                        setFieldErrors((current) => ({ ...current, equalSplit: "" }));
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {equalSplitMode !== "equal" && (
                  <div className="equalSplitValues">
                    <p className="muted">
                      {t(
                        equalSplitMode === "amount"
                          ? "splitAmountHint"
                          : equalSplitMode === "percent"
                            ? "splitPercentHint"
                            : "splitWeightHint",
                      )}
                    </p>
                    {group.people.filter((person) => equalParticipantIds.includes(person.id)).map((person) => (
                      <label key={person.id}>
                        <span>
                          {person.name} ({equalSplitMode === "amount"
                            ? currency
                            : equalSplitMode === "percent" ? "%" : t("splitModeWeights")})
                        </span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={equalSplitValues[person.id] ?? ""}
                          onChange={(event) => {
                            setEqualSplitValues((current) => ({
                              ...current,
                              [person.id]: sanitizeDecimalInput(event.target.value),
                            }));
                            setFieldErrors((current) => ({ ...current, equalSplit: "" }));
                          }}
                          disabled={group.locked}
                        />
                      </label>
                    ))}
                    {fieldErrors.equalSplit && <p className="validationMessage">{fieldErrors.equalSplit}</p>}
                  </div>
                )}
              </div>
            </div>
          ) : (
          <div hidden={!editingExpense && entryMode !== "items"}>
            <h3 className="zLbl zItemsHead">{t("billItems")}</h3>

            {scanPreview?<div className="rpPicker zScanReview">{actor&&!assignNow&&<p className="zLbl">{t("markYoursNow")}</p>}{draftItems.map(i=>{const q=Number(i.quantity||1);const m=mine[i.id]??0;return <div className="rpContribution zMineRow" key={i.id}>{actor&&!assignNow&&(units(i)?<span className="zMineStep"><button type="button" aria-label={"− "+i.name} disabled={m<=0} onClick={()=>setMine(x=>({...x,[i.id]:Math.max(0,m-1)}))}>−</button><b>{m}</b><button type="button" aria-label={"+ "+i.name} disabled={m>=q} onClick={()=>setMine(x=>({...x,[i.id]:Math.min(q,m+1)}))}>+</button></span>:<button type="button" role="checkbox" aria-checked={!!m} aria-label={i.name} className={"zCheck"+(m?" on":"")} onClick={()=>setMine(x=>({...x,[i.id]:m?0:1}))}>{m?"✓":""}</button>)}<b>{i.name}</b><span>{q} × {i.price} · {lineTotal(i).toFixed(2)}</span></div>})}<button type="button" className="secondaryButton" onClick={()=>setScanPreview(false)}>{t("editExpense")}</button></div>:<div className="list">
              <div className="zToggleRow">
                <span className="grow"><b>{t("assignNow")}</b><small>{t("assignNowHint")}</small></span>
                <button type="button" role="switch" aria-checked={assignNow} aria-label={t("assignNow")} disabled={group.locked} className={"zToggle" + (assignNow ? " on" : "")} onClick={() => {
                  const next = !assignNow;
                  setAssignNow(next);
                  if (editingExpense) setDraftItems((current) => current.map((item) => ({ ...item, originalShares: undefined })));
                }} />
              </div>
              <div className="zDraftList">
              {draftItems.map((item) => {
                const q = Number(item.quantity || 1);
                const lt = lineTotal(item);
                const left = Math.max(0, q - Object.values(item.assignedUnits ?? {}).reduce((n, u) => n + (u || 0), 0));
                const setUnits = (personId: string, value: number) => {
                  const other = Object.entries(item.assignedUnits ?? {}).reduce((n, [id, u]) => n + (id === personId ? 0 : u), 0);
                  const v = Math.min(Math.max(0, q - other), Math.max(0, Math.floor(value)));
                  setDraftItems((current) => current.map((entry) => {
                    if (entry.id !== item.id) return entry;
                    const assignedUnits = { ...entry.assignedUnits, [personId]: v };
                    return { ...entry, originalShares: undefined, assignedUnits, assignedPersonIds: v > 0 ? [...new Set([...entry.assignedPersonIds, personId])] : entry.assignedPersonIds.filter((id) => id !== personId) };
                  }));
                };
                const m = mine[item.id] ?? 0;
                return (
                <div key={item.id} className="zDraftItem">
                  <div className="zDraftTop">
                    <span className="zDraftNo">{item.ordinalNumber}</span>
                    <label className="zDraftName">
                      <input value={item.name} onChange={(event) => updateDraftItem(item.id, "name", event.target.value)} placeholder={t("itemName")} aria-label={t("itemName")} disabled={group.locked} aria-invalid={Boolean(fieldErrors[`item-${item.id}-name`])} />
                      {fieldErrors[`item-${item.id}-name`] && <span className="validationMessage">{fieldErrors[`item-${item.id}-name`]}</span>}
                    </label>
                  <div className="zDraftMid">
                      <label className="zDraftPrice">
                        <input type="text" inputMode="decimal" value={showDec(item.price)} onChange={(event) => updateDraftItem(item.id, "price", sanitizeDecimalInput(event.target.value))} onBlur={() => { const f = fix2(item.price); if (f !== item.price) updateDraftItem(item.id, "price", f); }} placeholder={decSep === "," ? "0,00" : "0.00"} aria-label={`${t("price")} (${currency})`} disabled={group.locked} aria-invalid={Boolean(fieldErrors[`item-${item.id}-price`])} />
                        <span>{currency}</span>
                      </label>
                      <span className="zDraftX">×</span>
                      <span className="rpQty"><button type="button" disabled={group.locked||Number(item.quantity||1)<=1} aria-label={"− "+item.name} onClick={()=>updateDraftItem(item.id,"quantity",String(Number(item.quantity||1)-1))}>−</button><input disabled={group.locked} type="number" min="1" max="999" step="1" value={item.quantity??"1"} onChange={e=>updateDraftItem(item.id,"quantity",e.target.value)} aria-invalid={Boolean(fieldErrors[`item-${item.id}-quantity`])}/><button type="button" disabled={group.locked||Number(item.quantity||1)>=999} aria-label={"+ "+item.name} onClick={()=>updateDraftItem(item.id,"quantity",String(Number(item.quantity||1)+1))}>+</button></span>
                      <b className="zDraftTotal">{Number.isFinite(lt) ? lt.toFixed(2).replace(".", ",") : "0,00"} {currency}</b>
                    </div>
                    <button type="button" className="zDraftDel" onClick={() => removeDraftItem(item.id)} disabled={group.locked || draftItems.length <= 1} aria-label={`${t("removeItem")}: ${item.name || item.ordinalNumber}`} title={t("removeItem")}><Trash2 size={17} /></button>
                  </div>
                  {(fieldErrors[`item-${item.id}-price`] || fieldErrors[`item-${item.id}-quantity`]) && <span className="validationMessage">{fieldErrors[`item-${item.id}-price`] || fieldErrors[`item-${item.id}-quantity`]}</span>}
                  {assignNow && (
                    <div className="zDraftPeople" role="group" aria-label={t("assignedTo")}>
                      {group.people.map((person) => {
                        if (units(item)) {
                          const u = item.assignedUnits?.[person.id] ?? 0;
                          return (
                            <span key={person.id} className={"zPChip zPChipStep" + (u > 0 ? " on" : "")}>
                              <i>{person.name.charAt(0).toUpperCase()}</i><span>{person.name}</span>
                              <button type="button" aria-label={`− ${person.name}`} disabled={group.locked || u <= 0} onClick={() => setUnits(person.id, u - 1)}>−</button>
                              <b>{u}</b>
                              <button type="button" aria-label={`+ ${person.name}`} disabled={group.locked || left <= 0} onClick={() => setUnits(person.id, u + 1)}>+</button>
                            </span>
                          );
                        }
                        const checked = item.assignedPersonIds.includes(person.id);
                        return (
                          <button key={person.id} type="button" role="checkbox" aria-checked={checked} disabled={group.locked} className={"zPChip" + (checked ? " on" : "")} onClick={() => updateDraftItem(item.id, "assignedPersonIds", checked ? item.assignedPersonIds.filter((id) => id !== person.id) : [...item.assignedPersonIds, person.id])}>
                            <i>{checked ? "✓" : person.name.charAt(0).toUpperCase()}</i><span>{person.name}</span>
                          </button>
                        );
                      })}
                      {units(item) && <small className="zMuted">{t("unitsLeft").replace("{n}", String(left))}</small>}
                    </div>
                  )}
                  {!assignNow && !editingExpense && actor && (
                    <div className="zDraftPeople">
                      {units(item)
                        ? <span className={"zPChip zPChipStep" + (m > 0 ? " on" : "")}><span>{t("mineUnits")}</span><button type="button" aria-label={`− ${t("mineUnits")}`} disabled={m <= 0} onClick={() => setMine((x) => ({ ...x, [item.id]: Math.max(0, m - 1) }))}>−</button><b>{m}</b><button type="button" aria-label={`+ ${t("mineUnits")}`} disabled={m >= q} onClick={() => setMine((x) => ({ ...x, [item.id]: Math.min(q, m + 1) }))}>+</button></span>
                        : <button type="button" role="checkbox" aria-checked={!!m} className={"zPChip" + (m ? " on" : "")} onClick={() => setMine((x) => ({ ...x, [item.id]: m ? 0 : 1 }))}><i>{m ? "✓" : "+"}</i><span>{t("thisIsMine")}</span></button>}
                    </div>
                  )}
                </div>
                );
              })}
              </div>
              <button type="button" className="zAddItem" onClick={() => { setScanPreview(false); addDraftItem(); }} disabled={group.locked}><Plus size={18} />{t("addItems")}</button>
            </div>
            }{fieldErrors.items && <p className="validationMessage">{fieldErrors.items}</p>}
          </div>)}

          {/* PAYERS */}
          <div
            className="payersSection"
          >
            {(()=>{const payer=group.people.find(p=>p.id===single);return <>
            <button type="button" className={"zPayerBtn"+(payerOpen?" open":"")} aria-expanded={payerOpen} onClick={()=>setPayerOpen(!payerOpen)}>
              <span className="zPayerAv">{multiple?<Users size={18}/>:avInner(payer?.name||"?",avatars[single])}</span>
              <span className="grow"><small>{t("paidBy")}</small><b>{multiple?t("manyPayers"):payer?.name||t("billPayers")}</b></span>
              <ChevronDown size={20} className="zPayerChev"/>
            </button>
            {payerOpen&&<div className="zPayerPanel">
              <div className="zSeg2" role="tablist">{[false,true].map(v=><button key={String(v)} type="button" role="tab" aria-selected={v===multiple} className={v===multiple?"on":""} disabled={group.locked} onClick={()=>{setMultiple(v);setFieldErrors({})}}>{t(v?"manyPayers":"onePayer")}</button>)}</div>
              <div className="zPayerList">{group.people.map(p=>multiple
                ?<label className="zPayerRow" key={p.id}><span className="zPayerAv sm">{avInner(p.name,avatars[p.id])}</span><span className="grow"><b>{p.name}</b></span><span className="zPayerAmt"><input inputMode="decimal" placeholder="0,00" disabled={group.locked} value={showDec(amounts[p.id])} onBlur={()=>setAmounts(prev=>({...prev,[p.id]:fix2(prev[p.id])}))} onChange={e=>{const v=sanitizeDecimalInput(e.target.value);setAmounts(prev=>({...prev,[p.id]:v}))}} aria-invalid={!!fieldErrors["payer-"+p.id+"-amount"]} aria-label={p.name}/><i>{currency==="EUR"?"€":currency}</i></span></label>
                :<button type="button" key={p.id} role="radio" aria-checked={single===p.id} className={"zPayerRow"+(single===p.id?" on":"")} disabled={group.locked} onClick={()=>{setSingle(p.id);setPayerOpen(false)}}><span className="zPayerAv sm">{avInner(p.name,avatars[p.id])}</span><span className="grow"><b>{p.name}</b>{p.id===actor&&<small>{t("youShort")}</small>}</span><span className="zPayerCheck">{single===p.id&&<Check size={16}/>}</span></button>)}</div>
            </div>}</>})()}
            {fieldErrors.payers && <p className="validationMessage">{fieldErrors.payers}</p>}
          </div>

          {/* TOTALS */}
          <div
            className="totalsCard"
            hidden={equalMode || Math.abs(difference) < 0.01}
          >
            <div className="settlement">
              <span>{t("itemsTotal")}</span>
              <strong>{itemTotal.toFixed(2)}</strong>
            </div>
            <div className="settlement">
              <span>{t("paidTotal")}</span>
              <strong>{payerTotal.toFixed(2)}</strong>
            </div>
            <div className="settlement">
              <span>{t("unassignedTotal")}</span>
              <strong>{unassignedAmount.toFixed(2)}</strong>
            </div>
            <div className="settlement">
              <span>{t("difference")}</span>
              <strong className={Math.abs(difference) < 0.01 ? "success" : "zNegText"}>
                {difference.toFixed(2)}
              </strong>
            </div>
          </div>
          {quoteError&&<p role="alert">{quoteError}</p>}{currency!==baseCurrency&&quote?.base===currency&&<p>≈ {(itemTotal*quote.rate).toFixed(2)} {baseCurrency} · 1 {currency} = {quote.rate} {baseCurrency}</p>}
          {fieldErrors.paymentTotal && <p className="validationMessage">{fieldErrors.paymentTotal}</p>}
          {fieldErrors.assignmentTotal && <p className="validationMessage">{fieldErrors.assignmentTotal}</p>}

          {(paymentOverpaid || assignmentAmountInvalid) && (
            <div className="zInlineError" role="alert">
              {paymentOverpaid
                ? t("overpaidMsg").replace("{paid}", payerTotal.toFixed(2)).replace("{total}", itemTotal.toFixed(2))
                : t("overassignedMsg").replace("{total}", itemTotal.toFixed(2))}
            </div>
          )}

          <div className="zBottom"><button
            className="zBtn"
            type="button"
            onClick={saveDraftBill}
            disabled={group.locked || saving}
          >
            {editingExpense ? t("saveChanges") : t("createExpense")} · {itemTotal.toFixed(2).replace(".", ",")} {currency === "EUR" ? "€" : currency}
          </button></div>
        </div>
      </section>
      {previewPanel}
      </div>


    </main>
  );
};