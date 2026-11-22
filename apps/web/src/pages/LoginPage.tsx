
import { FormEvent, useCallback, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, LogIn, UserPlus } from "lucide-react";
import { api } from "../api";
import { saveAuth } from "../auth";
import { syncAccountGroups } from "../accountSync";
import { GoogleSignInButton } from "../components/GoogleSignInButton";
import { useLanguage } from "../i18n";
import { showToast } from "../notifications";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const redirect = params.get("redirect") || "/";
  const { t } = useLanguage();

  const [mode, setMode] = useState<"login" | "register">(params.get("mode") === "register" ? "register" : "login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleGoogleCredential = useCallback(async (credential: string) => {
    try {
      setLoading(true);
      setError("");
      const result = await api.googleSignIn(credential);
      saveAuth(result.token, result.user);
      await syncAccountGroups();
      navigate(redirect, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("somethingWentWrong"));
    } finally {
      setLoading(false);
    }
  }, [navigate, redirect, t]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const errors: Record<string, string> = {};
    const usernameValue = username.trim();
    const usernameMaxLength = mode === "login" ? 254 : 32;
    if (!usernameValue) {
      errors.username = t("fieldRequired");
    } else if (usernameValue.length < 4) {
      errors.username = t("fieldMinLength").replace("{count}", "4");
    } else if (usernameValue.length > usernameMaxLength) {
      errors.username = t("fieldMaxLength").replace("{count}", String(usernameMaxLength));
    } else if (mode === "register" && !/^[a-zA-Z0-9_.-]+$/.test(usernameValue)) {
      errors.username = t("invalidUsername");
    }

    if (mode === "register") {
      const mail = email.trim();
      if (!mail) errors.email = t("fieldRequired");
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail) || mail.length > 254) errors.email = t("invalidEmail");
    }

    if (password.length < 8) {
      errors.password = password ? t("fieldMinLength").replace("{count}", "8") : t("fieldRequired");
    } else if (password.length > 80) {
      errors.password = t("fieldMaxLength").replace("{count}", "80");
    }
    if (mode === "register") {
      if (repeatPassword.length < 8) {
        errors.repeatPassword = repeatPassword ? t("fieldMinLength").replace("{count}", "8") : t("fieldRequired");
      } else if (repeatPassword.length > 80) {
        errors.repeatPassword = t("fieldMaxLength").replace("{count}", "80");
      } else if (password !== repeatPassword) {
        errors.repeatPassword = t("invalidPasswordMatch");
      }
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError("");
      showToast(t("formCorrectionToast"));
      return;
    }

    try {
      setLoading(true);
      setError("");

      const result =
        mode === "login"
          ? await api.login({ username: usernameValue, password })
          : await api.register({ username: usernameValue, email: email.trim().toLowerCase(), password, repeatPassword });

      saveAuth(result.token, result.user);
      await syncAccountGroups();
      navigate(redirect, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("somethingWentWrong"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page zLoginPage">
      <aside className="zLoginHero" aria-hidden="true"><i>&divide;</i><h2>{t("teamSlogan")}</h2></aside>
      <div className="zLoginBody">
      <div className="zTop"><Link className="zBack" to="/" aria-label={t("home")}>&#8249;</Link><h1 className="zH2" style={{ flex: 1, textAlign: "center" }}>{t("myAccount")}</h1><span style={{ width: 44 }} /></div>

      <section className="zAuth">
        <div className="zTabs" role="tablist">
          {(["login", "register"] as const).map((m) => (
            <button key={m} type="button" role="tab" aria-selected={mode === m} className={`zTab${mode === m ? " on" : ""}`} onClick={() => { setError(""); setFieldErrors({}); setMode(m); }}>{m === "login" ? t("login") : t("signIn")}</button>
          ))}
        </div>

        <form className="zPage authForm" onSubmit={submit} noValidate>
          <label className="zField">
            <b>{mode === "register" ? t("usernameLabel") : t("usernameOrEmail")}</b>
            <input
              placeholder={t("usernamePlaceholder")}
              value={username}
              onChange={(event) => {
                setUsername(event.target.value);
                setFieldErrors((current) => ({ ...current, username: "" }));
              }}
              maxLength={mode === "login" ? 254 : 32}
              autoComplete="username"
              aria-invalid={Boolean(fieldErrors.username)}
            />
            {fieldErrors.username && <span className="validationMessage">{fieldErrors.username}</span>}
          </label>

          {mode === "register" && (
            <label className="zField">
              <b>{t("emailLabel")}</b>
              <input
                type="email"
                inputMode="email"
                placeholder={t("emailPlaceholder")}
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setFieldErrors((current) => ({ ...current, email: "" }));
                }}
                maxLength={254}
                autoComplete="email"
                aria-invalid={Boolean(fieldErrors.email)}
              />
              {fieldErrors.email && <span className="validationMessage">{fieldErrors.email}</span>}
            </label>
          )}

          <label className="zField">
            <b>{t("password")}</b>
            <input
              type="password"
              placeholder={t("enterPassword")}
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setFieldErrors((current) => ({ ...current, password: "" }));
              }}
              maxLength={80}
              aria-invalid={Boolean(fieldErrors.password)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
            {fieldErrors.password && <span className="validationMessage">{fieldErrors.password}</span>}
          </label>

          {mode === "register" && (
            <label className="zField">
              <b>{t("repeatPassword")}</b>
              <input
                type="password"
                placeholder={t("repeatPassword")}
                value={repeatPassword}
                onChange={(event) => {
                  setRepeatPassword(event.target.value);
                  setFieldErrors((current) => ({ ...current, repeatPassword: "" }));
                }}
                maxLength={80}
                aria-invalid={Boolean(fieldErrors.repeatPassword)}
                autoComplete="new-password"
              />
              {fieldErrors.repeatPassword && <span className="validationMessage">{fieldErrors.repeatPassword}</span>}
            </label>
          )}

          {error && <p className="error">{error}</p>}

          <button className="zBtn" disabled={loading}>
            {loading ? t("pleaseWait") : mode === "login" ? t("login") : t("signIn")}
          </button>
        </form>

        <div className="zMuted" style={{ textAlign: "center" }}>{t("or")}</div>
        <GoogleSignInButton mode={mode} onCredential={handleGoogleCredential} />
        <Link className="zBtn zBtnG" to="/" style={{ textAlign: "center", textDecoration: "none" }}>{t("continueGuest")}</Link>

      </section>
      </div>
    </main>
  );
}
