import { FormEvent, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, LogIn, UserPlus } from "lucide-react";
import { api } from "../api";
import { saveAuth } from "../auth";
import { ThemeToggle } from "../components/ThemeToggle";
import { useLanguage } from "../i18n";

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

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (mode === "register" && password !== repeatPassword) {
      setError(t("invalidPasswordMatch"));
      return;
    }

    try {
      setLoading(true);
      setError("");

      const result =
        mode === "login"
          ? await api.login({ username, password })
          : await api.register({ username, password, repeatPassword });

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
        <p className="muted">{t("home")}</p>

        <form className="form authForm" onSubmit={submit}>
          <label>
            {t("usernameOrEmail")}
            <input
              placeholder={t("usernamePlaceholder")}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
              minLength={4}
            />
          </label>

          <label>
            {t("password")}
            <input
              type="password"
              placeholder={t("enterPassword")}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={6}
            />
          </label>

          {mode === "register" && (
            <label>
              {t("repeatPassword")}
              <input
                type="password"
                placeholder={t("repeatPassword")}
                value={repeatPassword}
                onChange={(event) => setRepeatPassword(event.target.value)}
                required
                minLength={6}
              />
            </label>
          )}

          {error && <p className="error">{error}</p>}

          <button className="primaryButton" disabled={loading}>
            {mode === "login" ? <LogIn size={18} /> : <UserPlus size={18} />}
            {loading ? t("pleaseWait") : mode === "login" ? t("login") : t("signIn")}
          </button>
        </form>

        <button
          className="secondaryButton authSwitch"
          type="button"
          onClick={() => {
            setError("");
            setMode(mode === "login" ? "register" : "login");
          }}
        >
          {mode === "login" ? t("needAccount") : t("alreadyHaveAccount")}
        </button>
      </section>
    </main>
  );
}
