import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { ThemeToggle } from "../components/ThemeToggle";
import { api } from "../api";
import { calculateSettlements } from "@splitit/shared";
import type { Group } from "@splitit/shared";

export const GroupPage = () => {
  const navigate = useNavigate();
  const { slug = "" } = useParams();
  const [group, setGroup] = useState<Group | null>(null);
  const [personName, setPersonName] = useState("");
  const [paymentPersonId, setPaymentPersonId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [actionError, setActionError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const currentGroup = await api.getGroup(slug);
        setGroup(currentGroup);
        setPaymentPersonId(currentGroup.people[0]?.id ?? "");
        setSelectedParticipants(currentGroup.people.map((person) => person.id));
      } catch {
        navigate("/");
      }
    };

    void load();
  }, [slug, navigate]);

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
    setPaymentPersonId(nextGroup.people[0]?.id ?? "");
    setSelectedParticipants(nextGroup.people.map((person) => person.id));
  };

  const executeAction = async (callback: () => Promise<Group>) => {
    try {
      setSaving(true);
      setActionError("");
      const nextGroup = await callback();
      setGroupState(nextGroup);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Something went wrong.");
      window.setTimeout(() => setActionError(""), 3500);
    } finally {
      setSaving(false);
    }
  };

  const addPerson = async (event: FormEvent) => {
    event.preventDefault();
    if (!personName.trim() || !group) return;

    await executeAction(async () => {
      const nextGroup = await api.addPerson(slug, { name: personName });
      setPersonName("");
      return nextGroup;
    });
  };

  const addPayment = async (event: FormEvent) => {
    event.preventDefault();

    if (!group) return;
    const paymentAmount = Number(amount);

    if (!paymentAmount || paymentAmount <= 0) {
      setActionError("Amount must be greater than zero.");
      return;
    }

    await executeAction(async () => {
      const nextGroup = await api.addPayment(slug, {
        amount: paymentAmount,
        note,
        personId: paymentPersonId,
        participantIds: selectedParticipants
      });
      setAmount("");
      setNote("");
      setSelectedParticipants(nextGroup.people.map((person) => person.id));
      setPaymentPersonId(nextGroup.people[0]?.id ?? "");
      return nextGroup;
    });
  };

  const toggleParticipant = (participantId: string) => {
    setSelectedParticipants((current) =>
      current.includes(participantId)
        ? current.filter((id) => id !== participantId)
        : [...current, participantId]
    );
  };

  const selectedParticipantNames = (group?.people ?? [])
    .filter((person) => selectedParticipants.includes(person.id))
    .map((person) => person.name)
    .join(", ");

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
        <ArrowLeft size={18} /> Home
      </Link>

      <section className="groupHeader">
        <div>
          <p className="eyebrow">Shared group</p>
          <h1>{group.name}</h1>
          <p className="muted">Stored in the database and shared with anyone who joins it.</p>
        </div>
      </section>

      <div className="grid">
        <section className="card">
          <h2>Add expense</h2>
          <form className="form" onSubmit={addPayment}>
            <label>
              Paid by
              <select value={paymentPersonId} onChange={(event) => setPaymentPersonId(event.target.value)}>
                {group.people.map((person) => (
                  <option key={person.id} value={person.id}>{person.name}</option>
                ))}
              </select>
            </label>

            <label>
              Amount
              <input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required />
            </label>

            <label>
              Note
              <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Dinner, groceries..." />
            </label>

            <div>
              <label>Split with</label>
              <div className="peopleInputs">
                {group.people.map((person) => (
                  <label key={person.id} className="accessOption">
                    <input
                      type="checkbox"
                      checked={selectedParticipants.includes(person.id)}
                      onChange={() => toggleParticipant(person.id)}
                    />
                    <strong>{person.name}</strong>
                  </label>
                ))}
              </div>
              <p className="muted">Default selection is everyone. You can deselect participants before saving.</p>
              <p className="muted">Split: {selectedParticipantNames || "No one"}</p>
            </div>

            <button className="primaryButton" type="submit">
              <Plus size={18} /> Add expense
            </button>
          </form>
        </section>

        <section className="card resultCard">
          <h2>Balances</h2>
          <div className="stats">
            <div>
              <small>Total spent</small>
              <strong>{balances.reduce((sum, balance) => sum + balance.paid, 0).toFixed(2)}</strong>
            </div>
            <div>
              <small>Each share</small>
              <strong>{(balances.reduce((sum, balance) => sum + balance.paid, 0) / Math.max(balances.length, 1)).toFixed(2)}</strong>
            </div>
          </div>
          {settlements.length === 0 ? (
            <p className="success">Everything is balanced.</p>
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

      <div className="grid">
        <section className="card">
          <h2>Participants</h2>
          <form onSubmit={addPerson} className="inlineInput" style={{ marginBottom: 16 }}>
            <input placeholder="Add participant" value={personName} onChange={(event) => setPersonName(event.target.value)} />
            <button className="iconButton" type="submit"><Plus size={18} /></button>
          </form>
          <div className="list">
            {group.people.map((person) => {
              const amountPaid = group.payments
                .filter((payment) => payment.personId === person.id)
                .reduce((sum, payment) => sum + payment.amount, 0);
              const balance = balances.find((entry) => entry.id === person.id)?.balance ?? 0;

              return (
                <div className="personRow" key={person.id}>
                  <div className="contentRow">
                    <strong>{person.name}</strong>
                    <span className="margin-left-4"><small>Spent {amountPaid.toFixed(2)} · Balance {balance.toFixed(2)}</small></span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="card">
          <h2>Expenses</h2>
          <div className="list">
            {group.payments.length === 0 ? (
              <p className="muted">No expenses yet.</p>
            ) : (
              group.payments.map((payment) => {
                const payer = group.people.find((person) => person.id === payment.personId);
                const participantIds = payment.participantIds ?? [];
                const splitNames = group.people
                  .filter((person) => participantIds.includes(person.id))
                  .map((person) => person.name)
                  .join(", ");
                const share = payment.amount / Math.max(participantIds.length || group.people.length, 1);

                return (
                  <div className="paymentRow" key={payment.id}>
                    <div className="contentRow">
                      <strong>{payer?.name ?? "Someone"} paid {payment.amount.toFixed(2)}</strong>
                      <span className="margin-left-4">
                        <small>{payment.note || "No note"} · Split {splitNames || "everyone"} · {share.toFixed(2)} each</small>
                      </span>
                    </div>
                    <button className="iconButton danger" onClick={() => executeAction(async () => api.deletePayment(slug, payment.id))}>
                      <Trash2 size={18} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </main>
  );
};
