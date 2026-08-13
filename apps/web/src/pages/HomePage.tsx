import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, UserRoundPlus, WalletCards } from "lucide-react";
import { ThemeToggle } from "../components/ThemeToggle";
import { api } from "../api";

export function HomePage() {
  const navigate = useNavigate();
  const [joinName, setJoinName] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [joinError, setJoinError] = useState("");
  const [createName, setCreateName] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createPeople, setCreatePeople] = useState([""]);
  const [createError, setCreateError] = useState("");
  const [recentGroups, setRecentGroups] = useState<Array<{ slug: string; name: string }>>([]);

  useEffect(() => {
    const saved = window.localStorage.getItem("splitit:groups");
    if (!saved) return;
    try {
      setRecentGroups(JSON.parse(saved));
    } catch {
      setRecentGroups([]);
    }
  }, []);

  function updatePerson(index: number, value: string) {
    setCreatePeople((current) => current.map((person, i) => (i === index ? value : person)));
  }

  function removePerson(index: number) {
    setCreatePeople((current) => current.filter((_, i) => i !== index));
  }

  async function handleJoin(event: FormEvent) {
    event.preventDefault();
    setJoinError("");

    try {
      const group = await api.joinGroup({ name: joinName, password: joinPassword });
      const nextGroups = [{ slug: group.slug, name: group.name }, ...recentGroups.filter((entry) => entry.slug !== group.slug)].slice(0, 20);
      window.localStorage.setItem("splitit:groups", JSON.stringify(nextGroups));
      setRecentGroups(nextGroups);
      navigate(`/g/${group.slug}`);
    } catch (error) {
      setJoinError(error instanceof Error ? error.message : "Unable to join this group.");
    }
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setCreateError("");

    try {
      const group = await api.createGroup({
        name: createName,
        password: createPassword,
        people: createPeople,
        accessType: "ANONYMOUS_ONLY"
      });
      const nextGroups = [{ slug: group.slug, name: group.name }, ...recentGroups.filter((entry) => entry.slug !== group.slug)].slice(0, 20);
      window.localStorage.setItem("splitit:groups", JSON.stringify(nextGroups));
      setRecentGroups(nextGroups);
      navigate(`/g/${group.slug}`);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Unable to create this group.");
    }
  }

  return (
    <main className="page">
      <div className="topBar">
        <ThemeToggle />
      </div>
      <section className="hero">
        <div className="brand">
          <div className="logo">
            <WalletCards size={28} />
          </div>
          <div>
            <p className="eyebrow">Money made simple</p>
            <h1>SplitIt</h1>
          </div>
        </div>

        <p className="heroText">
          Create a group with a password, add participants, track every payment, and see who owes what in a simple splitwise-style flow.
        </p>
      </section>

      <div className="grid">
        <section className="card">
          <h2>Join group</h2>
          <form className="form" onSubmit={handleJoin}>
            <label>
              Group name
              <input value={joinName} onChange={(event) => setJoinName(event.target.value)} required />
            </label>
            <label>
              Password
              <input type="password" value={joinPassword} onChange={(event) => setJoinPassword(event.target.value)} required />
            </label>
            {joinError && <p className="error">{joinError}</p>}
            <button className="primaryButton" type="submit">
              <UserRoundPlus size={18} /> Join group
            </button>
          </form>
        </section>

        <section className="card">
          <h2>Create group</h2>
          <form className="form" onSubmit={handleCreate}>
            <label>
              Group name
              <input value={createName} onChange={(event) => setCreateName(event.target.value)} required />
            </label>
            <label>
              Password
              <input type="password" value={createPassword} onChange={(event) => setCreatePassword(event.target.value)} required />
            </label>

            <div>
              <label>Participants</label>
              <div className="peopleInputs">
                {createPeople.map((person, index) => (
                  <div className="inlineInput" key={index}>
                    <input
                      placeholder={`Participant ${index + 1}`}
                      value={person}
                      onChange={(event) => updatePerson(index, event.target.value)}
                    />
                    {createPeople.length > 1 && (
                      <button type="button" className="iconButton" onClick={() => removePerson(index)}>
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button type="button" className="secondaryButton" onClick={() => setCreatePeople([...createPeople, ""])}>
                <Plus size={18} /> Add participant
              </button>
            </div>

            {createError && <p className="error">{createError}</p>}
            <button className="primaryButton" type="submit">
              <Plus size={18} /> Create group
            </button>
          </form>
        </section>
      </div>

      <section className="card">
        <h2>Your groups</h2>
        {recentGroups.length === 0 ? (
          <p className="muted">Groups on this device will appear here.</p>
        ) : (
          <div className="list">
            {recentGroups.map((group) => (
              <Link className="groupRow" key={group.slug} to={`/g/${group.slug}`}>
                <span>{group.name}</span>
                <small>Open</small>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
