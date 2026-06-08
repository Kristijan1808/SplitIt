import { FormEvent, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, LogIn, UserPlus } from "lucide-react";
import { api } from "../api";
import { saveAuth } from "../auth";
import { ThemeToggle } from "../components/ThemeToggle";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const redirect = params.get("redirect") || "/";

  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if(mode === "register" && password !== repeatPassword) {
      setError("Passwords do not match");
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
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
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
        <ArrowLeft size={18} /> Home
      </Link>

      <section className="card authCard">
        <p className="eyebrow">{mode === "login" ? "Welcome back" : "Create account"}</p>
        <h1>{mode === "login" ? "Log in" : "Sign in"}</h1>
        <p className="muted">Register via username or email. You can still use SplitIt anonymously.</p>

        <form className="form authForm" onSubmit={submit}>
          <label>
            Username / Email
            <input
              placeholder="yourname or you@email.com"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
              minLength={4}
            />
          </label>

          <label>
            Password
            <input
              type="password"
              placeholder="Your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={6}
            />
          </label>

          {mode === "register" && (
            <label>
              Repeat password
              <input
                type="password"
                placeholder="Repeat password"
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
            {loading ? "Please wait..." : mode === "login" ? "Login" : "Sign in"}
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
          {mode === "login" ? "Need an account? Sign in" : "Already have account? Login"}
        </button>
      </section>
    </main>
  );
}
