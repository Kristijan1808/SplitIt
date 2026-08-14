import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Copy, Lock, Plus, Users } from "lucide-react";
import { ThemeToggle } from "../components/ThemeToggle";
import { api } from "../api";
import { calculateSettlements } from "@splitit/shared";
import type { Group } from "@splitit/shared";

export const GroupPage = () => {
  const navigate = useNavigate();
  const { slug = "" } = useParams();
  const [group, setGroup] = useState<Group | null>(null);
  const [personName, setPersonName] = useState("");
  const [showParticipants, setShowParticipants] = useState(false);
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
      setActionError(error instanceof Error ? error.message : "Unable to update the lock.");
    } finally {
      setSaving(false);
    }
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
        <ArrowLeft size={18} /> Home
      </Link>

      <section className="groupHeader">
        <div>
          <p className="eyebrow">Code: {group.code}</p>
          <h1>{group.name}</h1>
          <div className="groupMetaRow">
            <p className="muted">{group.locked ? "Group is locked. No changes can be made." : "Shared with anyone who knows the code and password."}</p>
            <button type="button" className="participantsToggle" onClick={() => setShowParticipants((current) => !current)}>
              <Users size={16} />
              <span>Participants</span>
            </button>
          </div>
        </div>
        <div className="headerActions">
          <button
            className="secondaryButton"
            onClick={() => navigator.clipboard.writeText(`${window.location.origin}/join?code=${group.code}`)}
          >
            <Copy size={18} /> Copy link
          </button>
          <button className="secondaryButton" onClick={toggleLock}>
            <Lock size={18} /> {group.locked ? "Unlock group" : "Lock group"}
          </button>
        </div>
      </section>

      {showParticipants && (
        <div className="participantsOverlay" onClick={() => setShowParticipants(false)}>
          <section className="card participantsCard" onClick={(event) => event.stopPropagation()}>
            <div className="participantsHeader">
              <h3>Participants</h3>
              <button type="button" className="iconButton" onClick={() => setShowParticipants(false)} aria-label="Close participants">×</button>
            </div>
            <div className="list">
              {group.people.map((person) => (
                <div className="personRow" key={person.id}>
                  <strong>{person.name}</strong>
                  <small>{person.payments.length} expense{person.payments.length === 1 ? "" : "s"}</small>
                </div>
              ))}
            </div>
            <form onSubmit={addPerson} className="inlineInput" style={{ marginTop: 16 }}>
              <input placeholder="Add participant" value={personName} onChange={(event) => setPersonName(event.target.value)} disabled={group.locked} />
              <button className="iconButton" type="submit" disabled={group.locked}><Plus size={18} /></button>
            </form>
          </section>
        </div>
      )}

      <div className="grid">
        <section className="card">
          <div className="sectionHeaderWithButton">
            <h2>Summary</h2>
            <Link className="primaryButton compactButton" to={`/g/${slug}/add-expense`}>
              <Plus size={18} /> Add expense
            </Link>
          </div>
          <div className="summaryHint">
            <p className="muted">Track payments, balances, and who owes what.</p>
          </div>
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
            <input placeholder="Add participant" value={personName} onChange={(event) => setPersonName(event.target.value)} disabled={group.locked} />
            <button className="iconButton" type="submit" disabled={group.locked}><Plus size={18} /></button>
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
