import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ImagePlus, Plus, Trash2 } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { useLanguage } from "../i18n";
import type { Group } from "@splitit/shared";

type DraftItem = {
  id: string;
  name: string;
  price: string;
  assignedPersonIds: string[];
};

type DraftPayer = {
  id: string;
  personId: string;
  amount: string;
};


const sanitizeDecimalInput = (value: string): string => {
  const sanitized = value.replace(/[^0-9.]/g, "");
  const firstDotIndex = sanitized.indexOf(".");

  if (firstDotIndex === -1) {
    return sanitized;
  }

  return (
    sanitized.slice(0, firstDotIndex + 1) +
    sanitized.slice(firstDotIndex + 1).replace(/\./g, "")
  );
};

export const GroupAddExpensePage = () => {
  const navigate = useNavigate();
  const { slug = "" } = useParams();
  const { t } = useLanguage();

  const [group, setGroup] = useState<Group | null>(null);
  const [note, setNote] = useState("");
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [draftPayers, setDraftPayers] = useState<DraftPayer[]>([]);
  const [actionError, setActionError] = useState("");
  const [saving, setSaving] = useState(false);
  const [parsingBill, setParsingBill] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const currentGroup = await api.getGroup(slug);
        setGroup(currentGroup);

        setDraftItems([
          {
            id: crypto.randomUUID(),
            name: "",
            price: "",
            assignedPersonIds: []
          }
        ]);

        setDraftPayers([]);
      } catch {
        navigate(`/g/${slug}`);
      }
    };

    void load();
  }, [slug, navigate]);

  const itemTotal = useMemo(
    () =>
      draftItems.reduce((sum, item) => {
        const value = Number(item.price);
        return sum + (Number.isFinite(value) && value >= 0 ? value : 0);
      }, 0),
    [draftItems]
  );

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
    () =>
      draftItems.reduce((sum, item) => {
        if (item.assignedPersonIds.length === 0) return sum;
        const value = Number(item.price);
        return sum + (Number.isFinite(value) && value > 0 ? value : 0);
      }, 0),
    [draftItems]
  );

  const unassignedAmount = Number((itemTotal - assignedTotal).toFixed(2));

  const allItemsAssigned = useMemo(
    () =>
      draftItems.length > 0 &&
      draftItems.every((item) => item.assignedPersonIds.length > 0),
    [draftItems]
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
    field: keyof Omit<DraftItem, "id">,
    value: string | string[]
  ) => {
    setDraftItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const addDraftItem = () => {
    setDraftItems((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        name: "",
        price: "",
        assignedPersonIds: []
      }
    ]);
  };

  const removeDraftItem = (id: string) => {
    setDraftItems((current) => {
      if (current.length <= 1) return current;
      return current.filter((item) => item.id !== id);
    });
  };

  const addDraftPayer = () => {
    if (!group || group.people.length === 0) return;

    const usedPersonIds = new Set(draftPayers.map((payer) => payer.personId));
    const availablePerson =
      group.people.find((person) => !usedPersonIds.has(person.id)) ??
      group.people[0];

    setDraftPayers((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        personId: availablePerson.id,
        amount: ""
      }
    ]);
  };

  const updateDraftPayer = (
    id: string,
    field: "personId" | "amount",
    value: string
  ) => {
    setDraftPayers((current) =>
      current.map((payer) =>
        payer.id === id ? { ...payer, [field]: value } : payer
      )
    );
  };

  const removeDraftPayer = (id: string) => {
    setDraftPayers((current) =>
      current.filter((payer) => payer.id !== id)
    );
  };

  const handleBillAsImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) return;

    try {
      setParsingBill(true);
      setActionError("");

      const result = await api.parseBillImage(file);

      if (result.items.length === 0) {
        setActionError("No bill items could be recognized from the image.");
        return;
      }

      setDraftItems(
        result.items.map((item) => ({
          id: crypto.randomUUID(),
          name: item.name,
          price: item.price.toFixed(2),
          assignedPersonIds: []
        }))
      );
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Unable to read the bill image."
      );
    } finally {
      setParsingBill(false);
      event.target.value = "";
    }
  };

  const saveDraftBill = async () => {
    if (!group || group.locked || paymentOverpaid || assignmentAmountInvalid) return;

    const validItems = draftItems.filter(
      (item) =>
        item.name.trim().length > 0 &&
        Number.isFinite(Number(item.price)) &&
        Number(item.price) >= 0
    );

    if (validItems.length === 0) {
      setActionError(t("atLeastOneItem"));
      return;
    }

    const allValidItemsAssigned = validItems.every(
      (item) => item.assignedPersonIds.length > 0
    );

    const validItemsTotal = validItems.reduce(
      (sum, item) => sum + Number(item.price),
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
      return;
    }

    const payerIds = validPayers.map((payer) => payer.personId);
    if (new Set(payerIds).size !== payerIds.length) {
      setActionError(t("duplicatePayer"));
      return;
    }

    const validPayersTotal = validPayers.reduce(
      (sum, payer) => sum + Number(payer.amount),
      0
    );

    const validAssignedTotal = validItems.reduce((sum, item) => {
      if (item.assignedPersonIds.length === 0) return sum;
      const value = Number(item.price);
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
    if (allValidItemsAssigned) {
      if (finalUnassignedAmount < -0.009) {
        setActionError(
          "Assigned amount cannot be greater than the total of all items."
        );
        return;
      }

      if (Math.abs(finalUnassignedAmount) >= 0.01) {
        setActionError(
          "All item amounts must be assigned before adding the expense."
        );
        return;
      }

      if (Math.abs(finalPaymentDifference) >= 0.01) {
        setActionError(
          `Paid total must equal the item total (${validItemsTotal.toFixed(2)}).`
        );
        return;
      }
    }

    try {
      setSaving(true);
      setActionError("");

      const draft = await api.createDraftExpense(slug, {
        note: note.trim() || undefined,
        payers: validPayers.map((payer) => ({
          personId: payer.personId,
          amount: Number(payer.amount)
        })),
        items: validItems.map((item) => ({
          name: item.name.trim(),
          price: Number(item.price),
          shares: item.assignedPersonIds.map((personId) => ({
            personId
          }))
        }))
      });

      if (allValidItemsAssigned) {
        await api.confirmDraftExpense(slug, draft.id);
      }

      navigate(`/g/${slug}`);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : t("somethingWentWrong")
      );
    } finally {
      setSaving(false);
    }
  };

  if (!group) return null;

  return (
    <main className="page wide">
      {saving && (
        <div className="screenLoader">
          <div className="spinner large" />
        </div>
      )}

      {actionError && <div className="toastError">{actionError}</div>}

      <Link className="backLink" to={`/g/${slug}`}>
        <ArrowLeft size={18} />
        {t("backToGroup")}
      </Link>

      <section className="card formCard">
        <div className="sectionHeaderWithButton">
          <div>
            <p className="eyebrow">{t("draftBill")}</p>
            <h2>{t("addItems")}</h2>
          </div>
          <strong>{itemTotal.toFixed(2)}</strong>
        </div>

        {/* ITEMS */}
        <div className="form">
          <div className="billImageUpload">
          <input
            id="bill-image"
            className="billImageInput"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleBillAsImage}
            disabled={group.locked || parsingBill}
          />

          <label
            htmlFor="bill-image"
            className="billImageUploadButton"
          >
            <ImagePlus size={18} />
            {parsingBill ? t("readingBill") : t("uploadBillImage")}
          </label>

          <p className="billImageHint">
            {t("uploadBillImageHint")}
          </p>
        </div>
          <div>
            <div className="sectionHeaderWithButton" style={{ marginBottom: 10 }}>
              <div>
                <strong>{t("billItems")}</strong>
              </div>
              <button
                type="button"
                className="secondaryButton"
                onClick={addDraftItem}
                disabled={group.locked}
              >
                <Plus size={18} />
                {t("addItems")}
              </button>
            </div>

            <div className="list">
              {draftItems.map((item, index) => (
                <div
                  key={item.id}
                  className="card"
                  style={{ padding: 14, margin: 0 }}
                >
                  <div className="draftItemEditor">
                    <label>
                      <span>{t("itemName")}</span>
                      <input
                        value={item.name}
                        onChange={(event) =>
                          updateDraftItem(item.id, "name", event.target.value)
                        }
                        placeholder={t("itemPlaceholder")}
                        disabled={group.locked}
                      />
                    </label>

                    <label>
                      <span>{t("price")}</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={item.price}
                        onChange={(event) =>
                          updateDraftItem(
                            item.id,
                            "price",
                            sanitizeDecimalInput(event.target.value)
                          )
                        }
                        placeholder="0.00"
                        disabled={group.locked}
                      />
                    </label>

                    <div className="draftItemShares">
                      <span>{t("assignedTo")}</span>
                      <div className="sharePicker">
                        {group.people.map((person) => {
                          const checked = item.assignedPersonIds.includes(person.id);
                          return (
                            <label key={person.id} className="shareOption">
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={group.locked}
                                onChange={() => {
                                  const next = checked
                                    ? item.assignedPersonIds.filter((id) => id !== person.id)
                                    : [...item.assignedPersonIds, person.id];
                                  updateDraftItem(item.id, "assignedPersonIds", next);
                                }}
                              />
                              <span>{person.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="iconButton"
                      onClick={() => removeDraftItem(item.id)}
                      disabled={group.locked || draftItems.length <= 1}
                      title={t("removeItem")}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>

                  <small className="muted">
                    {t("itemNumber")}: {index + 1}
                  </small>
                </div>
              ))}
            </div>
          </div>

          {/* PAYERS */}
          <div
            style={{
              marginTop: 8,
              paddingTop: 20,
              borderTop: "1px solid var(--border-color)"
            }}
          >
            <div className="sectionHeaderWithButton" style={{ marginBottom: 10 }}>
              <div>
                <strong>{t("billPayers")}</strong>
                <p className="muted">{t("billPayersHint")}</p>
              </div>
              <button
                type="button"
                className="secondaryButton"
                onClick={addDraftPayer}
                disabled={group.locked}
              >
                <Plus size={18} />
                {t("addPayer")}
              </button>
            </div>

            {draftPayers.length === 0 ? (
              <p className="muted">{t("noPayersAdded")}</p>
            ) : (
              <div className="list">
                {draftPayers.map((payer) => (
                  <div key={payer.id} className="draftPayerEditor">
                    <label>
                      <span>{t("paidBy")}</span>
                      <select
                        value={payer.personId}
                        onChange={(event) =>
                          updateDraftPayer(payer.id, "personId", event.target.value)
                        }
                        disabled={group.locked}
                      >
                        {group.people.map((person) => (
                          <option key={person.id} value={person.id}>
                            {person.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      <span>{t("amount")}</span>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={payer.amount}
                        onChange={(event) =>
                          updateDraftPayer(payer.id, "amount", event.target.value)
                        }
                        placeholder="0.00"
                        disabled={group.locked}
                      />
                    </label>

                    <button
                      type="button"
                      className="iconButton"
                      onClick={() => removeDraftPayer(payer.id)}
                      disabled={group.locked}
                      title={t("removePayer")}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* TOTALS */}
          <div
            className="card"
            style={{
              padding: 16,
              margin: 0,
              display: "grid",
              gap: 8
            }}
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
              <strong className={Math.abs(difference) < 0.01 ? "success" : "toastError"}>
                {difference.toFixed(2)}
              </strong>
            </div>
          </div>

          <label>
            {t("note")}
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={t("billNote")}
              disabled={group.locked}
            />
          </label>

          {(paymentOverpaid || assignmentAmountInvalid) && (
            <div className="toastError" role="alert">
              {paymentOverpaid
                ? `Paid amount (${payerTotal.toFixed(2)}) cannot be greater than the item total (${itemTotal.toFixed(2)}). Please check the payer amounts.`
                : `Assigned amount cannot be greater than the item total (${itemTotal.toFixed(2)}). Please check the item assignments.`}
            </div>
          )}

          <button
            className="primaryButton"
            type="button"
            onClick={saveDraftBill}
            disabled={group.locked || saving || paymentOverpaid || assignmentAmountInvalid}
          >
            <Plus size={18} />
            {canAddExpense ? t("addExpense") : t("saveDraft")}
          </button>
        </div>
      </section>
    </main>
  );
};