import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Copy, Plus } from "lucide-react";
import { ThemeToggle } from "../components/ThemeToggle";
import { api } from "../api";

export function CreateGroupPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("Weekend trip");
  const [password, setPassword] = useState("");
  const [people, setPeople] = useState([""]);
  const [error, setError] = useState("");
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);

  function updatePerson(index: number, value: string) {
    setPeople((current) => current.map((person, i) => (i === index ? value : person)));
  }

  function removePerson(index: number) {
    setPeople((current) => current.filter((_, i) => i !== index));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");

    try {
      const group = await api.createGroup({
        name,
        password,
        people,
        accessType: "ANONYMOUS_ONLY"
      });
      setCreatedCode(group.code);
      setCreatedSlug(group.slug);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create group");
    }
  }

  return (
    <main className="page">
      <div className="topBar">
        <ThemeToggle />
      </div>
      <Link className="backLink" to="/">
        <ArrowLeft size={18} /> Back
      </Link>

      <section className="card">
        <h1>Create group</h1>
        <p className="muted">Group names may repeat. Every group gets its own 6-character code.</p>

        {!createdCode ? (
          <form onSubmit={submit} className="form">
            <label>
              Group name
              <input value={name} onChange={(event) => setName(event.target.value)} required />
            </label>

            <label>
              Password
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            </label>

            <div>
              <label>Participants</label>
              <div className="peopleInputs">
                {people.map((person, index) => (
                  <div className="inlineInput" key={index}>
                    <input
                      placeholder={`Participant ${index + 1}`}
                      value={person}
                      onChange={(event) => updatePerson(index, event.target.value)}
                    />
                    {people.length > 1 && (
                      <button type="button" className="iconButton" onClick={() => removePerson(index)}>
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button type="button" className="secondaryButton" onClick={() => setPeople([...people, ""])}>
                <Plus size={18} /> Add participant
              </button>
            </div>

            {error && <p className="error">{error}</p>}

            <button className="primaryButton" type="submit">
              Create group
            </button>
          </form>
        ) : (
          <div className="form">
            <div className="createdCodeBox">
              <small>Group code</small>
              <strong>{createdCode}</strong>
            </div>

            <div className="actionsRow">
              <button
                type="button"
                className="primaryButton"
                onClick={() => navigator.clipboard.writeText(`${window.location.origin}/join?code=${createdCode}`)}
              >
                <Copy size={18} /> Copy group link
              </button>
              <button type="button" className="secondaryButton" onClick={() => navigate(`/g/${createdSlug}`)}>
                Open group
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
