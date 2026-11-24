import {type ReactNode,useEffect,useRef,useState} from "react";
import {ImagePlus,Lock,KeyRound,UserCheck,Archive,Settings2} from "lucide-react";
import {ConfirmationModal} from "./ConfirmationModal";
import {avInner} from "./PersonAv";
import {fileToAvatarDataUrl} from "../imageUpload";
import {api} from "../api";
import {useLanguage} from "../i18n";
import type {Group,Workflow} from "../types";

type Lang="hr"|"en"|"de"|"ja";
const copy:Record<Lang,Record<string,string>>={
 hr:{currency:"Glavna valuta grupe",currencyHint:"Valutu možeš promijeniti prije prvog računa ili uplate.",icon:"Oznaka grupe",release:"Oslobodi ime",makeAdmin:"Postavi za administratora",removeAdmin:"Ukloni administratora",unarchive:"Vrati grupu iz arhive",archive:"Arhiviraj grupu",newPass:"Nova lozinka pozivnice",rotate:"Obnovi kod i lozinku",rotateAsk:"Stari kod više neće vrijediti. Nastaviti?",general:"Općenito",access:"Pristup i pozivnica",members:"Članovi s računom",archiveHead:"Arhiva",lockHint:"Zaključana grupa ne prima nove račune ni izmjene.",archiveHint:"Arhivirana grupa miče se s popisa. Svi računi i povijest ostaju sačuvani.",membersHint:"Oslobodi ime ako je član promijenio uređaj ili je odabrao pogrešno ime.",upload:"Učitaj sliku",removeImg:"Ukloni sliku",confirm:"Potvrdi",cancel:"Odustani",undo:"Možeš je kasnije vratiti.",passHint:"Najmanje 8 znakova. Postojeći članovi ostaju u grupi.",owner:"Vlasnik",admin:"Administrator",member:"Član"},
 en:{currency:"Group currency",currencyHint:"Set before the first bill or payment.",icon:"Group icon",release:"Release name",makeAdmin:"Make admin",removeAdmin:"Remove admin",unarchive:"Unarchive group",archive:"Archive group",newPass:"New invitation password",rotate:"Replace code and password",rotateAsk:"The old code will stop working. Continue?",general:"General",access:"Access & invitation",members:"Members with an account",archiveHead:"Archive",lockHint:"A locked group accepts no new bills or edits.",archiveHint:"An archived group leaves the list. All bills and history are kept.",membersHint:"Release a name if a member switched devices or picked the wrong name.",upload:"Upload image",removeImg:"Remove image",confirm:"Confirm",cancel:"Cancel",undo:"You can undo this later.",passHint:"At least 8 characters. Existing members stay in the group.",owner:"Owner",admin:"Admin",member:"Member"},
 de:{currency:"Gruppenwährung",currencyHint:"Vor der ersten Rechnung oder Zahlung einstellbar.",icon:"Gruppensymbol",release:"Namen freigeben",makeAdmin:"Zum Admin machen",removeAdmin:"Admin entfernen",unarchive:"Gruppe aktivieren",archive:"Gruppe archivieren",newPass:"Neues Einladungspasswort",rotate:"Code und Passwort ersetzen",rotateAsk:"Der alte Code wird ungültig. Fortfahren?",general:"Allgemein",access:"Zugang & Einladung",members:"Mitglieder mit Konto",archiveHead:"Archiv",lockHint:"Eine gesperrte Gruppe nimmt keine neuen Rechnungen an.",archiveHint:"Archivierte Gruppen verschwinden aus der Liste. Alles bleibt gespeichert.",membersHint:"Gib einen Namen frei, wenn jemand das Gerät gewechselt hat.",upload:"Bild hochladen",removeImg:"Bild entfernen",confirm:"Bestätigen",cancel:"Abbrechen",undo:"Kann später rückgängig gemacht werden.",passHint:"Mindestens 8 Zeichen.",owner:"Inhaber",admin:"Admin",member:"Mitglied"},
 ja:{currency:"グループ通貨",currencyHint:"最初の請求または支払いの前に設定します。",icon:"グループアイコン",release:"名前を解放",makeAdmin:"管理者にする",removeAdmin:"管理者権限を外す",unarchive:"アーカイブを解除",archive:"アーカイブする",newPass:"新しい招待パスワード",rotate:"コードとパスワードを更新",rotateAsk:"古いコードは無効になります。続けますか？",general:"一般",access:"アクセスと招待",members:"アカウントのあるメンバー",archiveHead:"アーカイブ",lockHint:"ロック中は新しい請求を受け付けません。",archiveHint:"アーカイブしても履歴は残ります。",membersHint:"端末を変えたメンバーの名前を解放できます。",upload:"画像をアップロード",removeImg:"画像を削除",confirm:"確認",cancel:"キャンセル",undo:"後で元に戻せます。",passHint:"8文字以上。",owner:"オーナー",admin:"管理者",member:"メンバー"}
};
const ICONS=["👥","🏠","🍽️","✈️","🎉","🏖️","🚗","💼"];

/** Postavke grupe: kartice Općenito · Pristup · Članovi · Arhiva (isti stil kao glavne Postavke). */
export function GroupAdminTools({group,workflow,refresh,nameForm,lockRow}:{group:Group;workflow:Workflow;refresh:()=>Promise<void>;nameForm?:ReactNode;lockRow?:ReactNode}){
 const {language}=useLanguage(),c=copy[(language as Lang)]??copy.hr;
 const [options,setOptions]=useState<{code:string;name:string}[]>([]),[password,setPassword]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
 // Popis valuta dolazi s vanjskog servisa; ako nije dostupan, ostaje trenutačna valuta (bez poruke o grešci).
 useEffect(()=>{let active=true;api.currencies().then(r=>{if(active)setOptions(r)}).catch(()=>{});return()=>{active=false}},[]);
 const [ask,setAsk]=useState<{action:()=>Promise<unknown>;text:string}|null>(null);
 async function exec(action:()=>Promise<unknown>){setBusy(true);setError("");try{await action();await refresh()}catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}}
 async function run(action:()=>Promise<unknown>,confirm?:string){if(busy)return;if(confirm){setAsk({action,text:confirm});return}await exec(action)}
 const slug=group.slug,fileRef=useRef<HTMLInputElement>(null),hasImage=Boolean(workflow.avatar?.startsWith("data:image/"));
 const locked=!!group.expenses.length||!!workflow.transfers.length,cur=group.currency||"EUR";
 const claimed=workflow.people.filter(p=>p.claimed);
 return <div className="zGSet">
  <ConfirmationModal open={ask!==null} title={ask?.text??""} message={c.undo} confirmLabel={c.confirm} cancelLabel={c.cancel} danger onConfirm={()=>{const a=ask;setAsk(null);if(a)void exec(a.action)}} onCancel={()=>setAsk(null)}/>
  {error&&<p className="zInlineError" role="alert">{error}</p>}

  <section className="zCard zGSetCard">
   <h3 className="zGSetHead"><Settings2 size={18}/>{c.general}</h3>
   {nameForm}
   <div className="zGSetRow">
    <div className="grow"><b>{c.currency}</b><small>{c.currencyHint}</small></div>
    <select value={cur} disabled={busy||locked} onChange={e=>void run(()=>api.settings(slug,{currency:e.target.value}))} aria-label={c.currency}>
     {!options.some(o=>o.code===cur)&&<option value={cur}>{cur}</option>}
     {options.map(o=><option value={o.code} key={o.code}>{o.code} · {o.name}</option>)}
    </select>
   </div>
   <div className="zGSetBlock">
    <b>{c.icon}</b>
    <div className="zIconGrid" role="radiogroup" aria-label={c.icon}>
     {hasImage&&<span className="zIconImg on"><img src={workflow.avatar!} alt=""/></span>}
     {ICONS.map(avatar=><button key={avatar} type="button" role="radio" aria-checked={avatar===workflow.avatar} className={avatar===workflow.avatar?"on":""} disabled={busy} onClick={()=>void run(()=>api.settings(slug,{avatar}))}>{avatar}</button>)}
    </div>
    <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e=>{const file=e.target.files?.[0];e.target.value="";if(file)void run(async()=>api.settings(slug,{avatar:await fileToAvatarDataUrl(file)}))}}/>
    <div className="zGSetBtns">
     <button type="button" className="zPill" disabled={busy} onClick={()=>fileRef.current?.click()}><ImagePlus size={16}/>&nbsp;{c.upload}</button>
     {hasImage&&<button type="button" className="zPill zPillGhost" disabled={busy} onClick={()=>void run(()=>api.settings(slug,{avatar:"👥"}))}>{c.removeImg}</button>}
    </div>
   </div>
  </section>

  <section className="zCard zGSetCard">
   <h3 className="zGSetHead"><Lock size={18}/>{c.access}</h3>
   {lockRow}
   <div className="zGSetBlock">
    <label className="zGSetField"><b><KeyRound size={15}/>&nbsp;{c.newPass}</b>
     <div className="zGSetInline">
      <input type="password" autoComplete="new-password" minLength={8} maxLength={80} value={password} disabled={busy} onChange={e=>setPassword(e.target.value)} placeholder="••••••••"/>
      <button type="button" className="zBtn sm" disabled={busy||password.length<8} onClick={()=>void run(async()=>{await api.rotateInvite(slug,password);setPassword("")},c.rotateAsk)}>{c.rotate}</button>
     </div>
     <small>{c.passHint}</small>
    </label>
   </div>
  </section>

  {claimed.length>0&&<section className="zCard zGSetCard">
   <h3 className="zGSetHead"><UserCheck size={18}/>{c.members}</h3>
   <small className="zGSetHint">{c.membersHint}</small>
   <div className="zGSetList">
    {claimed.map(p=><div key={p.id} className="zGSetPerson">
     <span className="zPayerAv sm">{avInner(p.name,p.avatar)}</span>
     <div className="grow"><b>{p.name}</b><small>{p.role==="OWNER"?c.owner:p.role==="ADMIN"?c.admin:c.member}</small></div>
     <div className="zGSetBtns">
      {workflow.canOwn&&p.role!=="OWNER"&&<button type="button" className="zPill zPillGhost" disabled={busy} onClick={()=>void run(()=>api.role(slug,p.id,p.role==="ADMIN"?"MEMBER":"ADMIN"),(p.role==="ADMIN"?c.removeAdmin:c.makeAdmin)+": "+p.name+"?")}>{p.role==="ADMIN"?c.removeAdmin:c.makeAdmin}</button>}
      <button type="button" className="zPill" disabled={busy} onClick={()=>void run(()=>api.release(slug,p.id),c.release+": "+p.name+"?")}>{c.release}</button>
     </div>
    </div>)}
   </div>
  </section>}

  <section className="zCard zGSetCard">
   <h3 className="zGSetHead"><Archive size={18}/>{c.archiveHead}</h3>
   <div className="zGSetRow">
    <div className="grow"><small>{c.archiveHint}</small></div>
    <button type="button" className={workflow.archived?"zBtnG sm":"zBtnD sm"} disabled={busy} onClick={()=>void run(()=>api.settings(slug,{archived:!workflow.archived}),(workflow.archived?c.unarchive:c.archive)+"?")}>{workflow.archived?c.unarchive:c.archive}</button>
   </div>
  </section>
 </div>;
}

export const groupSettingsCopy=copy;
