import {useEffect,useState} from 'react';
import {getSavedGroups,getWhoAmI} from './storage';
import {snapshotForEditor} from './offlineBills';
import type {GroupSnapshot} from './types';
export type OverviewRow={slug:string;name:string;members?:number;balance?:number;currency:string;avatar?:string;code?:string;archived?:boolean;recent:{text:string;at:string;group:string;slug:string}[]};
export const money=(n:number,cur='EUR')=>n.toLocaleString('hr-HR',{minimumFractionDigits:2,maximumFractionDigits:2})+' '+(cur==='EUR'?'€':cur);
/** Učitava sažetak svih spremljenih grupa (saldo, sudionici, zadnje aktivnosti) iz postojećeg API-ja. */
export function useOverview(){
 const groups=getSavedGroups();
 const [rows,setRows]=useState<OverviewRow[]>(groups.map(g=>({slug:g.slug,name:g.name,members:g.memberCount,code:g.code,currency:'EUR',recent:[]})));
 const [loading,setLoading]=useState(groups.length>0);
 useEffect(()=>{let live=true;Promise.allSettled(groups.map(async g=>{
  const s:GroupSnapshot=await snapshotForEditor(g.slug);
  const me=getWhoAmI(g.slug)?.participantId??g.participantId??s.workflow?.people?.find(p=>p.mine)?.id;
  const b=s.settlements?.balances?.find(x=>x.id===me);
  return {slug:g.slug,name:s.group.name,code:s.group.code,members:s.group.people?.length??g.memberCount,balance:b?b.balance:undefined,currency:s.group.currency||'EUR',avatar:s.workflow?.avatar,archived:!!s.workflow?.archived,
   recent:(s.history||[]).slice(0,8).map(h=>({text:h.message,at:h.createdAt,group:s.group.name,slug:g.slug}))} as OverviewRow;
 })).then(r=>{if(live){setRows(groups.map((g,i)=>{const x=r[i];return x.status==='fulfilled'?x.value:{slug:g.slug,name:g.name,members:g.memberCount,code:g.code,currency:'EUR',recent:[]}}));setLoading(false)}});return()=>{live=false}// eslint-disable-next-line
 },[]);
 return {rows,loading};
}
export const tileClass=(name:string)=>'zTile t'+(name.charCodeAt(0)%4);
