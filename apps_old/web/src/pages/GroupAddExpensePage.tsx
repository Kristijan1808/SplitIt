import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { useLanguage } from "../i18n";
import type { Group } from "@splitit/shared";

type DraftItem = {
  id: string;
  name: string;
  price: string;
  assignedPersonId: string;
};

type DraftPayer = {
  id: string;
  personId: string;
  amount: string;
};

const getStoredGroupParticipantId = (slug: string) => {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(`splititGroupParticipantId:${slug}`);
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
            assignedPersonId: ""
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
        if (!item.assignedPersonId) return sum;
        const value = Number(item.price);
        return sum + (Number.isFinite(value) && value > 0 ? value : 0);
      }, 0),
    [draftItems]
  );

  const updateDraftItem = (
    id: string,
    field: keyof Omit<DraftItem, "id">,
    value: string
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
        assignedPersonId: ""
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

  const saveDraftBill = async () => {
    if (!group || group.locked) return;

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

    try {
      setSaving(true);
      setActionError("");

      await api.createDraftExpense(slug, {
        note: note.trim() || undefined,
        payers: validPayers.map((payer) => ({
          personId: payer.personId,
          amount: Number(payer.amount)
        })),
        items: validItems.map((item) => ({
          name: item.name.trim(),
          price: Number(item.price),
          // Empty means "assign later". It must be sent as null.
          assignedPersonId: item.assignedPersonId || null
        }))
      });

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

        <p className="muted" style={{ marginTop: -8, marginBottom: 20 }}>
          {t("draftBillHint")}
        </p>

        {/* ITEMS */}
        <div className="form">
          <div>
            <div className="sectionHeaderWithButton" style={{ marginBottom: 10 }}>
              <div>
                <strong>{t("billItems")}</strong>
                <p className="muted">{t("itemAssignmentHint")}</p>
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
                  <div className="inlineInput" style={{ gap: 10, alignItems: "end" }}>
                    <label style={{ flex: 2 }}>
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

                    <label style={{ flex: 1 }}>
                      <span>{t("price")}</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.price}
                        onChange={(event) =>
                          updateDraftItem(item.id, "price", event.target.value)
                        }
                        placeholder="0.00"
                        disabled={group.locked}
                      />
                    </label>

                    <label style={{ flex: 1.4 }}>
                      <span>{t("assignedTo")}</span>
                      <select
                        value={item.assignedPersonId}
                        onChange={(event) =>
                          updateDraftItem(
                            item.id,
                            "assignedPersonId",
                            event.target.value
                          )
                        }
                        disabled={group.locked}
                      >
                        <option value="">{t("noItemAssigned")}</option>
                        {group.people.map((person) => (
                          <option key={person.id} value={person.id}>
                            {person.name}
                          </option>
                        ))}
                      </select>
                    </label>

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
                  <div key={payer.id} className="inlineInput" style={{ gap: 10, alignItems: "end" }}>
                    <label style={{ flex: 1.5 }}>
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

                    <label style={{ flex: 1 }}>
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
              <strong>{Math.max(0, itemTotal - assignedTotal).toFixed(2)}</strong>
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

          <button
            className="primaryButton"
            type="button"
            onClick={saveDraftBill}
            disabled={group.locked || saving}
          >
            <Plus size={18} />
            {t("saveDraft")}
          </button>
        </div>
      </section>
    </main>
  );
};
