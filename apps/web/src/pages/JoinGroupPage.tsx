import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, UserRoundPlus } from "lucide-react";
import { api } from "../api";
import { useLanguage } from "../i18n";
import { showToast } from "../notifications";

export function JoinGroupPage() {
  const navigate = useNavigate();
  const { t, locale } = useLanguage();
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [requiresLogin, setRequiresLogin] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const groupCode = params.get("code");
    if (groupCode) setCode(groupCode.toUpperCase());
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const errors: Record<string, string> = {};
    if (!/^[A-Z0-9]{6}$/.test(code.trim())) {
      errors.code = t("invalidGroupCode");
    }
    if (!password) {
      errors.password = t("fieldRequired");
    } else if (password.length > 80) {
      errors.password = t("fieldMaxLength").replace("{count}", "80");
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      showToast(t("formCorrectionToast"));
      return;
    }

    try {
      const group = await api.joinGroup({ code: code.trim(), password });
      navigate(`/g/${group.slug}?chooseParticipant=1`);
    } catch (err) {
      if (err instanceof Error && "status" in err && err.status === 401) {
        setRequiresLogin(true);
        setError(t("registeredJoinRequiresLogin"));
        showToast(t("registeredJoinRequiresLogin"));
      } else {
        setRequiresLogin(false);
        setError(err instanceof Error ? err.message : t("somethingWentWrong"));
      }
    }
  }

  return (
    <main className="page">
      <div className="topBar">
        <Link className="backLink" to="/">
          <ArrowLeft size={18} /> {t("home")}
        </Link>
      </div>

      <section className="card">
        {/^[A-Z0-9]{6}$/.test(code) && (
          <a
            className="secondaryButton"
            href={`splitit://join?code=${encodeURIComponent(code)}`}
          >
            {locale.startsWith("hr")
              ? "Otvori u mobilnoj aplikaciji"
              : "Open in the mobile app"}
          </a>
        )}
        <h1>{t("joinTitle")}</h1>
        <p className="muted">{t("joinHint")}</p>

        <form className="form" onSubmit={handleSubmit} noValidate>
          <label>
            {t("groupCodeInput")}
            <input
              value={code}
              onChange={(event) => {
                setCode(event.target.value.toUpperCase());
                setFieldErrors((current) => ({ ...current, code: "" }));
              }}
              placeholder="AB12CD"
              maxLength={6}
              aria-invalid={Boolean(fieldErrors.code)}
            />
            {fieldErrors.code && <span className="validationMessage">{fieldErrors.code}</span>}
          </label>

          <label>
            {t("password")}
            <input
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setFieldErrors((current) => ({ ...current, password: "" }));
              }}
              maxLength={80}
              aria-invalid={Boolean(fieldErrors.password)}
            />
            {fieldErrors.password && <span className="validationMessage">{fieldErrors.password}</span>}
          </label>

          {error && <p className="error">{error}</p>}
          {requiresLogin && (
            <Link
              className="secondaryButton"
              to={`/login?redirect=${encodeURIComponent(`/join?code=${code.trim()}`)}`}
            >
              {t("login")}
            </Link>
          )}

          <button className="primaryButton" type="submit">
            <UserRoundPlus size={18} /> {t("joinButton")}
          </button>
        </form>
      </section>
    </main>
  );
}
