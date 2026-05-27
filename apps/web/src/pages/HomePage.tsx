import { Link } from "react-router-dom";
import { Plus, WalletCards } from "lucide-react";
import { ThemeToggle } from "../components/ThemeToggle";

export function HomePage() {
  const recentGroups = JSON.parse(localStorage.getItem("splitit:groups") ?? "[]") as Array<{
    slug: string;
    name: string;
  }>;

  return (
    <main className="page">
      <div className="topBar">
        <ThemeToggle />
      </div>
      <section className="hero">
        <div className="brand">
          <div className="logo">
            <WalletCards size={28} />
          </div>
          <div>
            <p className="eyebrow">Money made simple</p>
            <h1>SplitIt</h1>
          </div>
        </div>

        <p className="heroText">
          Create a group, add people, track every payment, and instantly see who needs to pay whom.
          No registration. Everyone with the link can edit. Save the link to access the group later or share it with friends. Perfect for trips, roommates, couples, and more.
        </p>

        <Link className="primaryButton" to="/new">
          <Plus size={20} />
          Create new group
        </Link>
      </section>

      <section className="card">
        <h2>Your groups</h2>
        {recentGroups.length === 0 ? (
          <p className="muted">Groups you create on this device will appear here.</p>
        ) : (
          <div className="list">
            {recentGroups.map((group) => (
              <Link className="groupRow" key={group.slug} to={`/g/${group.slug}`}>
                <span>{group.name}</span>
                <small>Open</small>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
