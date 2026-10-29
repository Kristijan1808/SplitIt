import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Copy, Plus } from "lucide-react";
import { ThemeToggle } from "../components/ThemeToggle";
import { useLanguage } from "../i18n";
import { api } from "../api";
import type { AccessType } from "../types";
import { showToast } from "../notifications";
import { getAuthUser, isLoggedIn } from "../auth";

export function CreateGroupPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [people, setPeople] = useState([""]);
  const [accessType, setAccessType] = useState<AccessType>("ANONYMOUS_ONLY");
  const [error, setError] = useState("");
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const updatePerson = (index: number, value: string) => {
    setPeople((current) => current.map((person, i) => (i === index ? value : person)));
    setFieldErrors((current) => ({ ...current, [`person-${index}`]: "" }));
  }

  const removePerson = (index: number) => {
    setPeople((current) => current.filter((_, i) => i !== index));
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (accessType === "REGISTERED_ONLY" && !isLoggedIn()) {
      setError(t("registeredGroupLoginRequired"));
      showToast(t("registeredGroupLoginRequired"));
      return;
    }
    const errors: Record<string, string> = {};
    if (!name.trim()) {
      errors.name = t("fieldRequired");
    } else if (name.trim().length < 3) {
      errors.name = t("fieldMinLength").replace("{count}", "3");
    } else if (name.trim().length > 80) {
      errors.name = t("fieldMaxLength").replace("{count}", "80");
    }
    if (!password.trim()) {
      errors.password = t("fieldRequired");
    } else if (password.trim().length < 4) {
      errors.password = t("fieldMinLength").replace("{count}", "4");
    } else if (password.trim().length > 80) {
      errors.password = t("fieldMaxLength").replace("{count}", "80");
    }
    if (accessType !== "REGISTERED_ONLY") {
      people.forEach((person, index) => {
        if (!person.trim()) errors[`person-${index}`] = t("fieldRequired");
        else if (person.trim().length > 60) {
          errors[`person-${index}`] = t("fieldMaxLength").replace("{count}", "60");
        }
      });
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      showToast(t("formCorrectionToast"));
      return;
    }

    try {
      const group = await api.createGroup({
        name,
        password,
        people: accessType === "REGISTERED_ONLY" ? [] : people,
        accessType
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
          <form onSubmit={submit} className="form" noValidate>
           <label>
            {t("groupName")}
            <input
              value={name}
              maxLength={80}
              aria-invalid={Boolean(fieldErrors.name)}
              onChange={(event) => {
                setName(event.target.value);
                setFieldErrors((current) => ({ ...current, name: "" }));
              }}
            />
            {fieldErrors.name && <span className="validationMessage">{fieldErrors.name}</span>}
          </label>

          <label>
            {t("password")}
            <input
              type="password"
              value={password}
              maxLength={80}
              aria-invalid={Boolean(fieldErrors.password)}
              onChange={(event) => {
                setPassword(event.target.value);
                setFieldErrors((current) => ({ ...current, password: "" }));
              }}
            />
            {fieldErrors.password && <span className="validationMessage">{fieldErrors.password}</span>}
          </label>

            <fieldset className="accessOptions">
              <legend>{t("groupAccess")}</legend>
              {([
                ["ANONYMOUS_ONLY", "anonymousAccess", "anonymousAccessHint"],
                ["REGISTERED_ONLY", "registeredAccess", "registeredAccessHint"],
                ["MIXED", "mixedAccess", "mixedAccessHint"]
              ] as const).map(([value, label, hint]) => (
                <label
                  className={`accessOption${accessType === value ? " selected" : ""}`}
                  key={value}
                >
                  <input
                    type="radio"
                    name="accessType"
                    value={value}
                    checked={accessType === value}
                    onChange={() => setAccessType(value)}
                  />
                  <strong>{t(label)}</strong>
                  <small>{t(hint)}</small>
                </label>
              ))}
            </fieldset>

            {accessType === "REGISTERED_ONLY" ? (
              <p className="muted">
                {t("registeredGroupOwnerHint").replace(
                  "{username}",
                  getAuthUser()?.username ?? "",
                )}
              </p>
            ) : (
            <div>
              <label>{t("participants")}</label>
              <div className="peopleInputs">
                {people.map((person, index) => (
                  <div className="inlineInput" key={index}>
                    <input
                      placeholder={`${t("participant")} ${index + 1}`}
                      value={person}
                      maxLength={60}
                      aria-invalid={Boolean(fieldErrors[`person-${index}`])}
                      onChange={(event) => updatePerson(index, event.target.value)}
                    />
                    {fieldErrors[`person-${index}`] && <span className="validationMessage">{fieldErrors[`person-${index}`]}</span>}
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
            )}

            {error && <p className="error">{error}</p>}
            {accessType === "REGISTERED_ONLY" && !isLoggedIn() && (
              <Link className="secondaryButton" to="/login?redirect=%2Fnew">
                {t("login")}
              </Link>
            )}
            <button className="primaryButton" type="submit">
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
