import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { api } from "../api";
import { ThemeToggle } from "../components/ThemeToggle";

export function CreateGroupPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("Weekend trip");
  const [people, setPeople] = useState([""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function updatePerson(index: number, value: string) {
    setPeople((current) => current.map((person, i) => (i === index ? value : person)));
  }

  function removePerson(index: number) {
    setPeople((current) => current.filter((_, i) => i !== index));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const group = await api.createGroup({
        name,
        people: people.map((p) => p.trim()).filter(Boolean)
      });

      const recent = JSON.parse(localStorage.getItem("splitit:groups") ?? "[]");
      localStorage.setItem(
        "splitit:groups",
        JSON.stringify([{ slug: group.slug, name: group.name }, ...recent].slice(0, 20))
      );

      navigate(`/g/${group.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create group");
    } finally {
      setLoading(false);
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
        <p className="muted">Add names now. You can add payments and more people later.</p>

        <form onSubmit={submit} className="form">
          <label>
            Group name
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>

          <div>
            <label>People</label>
            <div className="peopleInputs">
              {people.map((person, index) => (
                <div className="inlineInput" key={index}>
                  <input
                    placeholder={`Person ${index + 1}`}
                    value={person}
                    onChange={(e) => updatePerson(index, e.target.value)}
                    required={index === 0}
                  />
                  {people.length > 1 && (
                    <button type="button" className="iconButton" onClick={() => removePerson(index)}>
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" className="secondaryButton" onClick={() => setPeople([...people, ""])}>
              <Plus size={18} /> Add person
            </button>
          </div>

          {error && <p className="error">{error}</p>}

          <button className="primaryButton" disabled={loading}>
            {loading ? "Creating..." : "Create group"}
          </button>
        </form>
      </section>
    </main>
  );
}
