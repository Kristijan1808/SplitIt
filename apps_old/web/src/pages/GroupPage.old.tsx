import { FormEvent, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Copy, Lock, Plus, Trash2 } from "lucide-react";
import { calculateSettlements } from "@splitit/shared";
import { api } from "../api";
import { getAuthUser } from "../auth";
import { useAsync } from "../hooks";
import { ThemeToggle } from "../components/ThemeToggle";

export const GroupPage = () => {
  const { slug = "" } = useParams();
  const { data: group, loading, error, reload, setData } = useAsync(
    () => api.getGroup(slug),
    [slug]
  );

  const [personName, setPersonName] = useState("");
  const [paymentPersonId, setPaymentPersonId] = useState("");
  const [amount, setAmount] = useState("");
  const [excludedAmount, setExcludedAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");

  const currentUser = getAuthUser();
  const loginRedirect = `/login?redirect=${encodeURIComponent(`/g/${slug}`)}`;

  const getSplitAmount = (payment: { amount: number; excludedAmount?: number }) =>
    Math.max(payment.amount - (payment.excludedAmount ?? 0), 0);

  const result = useMemo(() => {
    if (!group) return null;

    return calculateSettlements(
      group.people.map((person) => ({
        id: person.id,
        name: person.name,
        paid: person.payments.reduce(
          (sum, payment) => sum + getSplitAmount(payment),
          0
        )
      }))
    );
  }, [group]);

  const executeAction = async (callback: () => Promise<void>) => {
    try {
      setSaving(true);
      setActionError("");
      await callback();
    } catch (error) {
      console.error(error);
      setActionError(
        error instanceof Error
          ? error.message
          : "Something went wrong. Try again."
      );
      window.setTimeout(() => setActionError(""), 3500);
    } finally {
      setSaving(false);
    }
  };

  const addPerson = async (event: FormEvent) => {
    event.preventDefault();
    if (!personName.trim()) return;

    await executeAction(async () => {
      setData(await api.addPerson(slug, { name: personName }));
      setPersonName("");
    });
  };

  const addPayment = async (event: FormEvent) => {
    event.preventDefault();

    const selectedPerson = paymentPersonId || group?.people[0]?.id;
    if (!selectedPerson) return;

    const paymentAmount = Number(amount);
    const paymentExcludedAmount = Number(excludedAmount || 0);

    if (paymentExcludedAmount < 0 || paymentExcludedAmount > paymentAmount) {
      setActionError("Excluded amount must be between 0 and payment amount.");
      window.setTimeout(() => setActionError(""), 3500);
      return;
    }

    await executeAction(async () => {
      setData(
        await api.addPayment(slug, {
          personId: selectedPerson,
          amount: paymentAmount,
          excludedAmount: paymentExcludedAmount,
          note
        })
      );

      setAmount("");
      setExcludedAmount("");
      setNote("");
      setPaymentPersonId("");
    });
  };

  const editPayment = async (
    paymentId: string,
    currentAmount: number,
    currentExcludedAmount = 0,
    currentNote?: string | null
  ) => {
    const newAmount = Number(prompt("New amount", String(currentAmount)));
    if (!newAmount || newAmount <= 0) return;

    const newExcludedAmount = Number(
      prompt("Excluded amount", String(currentExcludedAmount)) ?? "0"
    );

    if (newExcludedAmount < 0 || newExcludedAmount > newAmount) {
      setActionError("Excluded amount must be between 0 and payment amount.");
      window.setTimeout(() => setActionError(""), 3500);
      return;
    }

    const newNote = prompt("Note", currentNote ?? "") ?? "";

    await executeAction(async () => {
      setData(
        await api.updatePayment(slug, paymentId, {
          amount: newAmount,
          excludedAmount: newExcludedAmount,
          note: newNote
        })
      );
    });
  };

  if (loading) {
    return (
      <main className="page">
        <section className="loadingScreen">
          <div className="spinner" />
          <p className="eyebrow">Opening group</p>
          <h1>Fetching data...</h1>
        </section>
      </main>
    );
  }

  if (error || !group) {
    const needsLogin = error?.toLowerCase().includes("login");

    return (
      <main className="page">
        <div className="topBar">
          <ThemeToggle />
        </div>

        <section className="card authCard">
          <p className="eyebrow">
            {needsLogin ? "Login required" : "Group unavailable"}
          </p>

          <h1>
            {needsLogin ? "This group is protected" : "Could not open group"}
          </h1>

          <p className="muted">{error || "Group not found"}</p>

          {needsLogin ? (
            <Link className="primaryButton" to={loginRedirect}>
              <Lock size={18} /> Login to open group
            </Link>
          ) : (
            <button className="primaryButton" onClick={reload}>
              Try again
            </button>
          )}
        </section>
      </main>
    );
  }

  const accessDescription = {
    ANONYMOUS_ONLY: "Anyone with this link can view and edit. No login needed.",
    REGISTERED_ONLY:
      "Only logged-in group members can access and edit. Opening the link joins logged-in users.",
    MIXED: "Anonymous link access is enabled. Logged-in users are saved as members."
  }[group.accessType];

  return (
    <main className="page wide">
      {saving && (
        <div className="screenLoader">
          <div className="spinner large" />
          <p className="loadingTitle">Updating group...</p>
          <small className="muted">Syncing latest data</small>
        </div>
      )}

      {actionError && <div className="toastError">{actionError}</div>}

      <div className="topBar">
        <ThemeToggle />
      </div>

      <Link className="backLink" to="/">
        <ArrowLeft size={18} /> Home
      </Link>

      <section className="groupHeader">
        <div>
          <p className="eyebrow">{group.accessType.replaceAll("_", " ")}</p>
          <h1>{group.name}</h1>
          <p className="muted">{accessDescription}</p>

          {currentUser && (
            <p className="muted">
              Logged in as <strong>{currentUser.username}</strong>
              {group.currentUserRole ? ` · ${group.currentUserRole}` : ""}
            </p>
          )}
        </div>

        <button
          className="secondaryButton copy"
          onClick={() => navigator.clipboard.writeText(window.location.href)}
        >
          <Copy size={18} /> Copy link
        </button>
      </section>

      <div className="grid">
        <section className="card">
          <h2>Add payment</h2>

          <form className="form" onSubmit={addPayment}>
            <label>
              Who paid?
              <select
                value={paymentPersonId}
                onChange={(e) => setPaymentPersonId(e.target.value)}
              >
                {group.people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Amount
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </label>

            <label>
              Excluded amount
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Amount not included in split"
                value={excludedAmount}
                onChange={(e) => setExcludedAmount(e.target.value)}
              />
            </label>

            <label>
              Note
              <input
                placeholder="Dinner, tickets..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>

            <button className="primaryButton">
              <Plus size={18} /> Add payment
            </button>
          </form>
        </section>

        <section className="card resultCard">
          <h2>Split result</h2>

          {result && (
            <>
              <div className="stats">
                <div>
                  <small>Total to split</small>
                  <strong>{result.total.toFixed(2)}</strong>
                </div>

                <div>
                  <small>Each share</small>
                  <strong>{result.share.toFixed(2)}</strong>
                </div>
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

          <form
            onSubmit={addPerson}
            className="inlineInput"
            style={{ marginBottom: 16 }}
          >
            <input
              id="addperson"
              placeholder="Add person"
              value={personName}
              onChange={(e) => setPersonName(e.target.value)}
            />

            <button className="iconButton">
              <Plus size={18} />
            </button>
          </form>

          <div className="list">
            {group.people.map((person) => {
              const paid = person.payments.reduce(
                (sum, payment) => sum + getSplitAmount(payment),
                0
              );

              const rawPaid = person.payments.reduce(
                (sum, payment) => sum + payment.amount,
                0
              );

              const excluded = person.payments.reduce(
                (sum, payment) => sum + (payment.excludedAmount ?? 0),
                0
              );

              const balance =
                result?.balances.find((b) => b.personId === person.id)
                  ?.balance ?? 0;

              return (
                <div className="personRow" key={person.id}>
                  <div className="contentRow">
                    <strong>{person.name}</strong>

                    <span className="margin-left-4">
                      <small>
                        Split paid {paid.toFixed(2)} · Total paid{" "}
                        {rawPaid.toFixed(2)}
                        {excluded > 0 ? ` · Excluded ${excluded.toFixed(2)}` : ""}
                        {" · Balance "}
                        {balance.toFixed(2)}
                      </small>
                    </span>
                  </div>

                  <button
                    className="iconButton danger"
                    onClick={() =>
                      executeAction(async () =>
                        setData(await api.deletePerson(slug, person.id))
                      )
                    }
                  >
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
            {group.payments.length === 0 ? (
              <p className="muted">No payments yet.</p>
            ) : (
              group.payments.map((payment) => {
                const person = group.people.find(
                  (p) => p.id === payment.personId
                );

                const splitAmount = getSplitAmount(payment);

                return (
                  <div
                    className="paymentRow"
                    key={payment.id}
                    onClick={() =>
                      editPayment(
                        payment.id,
                        payment.amount,
                        payment.excludedAmount ?? 0,
                        payment.note
                      )
                    }
                  >
                    <div className="contentRow">
                      <strong>
                        {person?.name ?? "Unknown"} paid{" "}
                        {payment.amount.toFixed(2)}
                      </strong>

                      <span className="margin-left-4">
                        <small>
                          Split amount {splitAmount.toFixed(2)}
                          {payment.excludedAmount
                            ? ` · Excluded ${payment.excludedAmount.toFixed(2)}`
                            : ""}
                          {payment.note ? ` · ${payment.note}` : " · No note"}
                          {" · click to edit"}
                        </small>
                      </span>
                    </div>

                    <button
                      className="iconButton danger"
                      onClick={(event) => {
                        event.stopPropagation();

                        executeAction(async () =>
                          setData(await api.deletePayment(slug, payment.id))
                        );
                      }}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      {group.members && group.members.length > 0 && (
        <section className="card">
          <h2>Members</h2>

          <div className="list">
            {group.members.map((member) => (
              <div className="groupRow" key={member.id}>
                <span>{member.username ?? member.userId}</span>
                <small>{member.role}</small>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card">
        <h2>History</h2>

        <button className="secondaryButton compact refresh" onClick={reload}>
          Refresh
        </button>

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
};