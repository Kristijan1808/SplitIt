import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus } from "lucide-react";
import { ThemeToggle } from "../components/ThemeToggle";
import { createGroup } from "../storage";

export function CreateGroupPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("Weekend trip");
  const [password, setPassword] = useState("");
  const [people, setPeople] = useState([""]);
  const [error, setError] = useState("");

  function updatePerson(index: number, value: string) {
    setPeople((current) => current.map((person, i) => (i === index ? value : person)));
  }

  function removePerson(index: number) {
    setPeople((current) => current.filter((_, i) => i !== index));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setError("");

    try {
      const group = createGroup({
        name,
        password,
        participants: people
      });
      navigate(`/g/${group.slug}`);
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
        <p className="muted">Choose a unique name, set a password, and add participants.</p>

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
      </section>
    </main>
  );
}
