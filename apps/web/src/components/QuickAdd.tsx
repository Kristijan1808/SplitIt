import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ScanLine, PenLine, ArrowUpRight, X } from "lucide-react";
import { useLanguage } from "../i18n";
import { useOverview, tileClass } from "../overview";

/** Prozor koji otvara središnji "+" gumb: izbor grupe pa vrsta unosa. */
export function QuickAdd({ onClose }: { onClose: () => void }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { rows } = useOverview();
  const groups = rows.filter((r) => !r.archived);
  const [slug, setSlug] = useState<string>("");
  useEffect(() => { if (!slug && groups[0]) setSlug(groups[0].slug); }, [groups, slug]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  const go = (to: string) => { onClose(); navigate(to); };
  return (
    <div className="zOverlay zQuickOverlay" onClick={onClose}>
      <div className="zSheet zQuick" role="dialog" aria-modal="true" aria-label={t("quickAddTitle")} onClick={(e) => e.stopPropagation()}>
        <div className="zSheetHead"><div className="grow"><b>{t("quickAddTitle")}</b><small>{groups.length ? t("quickAddWhich") : t("quickAddNoGroups")}</small></div>
          <button type="button" className="zBack" aria-label={t("cancel")} onClick={onClose}><X size={18} aria-hidden="true" /></button></div>
        {groups.length > 0 ? <>
          <div className="zQuickGroups" role="radiogroup" aria-label={t("quickAddWhich")}>
            {groups.map((g) => (
              <button key={g.slug} type="button" role="radio" aria-checked={slug === g.slug} className={`zQuickChip${slug === g.slug ? " on" : ""}`} onClick={() => setSlug(g.slug)}>
                {g.avatar && /^(data:|https?:|\/)/.test(g.avatar) ? <img src={g.avatar} alt="" /> : <i className={tileClass(g.name)}>{g.avatar || g.name.charAt(0).toUpperCase()}</i>}<span>{g.name}</span>
              </button>))}
          </div>
          <div className="zQuickGrid">
            <button type="button" className="zQuickBig on" disabled={!slug} onClick={() => go(`/g/${slug}/add-expense?scan=1`)}><ScanLine size={30} aria-hidden="true" /><span><b>{t("scanBill")}</b><small>{t("quickAddScanHint")}</small></span></button>
            <button type="button" className="zQuickBig" disabled={!slug} onClick={() => go(`/g/${slug}/add-expense`)}><PenLine size={30} aria-hidden="true" /><span><b>{t("quickAddManual")}</b><small>{t("quickAddManualHint")}</small></span></button>
          </div>
          <button type="button" className="zQuickRow" disabled={!slug} onClick={() => go(`/g/${slug}?tab=debts&pay=1`)}><ArrowUpRight size={22} aria-hidden="true" /><span><b>{t("quickAddPayment")}</b><small>{t("quickAddPaymentHint")}</small></span><em>›</em></button>
        </> : <div className="zQuickGrid">
          <button type="button" className="zQuickBig on" onClick={() => go("/new")}><span><b>{t("createGroup")}</b></span></button>
          <button type="button" className="zQuickBig" onClick={() => go("/join")}><span><b>{t("joinCode")}</b></span></button>
        </div>}
      </div>
    </div>
  );
}
