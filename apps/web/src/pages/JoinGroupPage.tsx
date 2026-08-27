import "../styles/joinGroupPage.css";
import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, UserRoundPlus } from "lucide-react";
import { api } from "../api";
import { useLanguage } from "../i18n";

export function JoinGroupPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const groupCode = params.get("code");
    if (groupCode) setCode(groupCode.toUpperCase());
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");

    try {
      const group = await api.joinGroup({ code: code.trim(), password });
      navigate(`/g/${group.slug}?chooseParticipant=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("somethingWentWrong"));
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
        <h1>{t("joinTitle")}</h1>
        <p className="muted">{t("joinHint")}</p>

        <form className="form" onSubmit={handleSubmit}>
          <label>
            {t("groupCodeInput")}
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder="AB12CD"
              maxLength={6}
              required
            />
          </label>

          <label>
            {t("password")}
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>

          {error && <p className="error">{error}</p>}

          <button className="primaryButton" type="submit">
            <UserRoundPlus size={18} /> {t("joinButton")}
          </button>
        </form>
      </section>
    </main>
  );
}
