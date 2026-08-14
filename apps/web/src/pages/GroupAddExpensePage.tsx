import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import type { Group } from "@splitit/shared";

export const GroupAddExpensePage = () => {
  const navigate = useNavigate();
  const { slug = "" } = useParams();
  const [group, setGroup] = useState<Group | null>(null);
  const [paymentPersonId, setPaymentPersonId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [multiplePayers, setMultiplePayers] = useState(false);
  const [payerAmounts, setPayerAmounts] = useState<Record<string, string>>({});
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
        navigate(`/g/${slug}`);
      }
    };

    void load();
  }, [slug, navigate]);

  const executeAction = async (callback: () => Promise<Group>) => {
    try {
      setSaving(true);
      setActionError("");
      const nextGroup = await callback();
      setGroup(nextGroup);
      setAmount("");
      setNote("");
      setSelectedParticipants(nextGroup.people.map((person) => person.id));
      setPaymentPersonId(nextGroup.people[0]?.id ?? "");
      setPayerAmounts({});
      setMultiplePayers(false);
      navigate(`/g/${slug}`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Something went wrong.");
      window.setTimeout(() => setActionError(""), 3500);
    } finally {
      setSaving(false);
    }
  };

  const addPayment = async (event: FormEvent) => {
    event.preventDefault();

    if (!group || group.locked) return;

    const total = multiplePayers
      ? Object.values(payerAmounts).reduce((sum, value) => sum + Number(value || 0), 0)
      : Number(amount || 0);

    if (!total || total <= 0) {
      setActionError("Amount must be greater than zero.");
      return;
    }

    await executeAction(async () => {
      const payload = multiplePayers
        ? {
            note,
            payerAmounts: group.people
              .filter((person) => Object.prototype.hasOwnProperty.call(payerAmounts, person.id))
              .map((person) => ({
                personId: person.id,
                amount: Number(payerAmounts[person.id] || 0)
              }))
              .filter((entry) => entry.amount > 0),
            participantIds: selectedParticipants
          }
        : {
            amount: total,
            note,
            personId: paymentPersonId,
            participantIds: selectedParticipants
          };

      return api.addPayment(slug, payload as any);
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

      <Link className="backLink" to={`/g/${slug}`}>
        <ArrowLeft size={18} /> Back to group
      </Link>

      <section className="card formCard">
        <h2>Add expense</h2>
        <form className="form" onSubmit={addPayment}>
          <label className="toggleRow">
            <input
              type="checkbox"
              checked={multiplePayers}
              onChange={() => setMultiplePayers((current) => !current)}
              disabled={group.locked}
            />
            Multiple payers
          </label>

          {!multiplePayers ? (
            <>
              <label>
                Paid by
                <select value={paymentPersonId} onChange={(event) => setPaymentPersonId(event.target.value)} disabled={group.locked}>
                  {group.people.map((person) => (
                    <option key={person.id} value={person.id}>{person.name}</option>
                  ))}
                </select>
              </label>

              <label>
                Amount
                <input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required disabled={group.locked} />
              </label>
            </>
          ) : (
            <div className="peopleInputs payerInputs">
              {group.people.map((person) => (
                <label key={person.id} className="payerInput">
                  <span>{person.name}</span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={payerAmounts[person.id] ?? ""}
                    onChange={(event) => setPayerAmounts((current) => ({ ...current, [person.id]: event.target.value }))}
                    placeholder="0.00"
                    disabled={group.locked}
                  />
                </label>
              ))}
            </div>
          )}

          <label>
            Note
            <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Dinner, groceries..." disabled={group.locked} />
          </label>

          <div>
            <label>Split equally</label>
            <div className="peopleInputs checkboxList">
              {group.people.map((person) => (
                <label key={person.id} className="accessOption">
                  <input
                    type="checkbox"
                    checked={selectedParticipants.includes(person.id)}
                    onChange={() => toggleParticipant(person.id)}
                    disabled={group.locked}
                  />
                  <strong>{person.name}</strong>
                </label>
              ))}
            </div>
            <p className="muted">Choose who participated. Equal split is applied across the selected participants.</p>
            <p className="muted">Selected: {selectedParticipantNames || "No one"}</p>
          </div>

          <button className="primaryButton" type="submit" disabled={group.locked}>
            <Plus size={18} /> Save expense
          </button>
        </form>
      </section>
    </main>
  );
};
