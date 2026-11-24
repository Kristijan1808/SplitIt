
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LogOut, X } from "lucide-react";
import { useOverview, money, tileClass } from "../overview";
import { api } from "../api";
import { clearAuth, getAuthUser, isLoggedIn } from "../auth";
import { ConfirmationModal } from "../components/ConfirmationModal";
import { useLanguage } from "../i18n";
import {
  getSavedGroups,
  removeSavedGroup,
  mergeAccountGroups,
  type SavedGroup
} from "../storage";

export function MyGroupsPage() {
  const { t } = useLanguage();
  const [groups, setGroups] = useState<SavedGroup[]>([]);
  const [groupToDelete, setGroupToDelete] = useState<SavedGroup | null>(null);
  const [accountList, setAccountList] = useState(false);
  const [username, setUsername] = useState(getAuthUser()?.username ?? "");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const loadGroups = async () => {
      if (!isLoggedIn()) {
        setGroups(getSavedGroups());
        return;
      }
      try {
        // Grupe s računa spajaju se s grupama stvorenima bez računa na ovom uređaju.
        const accountGroups = await api.getMyGroups();
        if (cancelled) return;
        const user = getAuthUser();
        if (user?.id) mergeAccountGroups(user.id, accountGroups);
        setAccountList(true);
        setGroups(getSavedGroups());
      } catch (loadError) {
        if (cancelled) return;
        if (loadError instanceof Error && loadError.message === "Not logged in") {
          clearAuth();
          setUsername("");
          setGroups(getSavedGroups());
        } else {
          setError(loadError instanceof Error ? loadError.message : t("somethingWentWrong"));
        }
      }
    };
    void loadGroups();
    return () => { cancelled = true; };
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

  const signOut = () => {
    clearAuth();
    setUsername("");
    setAccountList(false);
    setGroups(getSavedGroups());
  };

  const {rows}=useOverview();
  const bySlug=new Map(rows.map(r=>[r.slug,r]));
  const [q,setQ]=useState("");
  const shown=groups.filter(g=>g.name.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <main className="page zPage">
      <div className="zTop"><h1>{t("myGroups")}</h1></div>
      <div className="zGrid2"><Link className="zBtn" to="/new" style={{minHeight:48}}>{t("createShort")}</Link><Link className="zBtnG" to="/join" style={{minHeight:48}}>{t("joinCode")}</Link></div>
      {groups.length>3&&<label className="zSearch"><input aria-label={t("searchGroups")} placeholder={t("searchGroups")} value={q} onChange={e=>setQ(e.target.value)} /></label>}
      {error && <p className="error">{error}</p>}
      {groups.length === 0 ? (
        <section className="zCard"><p className="zMuted">{t("noSavedGroups")}</p></section>
      ) : (
        <div className="zGroups">
          {shown.map((group) => {
            const o=bySlug.get(group.slug),b=o?.balance;
            return (
            <div className="zGroupWrap" key={group.slug}>
              <Link className="zGroup" to={`/g/${group.slug}`} aria-label={`${t("open")} ${group.name}`}>
                <i className={tileClass(group.name)}>{o?.avatar?.startsWith("data:image/")?<img src={o.avatar} alt="" />:group.name.charAt(0).toUpperCase()}</i>
                <div className="zGroupMid"><strong>{group.name}</strong><small>{o?.members!==undefined?`${o.members} ${t("membersShort")}`:group.code?`${t("code")}: ${group.code}`:""}</small></div>
                {b!==undefined&&<div className="zGroupBal"><small>{Math.abs(b)<.005?"":b>0?"+":"−"}</small><b className={Math.abs(b)<.005?"":b>0?"zPos":"zNeg"}>{money(Math.abs(b),o?.currency)}</b></div>}
              </Link>
              {!accountList && <button type="button" className="zGroupX" onClick={() => handleDeleteGroup(group)} aria-label={`Delete ${group.name} from My Groups`} title="Delete from My Groups"><X size={14} strokeWidth={2.5} /></button>}
            </div>);
          })}
        </div>
      )}

      <ConfirmationModal
        open={!accountList && groupToDelete !== null}
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
