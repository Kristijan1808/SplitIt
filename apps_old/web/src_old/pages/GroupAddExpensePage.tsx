import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, Plus } from "lucide-react";
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

  return window.localStorage.getItem(
    `splititGroupParticipantId:${slug}`
  );
};

export const GroupAddExpensePage = () => {
  const navigate = useNavigate();
  const { slug = "" } = useParams();
  const { t } = useLanguage();

  const [group, setGroup] = useState<Group | null>(null);

  const [paymentPersonId, setPaymentPersonId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const [selectedParticipants, setSelectedParticipants] =
    useState<string[]>([]);

  const [multiplePayers, setMultiplePayers] = useState(false);
  const [payerAmounts, setPayerAmounts] =
    useState<Record<string, string>>({});

  const [expenseMode, setExpenseMode] =
    useState<"simple" | "items">("simple");

  const [draftItems, setDraftItems] = useState<DraftItem[]>([
    {
      id: crypto.randomUUID(),
      name: "",
      price: "",
      assignedPersonId: "",
    },
  ]);

  const [draftPayers, setDraftPayers] = useState<DraftPayer[]>([]);

  const [actionError, setActionError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const currentGroup = await api.getGroup(slug);

        setGroup(currentGroup);

        const rememberedParticipantId =
          getStoredGroupParticipantId(slug);

        const defaultPayerId =
          rememberedParticipantId &&
          currentGroup.people.some(
            (person) => person.id === rememberedParticipantId
          )
            ? rememberedParticipantId
            : currentGroup.people[0]?.id ?? "";

        setPaymentPersonId(defaultPayerId);

        setSelectedParticipants(
          currentGroup.people.map((person) => person.id)
        );

        // Draft items are intentionally NOT assigned automatically.
        setDraftItems((current) =>
          current.length > 0
            ? current.map((item) => ({
                ...item,
                assignedPersonId:
                  item.assignedPersonId || "",
              }))
            : [
                {
                  id: crypto.randomUUID(),
                  name: "",
                  price: "",
                  assignedPersonId: "",
                },
              ]
        );

        setDraftPayers([]);
      } catch {
        navigate(`/g/${slug}`);
      }
    };

    void load();
  }, [slug, navigate]);

  const updateDraftItem = (
    id: string,
    field: keyof DraftItem,
    value: string
  ) => {
    setDraftItems((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              [field]: value,
            }
          : item
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
        assignedPersonId: "",
      },
    ]);
  };

  const removeDraftItem = (id: string) => {
    setDraftItems((current) =>
      current.filter((item) => item.id !== id)
    );
  };

  const addDraftPayer = () => {
    if (!group || group.people.length === 0) {
      return;
    }

    const usedPersonIds = new Set(
      draftPayers.map((payer) => payer.personId)
    );

    const availablePerson =
      group.people.find(
        (person) => !usedPersonIds.has(person.id)
      ) ?? group.people[0];

    setDraftPayers((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        personId: availablePerson.id,
        amount: "",
      },
    ]);
  };

  const updateDraftPayer = (
    id: string,
    field: "personId" | "amount",
    value: string
  ) => {
    setDraftPayers((current) =>
      current.map((payer) =>
        payer.id === id
          ? {
              ...payer,
              [field]: value,
            }
          : payer
      )
    );
  };

  const removeDraftPayer = (id: string) => {
    setDraftPayers((current) =>
      current.filter((payer) => payer.id !== id)
    );
  };

  const saveDraftBill = async () => {
    if (!group) return;

    const validItems = draftItems.filter(
      (item) =>
        item.name.trim() &&
        Number.isFinite(Number(item.price)) &&
        Number(item.price) >= 0
    );

    if (validItems.length === 0) {
      setActionError(t("amountMustBePositive"));
      return;
    }

    const validPayers = draftPayers.filter(
      (payer) =>
        payer.personId &&
        Number.isFinite(Number(payer.amount)) &&
        Number(payer.amount) > 0
    );

    try {
      setSaving(true);
      setActionError("");

      await api.createDraftExpense(slug, {
        note: note.trim() || undefined,

        payers: validPayers.map((payer) => ({
          personId: payer.personId,
          amount: Number(payer.amount),
        })),

        items: validItems.map((item) => ({
          name: item.name.trim(),
          price: Number(item.price),

          // IMPORTANT:
          // null means the item has not been assigned yet.
          // The draft must still be saved in this case.
          assignedPersonId:
            item.assignedPersonId || null,
        })),
      });

      navigate(`/g/${slug}`);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : t("somethingWentWrong")
      );
    } finally {
      setSaving(false);
    }
  };

  const executeAction = async (
    callback: () => Promise<Group>
  ) => {
    try {
      setSaving(true);
      setActionError("");

      const nextGroup = await callback();

      setGroup(nextGroup);
      setAmount("");
      setNote("");

      setSelectedParticipants(
        nextGroup.people.map((person) => person.id)
      );

      setPaymentPersonId(
        nextGroup.people[0]?.id ?? ""
      );

      setPayerAmounts({});
      setMultiplePayers(false);

      navigate(`/g/${slug}`);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : t("somethingWentWrong")
      );

      window.setTimeout(
        () => setActionError(""),
        3500
      );
    } finally {
      setSaving(false);
    }
  };

  const addPayment = async (event: FormEvent) => {
    event.preventDefault();

    if (!group || group.locked) return;

    const total = multiplePayers
      ? Object.values(payerAmounts).reduce(
          (sum, value) =>
            sum + Number(value || 0),
          0
        )
      : Number(amount || 0);

    if (!total || total <= 0) {
      setActionError(t("amountMustBePositive"));
      return;
    }

    await executeAction(async () => {
      const payload = multiplePayers
        ? {
            note,

            payerAmounts: group.people
              .filter((person) =>
                Object.prototype.hasOwnProperty.call(
                  payerAmounts,
                  person.id
                )
              )
              .map((person) => ({
                personId: person.id,
                amount: Number(
                  payerAmounts[person.id] ?? 0
                ),
              }))
              .filter(
                (entry) =>
                  Number.isFinite(entry.amount) &&
                  entry.amount > 0
              ),

            participantIds:
              selectedParticipants,
          }
        : {
            amount: total,
            note,
            personId: paymentPersonId,
            participantIds:
              selectedParticipants,
          };

      return api.addPayment(
        slug,
        payload as any
      );
    });
  };

  const toggleParticipant = (
    participantId: string
  ) => {
    setSelectedParticipants((current) =>
      current.includes(participantId)
        ? current.filter(
            (id) => id !== participantId
          )
        : [...current, participantId]
    );
  };

  const selectedParticipantNames = (
    group?.people ?? []
  )
    .filter((person) =>
      selectedParticipants.includes(person.id)
    )
    .map((person) => person.name)
    .join(", ");

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

      {actionError && (
        <div className="toastError">
          {actionError}
        </div>
      )}

      <Link
        className="backLink"
        to={`/g/${slug}`}
      >
        <ArrowLeft size={18} />
        {t("backToGroup")}
      </Link>

      <section className="card formCard">
        <h2>{t("addExpense")}</h2>

        <div
          className="segmentToggle"
          style={{
            display: "flex",
            gap: 12,
            marginBottom: 18,
          }}
        >
          <button
            type="button"
            className={`secondaryButton ${
              expenseMode === "simple"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setExpenseMode("simple")
            }
          >
            {t("addExpense")}
          </button>

          <button
            type="button"
            className={`secondaryButton ${
              expenseMode === "items"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setExpenseMode("items")
            }
          >
            {t("addItems")}
          </button>
        </div>

        {expenseMode === "simple" ? (
          <form
            className="form"
            onSubmit={addPayment}
          >
            <label className="toggleRow">
              <input
                type="checkbox"
                checked={multiplePayers}
                onChange={() =>
                  setMultiplePayers(
                    (current) => !current
                  )
                }
                disabled={group.locked}
              />

              {t("multiplePayers")}
            </label>

            {!multiplePayers ? (
              <>
                <label>
                  {t("paidBy")}

                  <select
                    value={paymentPersonId}
                    onChange={(event) =>
                      setPaymentPersonId(
                        event.target.value
                      )
                    }
                    disabled={group.locked}
                  >
                    {group.people.map(
                      (person) => (
                        <option
                          key={person.id}
                          value={person.id}
                        >
                          {person.name}
                        </option>
                      )
                    )}
                  </select>
                </label>

                <label>
                  {t("amount")}

                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={amount}
                    onChange={(event) =>
                      setAmount(
                        event.target.value
                      )
                    }
                    required
                    disabled={group.locked}
                  />
                </label>
              </>
            ) : (
              <div className="peopleInputs payerInputs">
                {group.people.map(
                  (person) => (
                    <label
                      key={person.id}
                      className="payerInput"
                    >
                      <span>
                        {person.name}
                      </span>

                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={
                          payerAmounts[
                            person.id
                          ] ?? ""
                        }
                        onChange={(event) =>
                          setPayerAmounts(
                            (current) => ({
                              ...current,
                              [person.id]:
                                event.target.value,
                            })
                          )
                        }
                        placeholder="0.00"
                        disabled={group.locked}
                      />
                    </label>
                  )
                )}
              </div>
            )}

            <label>
              {t("note")}

              <input
                value={note}
                onChange={(event) =>
                  setNote(event.target.value)
                }
                placeholder={t(
                  "notePlaceholder"
                )}
                disabled={group.locked}
              />
            </label>

            <div>
              <label>
                {t("splitEqually")}
              </label>

              <div className="peopleInputs checkboxList">
                {group.people.map(
                  (person) => (
                    <label
                      key={person.id}
                      className="accessOption"
                    >
                      <input
                        type="checkbox"
                        checked={selectedParticipants.includes(
                          person.id
                        )}
                        onChange={() =>
                          toggleParticipant(
                            person.id
                          )
                        }
                        disabled={group.locked}
                      />

                      <strong>
                        {person.name}
                      </strong>
                    </label>
                  )
                )}
              </div>

              <p className="muted">
                {t(
                  "chooseParticipantsHint"
                )}
              </p>

              <p className="muted">
                {t("selected")}:{" "}
                {selectedParticipantNames ||
                  t("noOne")}
              </p>
            </div>

            <button
              className="primaryButton"
              type="submit"
              disabled={group.locked}
            >
              <Plus size={18} />
              {t("saveExpense")}
            </button>
          </form>
        ) : (
          <div className="form">
            {/* =========================
                EXPENSE ITEMS
               ========================= */}

            <div className="peopleInputs itemList">
              {draftItems.map((item) => (
                <div
                  key={item.id}
                  className="inlineInput"
                  style={{
                    gap: 8,
                    alignItems: "end",
                  }}
                >
                  <label
                    style={{ flex: 2 }}
                  >
                    <span>
                      {t("itemName")}
                    </span>

                    <input
                      value={item.name}
                      onChange={(event) =>
                        updateDraftItem(
                          item.id,
                          "name",
                          event.target.value
                        )
                      }
                      placeholder={t(
                        "itemPlaceholder"
                      )}
                    />
                  </label>

                  <label
                    style={{ flex: 1 }}
                  >
                    <span>
                      {t("price")}
                    </span>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.price}
                      onChange={(event) =>
                        updateDraftItem(
                          item.id,
                          "price",
                          event.target.value
                        )
                      }
                    />
                  </label>

                  <label
                    style={{ flex: 1.2 }}
                  >
                    <span>
                      {t("assignedTo")}
                    </span>

                    <select
                      value={
                        item.assignedPersonId
                      }
                      onChange={(event) =>
                        updateDraftItem(
                          item.id,
                          "assignedPersonId",
                          event.target.value
                        )
                      }
                    >
                      <option value="">
                        {t(
                          "noItemAssigned"
                        )}
                      </option>

                      {group.people.map(
                        (person) => (
                          <option
                            key={person.id}
                            value={person.id}
                          >
                            {person.name}
                          </option>
                        )
                      )}
                    </select>
                  </label>

                  {draftItems.length > 1 && (
                    <button
                      type="button"
                      className="iconButton"
                      onClick={() =>
                        removeDraftItem(
                          item.id
                        )
                      }
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div
              style={{
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                className="secondaryButton"
                onClick={addDraftItem}
              >
                <Plus size={18} />
                {t("addItems")}
              </button>
            </div>

            {/* =========================
                WHO PAID THE BILL
               ========================= */}

            <div
              className="draftPayers"
              style={{
                marginTop: 18,
                paddingTop: 18,
                borderTop:
                  "1px solid var(--border-color)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent:
                    "space-between",
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                <div>
                  <strong>
                    {t("paidBy")}
                  </strong>

                  <p className="muted">
                    {t("amount")}
                  </p>
                </div>

                <button
                  type="button"
                  className="secondaryButton"
                  onClick={addDraftPayer}
                >
                  <Plus size={18} />
                  {t("addPayer")}
                </button>
              </div>

              {draftPayers.length === 0 && (
                <p className="muted">
                  {t("noPayersAdded")}
                </p>
              )}

              {draftPayers.map(
                (payer) => (
                  <div
                    key={payer.id}
                    className="inlineInput"
                    style={{
                      gap: 8,
                      alignItems: "end",
                      marginBottom: 8,
                    }}
                  >
                    <label
                      style={{ flex: 1 }}
                    >
                      <span>
                        {t("paidBy")}
                      </span>

                      <select
                        value={
                          payer.personId
                        }
                        onChange={(event) =>
                          updateDraftPayer(
                            payer.id,
                            "personId",
                            event.target.value
                          )
                        }
                      >
                        {group.people.map(
                          (person) => (
                            <option
                              key={person.id}
                              value={person.id}
                            >
                              {person.name}
                            </option>
                          )
                        )}
                      </select>
                    </label>

                    <label
                      style={{ flex: 1 }}
                    >
                      <span>
                        {t("amount")}
                      </span>

                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={
                          payer.amount
                        }
                        onChange={(event) =>
                          updateDraftPayer(
                            payer.id,
                            "amount",
                            event.target.value
                          )
                        }
                        placeholder="0.00"
                      />
                    </label>

                    <button
                      type="button"
                      className="iconButton"
                      onClick={() =>
                        removeDraftPayer(
                          payer.id
                        )
                      }
                    >
                      ×
                    </button>
                  </div>
                )
              )}
            </div>

            {/* =========================
                NOTE
               ========================= */}

            <label>
              {t("note")}

              <input
                value={note}
                onChange={(event) =>
                  setNote(event.target.value)
                }
                placeholder={t(
                  "billNote"
                )}
              />
            </label>

            {/* =========================
                SAVE DRAFT
               ========================= */}

            <button
              className="primaryButton"
              type="button"
              onClick={saveDraftBill}
            >
              <Plus size={18} />
              {t("saveDraft")}
            </button>
          </div>
        )}
      </section>
    </main>
  );
};