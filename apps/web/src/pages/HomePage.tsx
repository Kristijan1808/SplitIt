import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, UserRoundPlus, WalletCards } from "lucide-react";
import { ThemeToggle } from "../components/ThemeToggle";

export function HomePage() {
  const [recentGroups, setRecentGroups] = useState<Array<{ slug: string; name: string }>>([]);

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
        <ThemeToggle />
      </div>
      <section className="hero" style={{ minHeight: "auto", gap: 24 }}>
        <div className="brand" style={{ alignItems: "center" }}>
          <div className="logo">
            <WalletCards size={28} />
          </div>
          <div>
            <p className="eyebrow">Money made simple</p>
            <h1>SplitIt</h1>
          </div>
        </div>
      </section>

      <div style={{ display: "grid", gap: 12, marginTop: 0 }}>
        <Link to="/new" className="primaryButton" style={{ width: "100%", justifyContent: "center" }}>
          <Plus size={18} /> Create group
        </Link>

        <Link to="/join" className="primaryButton" style={{ width: "100%", justifyContent: "center" }}>
          <UserRoundPlus size={18} /> Join group
        </Link>
      </div>

      <div style={{ marginTop: 20 }}>
        <Link to="/my-groups" className="secondaryButton" style={{ width: "100%", justifyContent: "center" }}>
          My groups
        </Link>
      </div>
    </main>
  );
}
