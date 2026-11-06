import {useEffect,useState} from "react";
import {api} from "../api";
import {useLanguage} from "../i18n";
import type {Group,Workflow} from "../types";
const copy={
 hr:["Glavna valuta grupe","Valutu možeš promijeniti prije prvog računa ili uplate.","Oznaka grupe","Oslobodi ime za drugi uređaj","Postavi administratora","Ukloni administratorsku ulogu","Aktiviraj grupu","Arhiviraj grupu","Nova lozinka pozivnice","Obnovi kod i lozinku pozivnice","Stari kod više neće vrijediti. Nastaviti?"],
 en:["Group currency","Set before the first bill or payment.","Group icon","Release name for another device","Make admin","Remove admin role","Unarchive group","Archive group","New invitation password","Replace invite code and password","The old code will stop working. Continue?"],
 de:["Gruppenwährung","Vor der ersten Rechnung oder Zahlung einstellbar.","Gruppensymbol","Namen für ein anderes Gerät freigeben","Zum Administrator machen","Adminrolle entfernen","Gruppe aktivieren","Gruppe archivieren","Neues Einladungspasswort","Einladungscode und Passwort ersetzen","Der alte Code wird ungültig. Fortfahren?"],
 ja:["グループ通貨","最初の請求または支払いの前に設定します。","グループアイコン","別の端末用に名前を解放","管理者にする","管理者権限を外す","アーカイブを解除","アーカイブする","新しい招待パスワード","招待コードとパスワードを更新","古いコードは無効になります。続けますか？"]
};
export function GroupAdminTools({group,workflow,refresh}:{group:Group;workflow:Workflow;refresh:()=>Promise<void>}){
 const {language}=useLanguage(),c=copy[language],[options,setOptions]=useState<{code:string;name:string}[]>([]),[password,setPassword]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
 useEffect(()=>{let active=true;api.currencies().then(r=>{if(active)setOptions(r)}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[]);
 async function run(action:()=>Promise<unknown>,confirm?:string){if(busy||(confirm&&!window.confirm(confirm)))return;setBusy(true);setError("");try{await action();await refresh()}catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}}
 const slug=group.slug;
 return <fieldset className="rpPicker" disabled={busy}>{error&&<p role="alert">{error}</p>}
 <label>{c[0]}<select value={group.currency||"EUR"} disabled={!!group.expenses.length||!!workflow.transfers.length} onChange={e=>void run(()=>api.settings(slug,{currency:e.target.value}))}>{!options.some(o=>o.code===(group.currency||"EUR"))&&<option>{group.currency||"EUR"}</option>}{options.map(o=><option value={o.code} key={o.code}>{o.code} · {o.name}</option>)}</select><small>{c[1]}</small></label>
 <div>{c[2]}<div className="sharePicker">{["👥","🏠","🍽️","✈️","🎉","🏖️","🚗","💼"].map(avatar=><button key={avatar} type="button" aria-pressed={avatar===workflow.avatar} onClick={()=>void run(()=>api.settings(slug,{avatar}))}>{avatar}</button>)}</div></div>
 {workflow.people.filter(p=>p.claimed).map(p=><div key={p.id}><b>{p.name}</b><div className="sharePicker"><button type="button" onClick={()=>void run(()=>api.release(slug,p.id),c[3]+": "+p.name+"?")}>{c[3]}</button>{workflow.canOwn&&p.role!=="OWNER"&&<button type="button" onClick={()=>void run(()=>api.role(slug,p.id,p.role==="ADMIN"?"MEMBER":"ADMIN"),c[p.role==="ADMIN"?5:4]+": "+p.name+"?")}>{c[p.role==="ADMIN"?5:4]}</button>}</div></div>)}
 <button type="button" onClick={()=>void run(()=>api.settings(slug,{archived:!workflow.archived}),c[workflow.archived?6:7]+"?")}>{c[workflow.archived?6:7]}</button>
 <label>{c[8]}<input type="password" autoComplete="new-password" minLength={8} maxLength={80} value={password} onChange={e=>setPassword(e.target.value)}/></label><button type="button" disabled={password.length<8} onClick={()=>void run(async()=>{await api.rotateInvite(slug,password);setPassword("")},c[10])}>{c[9]}</button></fieldset>
}
