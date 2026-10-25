import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LogOut, Plus, UserRoundPlus, WalletCards } from "lucide-react";
import { clearAuth, getAuthUser } from "../auth";
import { ThemeToggle } from "../components/ThemeToggle";
import { LanguageToggle } from "../components/LanguageToggle";
import { useLanguage } from "../i18n";

export function HomePage() {
  const [username, setUsername] = useState(getAuthUser()?.username ?? "");
  const { t } = useLanguage();

  return (
    <main className="page">
      <div className="topBar">
        <div className="topBarControls">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </div>
      <section className="hero homeHero">
        <div className="brand homeBrand">
          <div className="logo">
            <WalletCards size={28} />
          </div>
          <div>
            <p className="eyebrow">{t("moneyMadeSimple")}</p>
            <h1>{t("appName")}</h1>
          </div>
        </div>
      </section>

      <div className="homeActions">
        <Link to="/new" className="primaryButton homeActionButton">
          <Plus size={18} /> {t("createGroup")}
        </Link>

        <Link to="/join" className="primaryButton homeActionButton">
          <UserRoundPlus size={18} /> {t("joinGroup")}
        </Link>
      </div>

      <div className="homeActionsSecondary">
        <Link to="/my-groups" className="secondaryButton homeActionButton">
          {t("myGroups")}
        </Link>
        {username ? (
          <button
            type="button"
            className="secondaryButton homeActionButton"
            onClick={() => {
              clearAuth();
              setUsername("");
            }}
          >
            <LogOut size={18} /> {username} · {t("signOut")}
          </button>
        ) : (
          <Link to="/login" className="secondaryButton homeActionButton">
            {t("login")}
          </Link>
        )}
      </div>
    </main>
  );
}
