import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, FolderOpen, X } from "lucide-react";
import { ThemeToggle } from "../components/ThemeToggle";
import { ConfirmationModal } from "../components/ConfirmationModal";
import { useLanguage } from "../i18n";
import {
  getSavedGroups,
  removeSavedGroup,
  type SavedGroup
} from "../storage";
import "../styles/MyGroupsPage.css";
export function MyGroupsPage() {
  const { t } = useLanguage();
  const [groups, setGroups] = useState<SavedGroup[]>([]);
  const [groupToDelete, setGroupToDelete] = useState<SavedGroup | null>(null);

  useEffect(() => {
    // "My groups" is local-first. localStorage is the source of truth for
    // which groups are saved on this browser.
    setGroups(getSavedGroups());
  }, []);

  const handleDeleteGroup = (group: SavedGroup) => {
    setGroupToDelete(group);
  };

  const confirmDeleteGroup = () => {
    if (!groupToDelete) return;

    removeSavedGroup(groupToDelete.slug);
    setGroups((currentGroups) =>
      currentGroups.filter((currentGroup) => currentGroup.slug !== groupToDelete.slug)
    );
    setGroupToDelete(null);
  };

  return (
    <main className="page">
      <div className="topBar">
        <ThemeToggle />
      </div>

      <Link className="backLink" to="/">
        <ArrowLeft size={18} /> {t("home")}
      </Link>

      <section className="card">
        <h1>{t("myGroups")}</h1>

        {groups.length === 0 ? (
          <p className="muted">{t("noSavedGroups")}</p>
        ) : (
          <div className="list">
            {groups.map((group) => (
              <div className="groupRow savedGroupRow" key={group.slug}>
                <Link
                  className="groupRowLink"
                  to={`/g/${group.slug}`}
                  aria-label={`${t("open")} ${group.name}`}
                >
                  <div className="savedGroupInfo">
                    <strong>{group.name}</strong>

                    {group.code && (
                      <small className="muted savedGroupMeta">
                        {t("code")}: {group.code}
                      </small>
                    )}

                    {group.participantName && (
                      <small className="muted savedGroupMeta">
                        {t("youAre")}: {group.participantName}
                      </small>
                    )}
                  </div>

                  <small className="inlineFlex savedGroupOpen">
                    <FolderOpen size={15} /> {t("open")}
                  </small>
                </Link>

                <button
                  type="button"
                  className="deleteSavedGroupButton"
                  onClick={() => handleDeleteGroup(group)}
                  aria-label={`Delete ${group.name} from My Groups`}
                  title="Delete from My Groups"
                >
                  <X size={16} strokeWidth={2.5} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <ConfirmationModal
        open={groupToDelete !== null}
        title="Delete group from My Groups?"
        message={
          groupToDelete
            ? `Are you sure you want to delete "${groupToDelete.name}" from My Groups?\n\nYou can join it again later using the group code and password.`
            : ""
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        danger
        onConfirm={confirmDeleteGroup}
        onCancel={() => setGroupToDelete(null)}
      />
    </main>
  );
}
