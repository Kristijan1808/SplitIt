import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, UserRoundPlus } from "lucide-react";
import { api } from "../api";

export function JoinGroupPage() {
  const navigate = useNavigate();
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
      navigate(`/g/${group.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to join this group.");
    }
  }

  return (
    <main className="page">
      <div className="topBar">
        <Link className="backLink" to="/">
          <ArrowLeft size={18} /> Home
        </Link>
      </div>

      <section className="card">
        <h1>Join group</h1>
        <p className="muted">Enter the 6-character group code and the shared password.</p>

        <form className="form" onSubmit={handleSubmit}>
          <label>
            Group code
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder="AB12CD"
              maxLength={6}
              required
            />
          </label>

          <label>
            Password
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>

          {error && <p className="error">{error}</p>}

          <button className="primaryButton" type="submit">
            <UserRoundPlus size={18} /> Join group
          </button>
        </form>
      </section>
    </main>
  );
}
