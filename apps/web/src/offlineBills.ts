import {api, type CreateDraftExpenseRequest} from "./api";
import {getAuthUser} from "./auth";
import {getWhoAmI} from "./storage";
import type {GroupSnapshot} from "./types";

const prefix="splitit:offline:2:";
async function scope(){
 const identity=getAuthUser()?.id??localStorage.getItem("splitit.guest-token");
 if(!identity)return null;
 const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode((import.meta.env.VITE_API_URL??"http://localhost:4000")+"|"+identity));
 return prefix+Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,"0")).join("")+":";
}
export async function snapshotForEditor(slug:string){
 try{
  const snapshot=await api.getGroupSnapshot(slug);
  if(snapshot.group.accessType==="REGISTERED_ONLY"&&!snapshot.workflow.people.some(p=>p.mine))snapshot.workflow=await api.workflow(slug);
  try{const key=await scope();if(key)localStorage.setItem(key+"group:"+slug,JSON.stringify(snapshot))}catch{/* private mode or full storage */}
  return snapshot;
 }catch(err){
  if(!(err instanceof TypeError))throw err;
  const key=await scope(),raw=key&&localStorage.getItem(key+"group:"+slug);
  if(!raw)throw err;
  return JSON.parse(raw) as GroupSnapshot;
 }
}
type Pending={slug:string,person:string,base:string,body:CreateDraftExpenseRequest,error?:string};
export async function queueBill(slug:string,person:string,base:string,body:CreateDraftExpenseRequest){
 const key=await scope();if(!key||!person||!body.requestId)throw Error("Prije unosa bez interneta otvori grupu i odaberi svoje ime.");
 localStorage.setItem(key+"bill:"+body.requestId,JSON.stringify({slug,person,base,body}));
 window.dispatchEvent(new Event("splitit:queue"));
}
export async function pendingBills(slug?:string){
 const key=await scope();if(!key)return [];
 return Object.keys(localStorage).filter(k=>k.startsWith(key+"bill:")).map(k=>({key:k,row:JSON.parse(localStorage.getItem(k)!) as Pending})).filter(x=>!slug||x.row.slug===slug);
}
let active:Promise<void>|undefined;
export function syncBills(retry=false){
 if(!navigator.onLine)return Promise.resolve();if(active)return active;
 active=(async()=>{for(const {key,row} of await pendingBills()){
  if(row.error&&!retry||getWhoAmI(row.slug)?.participantId!==row.person)continue;
  try{
   const body={...row.body};
   if(body.currency&&body.currency!==row.base)body.quoteId=(await api.fxQuote(row.slug,body.currency)).id;
   if(!key.startsWith((await scope())+"bill:")||getWhoAmI(row.slug)?.participantId!==row.person)continue;
   await api.createExpense(row.slug,body);localStorage.removeItem(key);
   window.dispatchEvent(new CustomEvent("splitit:uploaded",{detail:row.slug}));
  }catch(err){if(err instanceof TypeError||!navigator.onLine)break;
    localStorage.setItem(key,JSON.stringify({...row,error:err instanceof Error?err.message:String(err)}));}
  window.dispatchEvent(new Event("splitit:queue"));
 }})().finally(()=>{active=undefined});return active;
}
