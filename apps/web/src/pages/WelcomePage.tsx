import { useCallback, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogIn, UserPlus, ArrowRight } from "lucide-react";
import { api } from "../api";
import { saveAuth } from "../auth";
import { syncAccountGroups } from "../accountSync";
import { GoogleSignInButton } from "../components/GoogleSignInButton";
import { useLanguage } from "../i18n";

export const GUEST_KEY = "splitit:guestChosen";
export const markGuest = () => { try { localStorage.setItem(GUEST_KEY, "1"); } catch { /* privatni način */ } };
export const guestChosen = () => { try { return localStorage.getItem(GUEST_KEY) === "1"; } catch { return false; } };

/** Prvi ekran: odaberi prijavu, registraciju, Google ili nastavak bez računa. */
export function WelcomePage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const onGoogle = useCallback(async (credential: string) => {
    try { setError(""); const r = await api.googleSignIn(credential); saveAuth(r.token, r.user); await syncAccountGroups(); navigate("/", { replace: true }); }
    catch (e) { setError(e instanceof Error ? e.message : t("somethingWentWrong")); }
  }, [navigate, t]);
  const guest = () => { markGuest(); navigate("/", { replace: true }); };
  return (
    <main className="zWelcome">
      <aside className="zWelcomeHero" aria-hidden="true"><i>÷</i><h2>{t("welcomeTitle")}</h2><p>{t("welcomeSub")}</p></aside>
      <section className="zWelcomeBody">
        <div className="zWelcomeTop"><i className="zWelcomeLogo" aria-hidden="true">÷</i><h1>{t("welcomeTitle")}</h1><p>{t("welcomeSub")}</p></div>
        <div className="zWelcomeActions">
          <h2 className="zLbl">{t("welcomeHow")}</h2>
          <Link className="zBtn" to="/login"><LogIn size={20} aria-hidden="true" />{t("login")}</Link>
          <Link className="zBtnG" to="/login?mode=register"><UserPlus size={20} aria-hidden="true" />{t("welcomeCreateAccount")}</Link>
          <GoogleSignInButton mode="login" onCredential={onGoogle} />
          {error && <p className="error" role="alert">{error}</p>}
          <div className="zWelcomeOr"><span>{t("or")}</span></div>
          <button type="button" className="zWelcomeGuest" onClick={guest}><span><b>{t("continueGuest")}</b><small>{t("welcomeGuestHint")}</small></span><ArrowRight size={20} aria-hidden="true" /></button>
          <form className="zWelcomeCode" onSubmit={(e) => { e.preventDefault(); markGuest(); navigate("/join" + (code.trim() ? "?code=" + encodeURIComponent(code.trim().toUpperCase()) : "")); }}>
            <label className="zField"><span>{t("welcomeHaveCode")}</span><input value={code} onChange={(e) => setCode(e.target.value)} placeholder="SPL123" maxLength={12} autoCapitalize="characters" /></label>
            <button type="submit" className="zPill">{t("joinButton")}</button>
          </form>
        </div>
      </section>
    </main>
  );
}
