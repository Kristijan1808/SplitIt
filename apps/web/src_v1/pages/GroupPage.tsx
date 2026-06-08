import { FormEvent, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Copy, Plus, Trash2 } from "lucide-react";
import { api } from "../api";
import { useAsync } from "../hooks";
import { calculateSettlements } from "@splitit/shared";
import { ThemeToggle } from "../components/ThemeToggle";

export const GroupPage = () => {
  const { slug = "" } = useParams();
  const { data: group, loading, error, reload, setData } = useAsync(() => api.getGroup(slug), [slug]);
  const [personName, setPersonName] = useState("");
  const [paymentPersonId, setPaymentPersonId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const result = useMemo(() => {
    if (!group) return null;
    return calculateSettlements(
      group.people.map((person) => ({
        id: person.id,
        name: person.name,
        paid: person.payments.reduce((sum, payment) => sum + payment.amount, 0)
      }))
    );
  }, [group]);

  const addPerson = async (event: FormEvent) => {
    event.preventDefault();
    if (!personName.trim()) return;
    setData(await api.addPerson(slug, { name: personName }));
    setPersonName("");
  }

  const addPayment = async (event: FormEvent) => {
    event.preventDefault();
    const selectedPerson = paymentPersonId || group?.people[0]?.id;
    if (!selectedPerson) return;

    setData(
      await api.addPayment(slug, {
        personId: selectedPerson,
        amount: Number(amount),
        note
      })
    );

    setAmount("");
    setNote("");
    setPaymentPersonId("");
  }

  const editPayment = async (paymentId: string, currentAmount: number, currentNote?: string | null) => {
    const newAmount = Number(prompt("New amount", String(currentAmount)));
    if (!newAmount || newAmount <= 0) return;

    const newNote = prompt("Note", currentNote ?? "") ?? "";
    setData(await api.updatePayment(slug, paymentId, { amount: newAmount, note: newNote }));
  }

  if (loading) return <main className="page"><section className="card">Loading...</section></main>;
  if (error || !group) return <main className="page"><section className="card error">{error || "Group not found"}</section></main>;

  return (
    <main className="page wide">
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
          <p className="muted">Anyone with this link can view and edit.</p>
        </div>
        <button className="secondaryButton copy" onClick={() => navigator.clipboard.writeText(window.location.href)}>
          <Copy size={18} /> Copy link
        </button>
      </section>

      <div className="grid">
        <section className="card">
          <h2>Add payment</h2>
          <form className="form" onSubmit={addPayment}>
            <label>
              Who paid?
              <select value={paymentPersonId} onChange={(e) => setPaymentPersonId(e.target.value)}>
                {group.people.map((person) => (
                  <option key={person.id} value={person.id}>{person.name}</option>
                ))}
              </select>
            </label>
            <label>
              Amount
              <input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </label>
            <label>
              Note
              <input placeholder="Dinner, tickets..." value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
            <button className="primaryButton"><Plus size={18} /> Add payment</button>
          </form>
        </section>

        <section className="card resultCard">
          <h2>Split result</h2>
          {result && (
            <>
              <div className="stats">
                <div><small>Total</small><strong>{result.total.toFixed(2)}</strong></div>
                <div><small>Each share</small><strong>{result.share.toFixed(2)}</strong></div>
              </div>

              {result.settlements.length === 0 ? (
                <p className="success">Everything is balanced.</p>
              ) : (
                <div className="list">
                  {result.settlements.map((settlement, index) => (
                    <div className="settlement" key={index}>
                      <span>{settlement.from}</span>
                      <strong>→ {settlement.to}</strong>
                      <em>{settlement.amount.toFixed(2)}</em>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      </div>

      <div className="grid">
        <section className="card">
          <h2>People</h2>
          <form onSubmit={addPerson} className="inlineInput" style={{ marginBottom: 16 }}>
            <input id="addperson" placeholder="Add person" value={personName} onChange={(e) => setPersonName(e.target.value)} />
            <button className="iconButton"><Plus size={18} /></button>
          </form>

          <div className="list">
            {group.people.map((person) => {
              const paid = person.payments.reduce((sum, payment) => sum + payment.amount, 0);
              const balance = result?.balances.find((b) => b.personId === person.id)?.balance ?? 0;

              return (
                <div className="personRow" key={person.id}>
                  <div className="contentRow">
                    <strong>{person.name}</strong>
                    <span className="margin-left-4"><small>Paid {paid.toFixed(2)} · Balance {balance.toFixed(2)}</small></span>
                  </div>
                  <button className="iconButton danger" onClick={() => api.deletePerson(slug, person.id).then(setData)}>
                    <Trash2 size={18} />
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        <section className="card">
          <h2>Payments</h2>
          <div className="list">
            {group.payments.length === 0 ? <p className="muted">No payments yet.</p> : group.payments.map((payment) => {
              const person = group.people.find((p) => p.id === payment.personId);
              return (
                <div className="paymentRow" key={payment.id} onClick={() => editPayment(payment.id, payment.amount, payment.note)}>
                  <div className="contentRow">
                    <strong>{person?.name ?? "Unknown"} paid {payment.amount.toFixed(2)}</strong>
                    <span className="margin-left-4"><small>{payment.note || "No note"} · click to edit</small></span>
                  </div>
                  <button
                    className="iconButton danger"
                    onClick={(event) => {
                      event.stopPropagation();
                      api.deletePayment(slug, payment.id).then(setData);
                    }}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <section className="card">
        <h2>History</h2>
        <button className="secondaryButton compact refresh" onClick={reload}>Refresh</button>
        <div className="timeline">
          {group.history.map((item) => (
            <div className="historyItem" key={item.id}>
              <strong>{item.message}</strong>
              <small>{new Date(item.createdAt).toLocaleString()}</small>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
