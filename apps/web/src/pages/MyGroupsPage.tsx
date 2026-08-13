import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, FolderOpen } from "lucide-react";
import { ThemeToggle } from "../components/ThemeToggle";

export function MyGroupsPage() {
  const [groups, setGroups] = useState<Array<{ slug: string; name: string }>>([]);

  useEffect(() => {
    const saved = window.localStorage.getItem("splitit:groups");
    if (!saved) return;

    try {
      setGroups(JSON.parse(saved));
    } catch {
      setGroups([]);
    }
  }, []);

  return (
    <main className="page">
      <div className="topBar">
        <ThemeToggle />
      </div>

      <Link className="backLink" to="/">
        <ArrowLeft size={18} /> Home
      </Link>

      <section className="card">
        <h1>My groups</h1>

        {groups.length === 0 ? (
          <p className="muted">No saved groups yet.</p>
        ) : (
          <div className="list">
            {groups.map((group) => (
              <Link className="groupRow" key={group.slug} to={`/g/${group.slug}`}>
                <span>{group.name}</span>
                <small className="inlineFlex">
                  <FolderOpen size={15} /> Open
                </small>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
