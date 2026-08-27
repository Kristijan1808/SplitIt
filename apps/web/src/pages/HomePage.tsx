import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, UserRoundPlus, WalletCards } from "lucide-react";
import { ThemeToggle } from "../components/ThemeToggle";
import { LanguageToggle } from "../components/LanguageToggle";
import { useLanguage } from "../i18n";

import "../styles/HomePage.css";
export function HomePage() {
  const [recentGroups, setRecentGroups] = useState<Array<{ slug: string; name: string }>>([]);
  const { t } = useLanguage();

  useEffect(() => {
    const saved = window.localStorage.getItem("splitit:groups");
    if (!saved) return;
    try {
      setRecentGroups(JSON.parse(saved));
    } catch {
      setRecentGroups([]);
    }
  }, []);

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

      <div className="homeMainActions">
        <Link to="/new" className="primaryButton homeActionButton">
          <Plus size={18} /> {t("createGroup")}
        </Link>

        <Link to="/join" className="primaryButton homeActionButton">
          <UserRoundPlus size={18} /> {t("joinGroup")}
        </Link>
      </div>

      <div className="homeSecondaryAction">
        <Link to="/my-groups" className="secondaryButton homeActionButton">
          {t("myGroups")}
        </Link>
      </div>
    </main>
  );
}
