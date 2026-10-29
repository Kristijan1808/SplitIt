
import { FormEvent, useCallback, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, LogIn, UserPlus } from "lucide-react";
import { api } from "../api";
import { saveAuth } from "../auth";
import { ThemeToggle } from "../components/ThemeToggle";
import { GoogleSignInButton } from "../components/GoogleSignInButton";
import { useLanguage } from "../i18n";
import { showToast } from "../notifications";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const redirect = params.get("redirect") || "/";
  const { t } = useLanguage();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleGoogleCredential = useCallback(async (credential: string) => {
    try {
      setLoading(true);
      setError("");
      const result = await api.googleSignIn(credential);
      saveAuth(result.token, result.user);
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
          : await api.register({ username: usernameValue, password, repeatPassword });

      saveAuth(result.token, result.user);
      navigate(redirect, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("somethingWentWrong"));
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
        <ArrowLeft size={18} /> {t("home")}
      </Link>

      <section className="card authCard">
        <p className="eyebrow">{mode === "login" ? t("welcomeBack") : t("createAccount")}</p>
        <h1>{mode === "login" ? t("login") : t("signIn")}</h1>

        <form className="form authForm" onSubmit={submit} noValidate>
          <label>
            {t("usernameOrEmail")}
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

          <label>
            {t("password")}
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
            <label>
              {t("repeatPassword")}
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

          <button className="primaryButton" disabled={loading}>
            {mode === "login" ? <LogIn size={18} /> : <UserPlus size={18} />}
            {loading ? t("pleaseWait") : mode === "login" ? t("login") : t("signIn")}
          </button>
        </form>

        <div className="authDivider">{t("or")}</div>
        <GoogleSignInButton mode={mode} onCredential={handleGoogleCredential} />

        <button
          className="secondaryButton authSwitch"
          type="button"
          onClick={() => {
            setError("");
            setFieldErrors({});
            setMode(mode === "login" ? "register" : "login");
          }}
        >
          {mode === "login" ? t("needAccount") : t("alreadyHaveAccount")}
        </button>
      </section>
    </main>
  );
}
