import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Copy, Plus } from "lucide-react";
import { ThemeToggle } from "../components/ThemeToggle";
import { useLanguage } from "../i18n";
import { api } from "../api";

import "../styles/CreateGroupPage.css";
export function CreateGroupPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [people, setPeople] = useState([""]);
  const [error, setError] = useState("");
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);

  const isFormValid = name.trim().length >= 3 && password.length >= 4 && people?.length > 0;

  const updatePerson = (index: number, value: string) => {
    setPeople((current) => current.map((person, i) => (i === index ? value : person)));
  }

  const removePerson = (index: number) => {
    setPeople((current) => current.filter((_, i) => i !== index));
  }

  const submit = async (event: FormEvent) => {
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
      setError(err instanceof Error ? err.message : t("somethingWentWrong"));
    }
  }

  return (
    <main className="page">
      <div className="topBar">
        <ThemeToggle />
      </div>
      <Link className="backLink" to="/">
        <ArrowLeft size={18} /> {t("back")}
      </Link>

      <section className="card">
        <h1>{t("createGroupTitle")}</h1>
        <p className="muted">{t("groupNamesRepeat")}</p>

        {!createdCode ? (
          <form onSubmit={submit} className="form">
           <label>
            {t("groupName")}
            <input
              value={name}
              minLength={3}
              required
              onChange={(event) => setName(event.target.value)}
            />
            <span className="validationMessage">
              Group name must be at least 3 characters.
            </span>
          </label>

          <label>
            {t("password")}
            <input
              type="password"
              value={password}
              minLength={4}
              required
              onChange={(event) => setPassword(event.target.value)}
            />
            <span className="validationMessage">
              Password must be at least 4 characters.
            </span>
          </label>

            <div>
              <label>{t("participants")}</label>
              <div className="peopleInputs">
                {people.map((person, index) => (
                  <div className="inlineInput" key={index}>
                    <input
                      placeholder={`${t("participant")} ${index + 1}`}
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
              <button type="button" className="secondaryButton add-participants-btn" onClick={() => setPeople([...people, ""])}>
                <Plus size={18} /> {t("addParticipant")}
              </button>
            </div>

            {error && <p className="error">{error}</p>}
            <button className="primaryButton" type="submit" disabled={!isFormValid}>
              {t("createGroup")}
            </button>
          </form>
        ) : (
          <div className="form">
            <div className="createdCodeBox">
              <small>{t("groupCode")}</small>
              <strong>{createdCode}</strong>
            </div>

            <div className="actionsRow">
              <button
                type="button"
                className="primaryButton"
                onClick={() => navigator.clipboard.writeText(`${window.location.origin}/join?code=${createdCode}`)}
              >
                <Copy size={18} /> {t("copyGroupLink")}
              </button>
              <button type="button" className="secondaryButton" onClick={() => navigate(`/g/${createdSlug}`)}>
                {t("openGroup")}
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
