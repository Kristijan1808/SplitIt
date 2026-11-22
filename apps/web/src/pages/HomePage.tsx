import {useAuthTick} from '../useAuthTick';
import {useEffect,useState} from 'react';
import {Link,Navigate} from 'react-router-dom';
import {guestChosen} from './WelcomePage';
import {getSavedGroups,getWhoAmI} from '../storage';
import {getAuthUser} from '../auth';
import {snapshotForEditor} from '../offlineBills';
import {useLanguage} from '../i18n';
import {Receipt,BellRing,ArrowUpRight} from 'lucide-react';
import type {GroupSnapshot} from '../types';

const copy={
 hr:{morning:'Dobro jutro',day:'Dobar dan',evening:'Dobra večer',hi:'Bok',total:'Ukupni saldo u svim grupama',owed:'Duguju ti',owe:'Ti duguješ',groups:'Tvoje grupe',all:'Sve',recent:'Nedavno',members:'sudionika',oweShort:'duguješ',owedShort:'duguju ti',even:'podmireno',newGroup:'+ Nova grupa',join:'Pridruži se grupi',empty:'Još nemaš grupa.',added:'je dodao'},
 en:{morning:'Good morning',day:'Good afternoon',evening:'Good evening',hi:'Hi',total:'Total balance across groups',owed:'You are owed',owe:'You owe',groups:'Your groups',all:'All',recent:'Recent',members:'members',oweShort:'you owe',owedShort:'you are owed',even:'settled',newGroup:'+ New group',join:'Join a group',empty:'No groups yet.',added:'added'},
} as Record<string,any>;
const money=(n:number,cur='EUR')=>n.toLocaleString('hr-HR',{minimumFractionDigits:2,maximumFractionDigits:2})+' '+(cur==='EUR'?'€':cur);
type Todo={kind:'claim'|'remind'|'pay';title:string;sub:string;href:string;btn:string;who:string;at:string};
type Row={slug:string;name:string;members?:number;balance?:number;currency:string;avatar?:string;recent:{who:string;text:string;at:string}[];todos?:Todo[]};
export function HomePage(){
 useAuthTick();
 const {language,t}=useLanguage(),c=copy[language]??copy.en,groups=getSavedGroups(),user=getAuthUser();
 const [rows,setRows]=useState<Row[]>(groups.map(g=>({slug:g.slug,name:g.name,members:g.memberCount,currency:'EUR',recent:[]})));
 useEffect(()=>{let live=true;Promise.allSettled(groups.map(async g=>{
  const s:GroupSnapshot=await snapshotForEditor(g.slug);
  const me=getWhoAmI(g.slug)?.participantId??g.participantId??s.workflow?.people?.find(p=>p.mine)?.id;
  const b=s.settlements?.balances?.find(x=>x.id===me);
  const cur=s.group.currency||'EUR',base='/g/'+encodeURIComponent(g.slug),todos:Todo[]=[];
  if(me&&!s.workflow?.archived){
   for(const e of s.group.expenses||[]){const items=e.items||[];if(!items.length||e.allocationComplete!==false)continue;if(items.some(i=>i.shares.some(x=>x.personId===me)))continue;
    todos.push({kind:'claim',title:t('todoClaim'),sub:(e.note||t('expense'))+' · '+s.group.name+' · '+money(Number(e.totalAmount),cur),href:base+'?expense='+e.id,btn:t('todoClaimBtn'),who:'?',at:e.createdAt});}
   // "Čeka tebe" je samo za račune sa stavkama gdje trebaš označiti svoje stavke.
  }
  return {slug:g.slug,name:s.group.name,members:s.group.people?.length??g.memberCount,balance:b?b.balance:undefined,currency:cur,avatar:s.workflow?.avatar,todos,
   recent:(s.history||[]).slice(0,3).map(h=>({who:'',text:h.message,at:h.createdAt}))} as Row;
 })).then(r=>{if(live)setRows(groups.map((g,i)=>{const x=r[i];return x.status==='fulfilled'?x.value:{slug:g.slug,name:g.name,members:g.memberCount,currency:'EUR',recent:[]}}))});return()=>{live=false}// eslint-disable-next-line
 },[]);
 if(!user&&!groups.length&&!guestChosen())return <Navigate to="/welcome" replace/>;
 const owed=rows.reduce((a,r)=>a+Math.max(r.balance??0,0),0),owe=rows.reduce((a,r)=>a+Math.max(-(r.balance??0),0),0),total=owed-owe;
 const h=new Date().getHours(),greet=h<11?c.morning:h<18?c.day:c.evening,name=user?.username?.split('_')[0]||'';
 const order={claim:0,pay:1,remind:2} as const;const todos=rows.flatMap(r=>r.todos??[]).sort((a,b)=>order[a.kind]-order[b.kind]).slice(0,5);
 const recent=rows.flatMap(r=>r.recent.map(x=>({...x,group:r.name}))).sort((a,b)=>b.at.localeCompare(a.at)).slice(0,4);
 return <main className="page dHome">
  <div className="dHomeTop"><div><small>{greet}</small><h1>{c.hi}{name?', '+name.charAt(0).toUpperCase()+name.slice(1):''}</h1></div>
   <Link to="/settings" className="dAvatar" aria-label="Profil">{user?.avatarImage?<img src={user.avatarImage} alt=""/>:(user?.username||'?').charAt(0).toUpperCase()}</Link></div>
  <section className="dHero"><div><small className="dHeroGreet">{greet}{name?', '+name.charAt(0).toUpperCase()+name.slice(1):''}</small><span>{c.total}</span><strong>{total>0?'+':''}{money(total)}</strong></div>
   <div className="dHeroTiles"><div><small>{c.owed}</small><b className="pos">{money(owed)}</b></div><div><small>{c.owe}</small><b className="neg">{money(owe)}</b></div></div>
   <Link className="dHeroBtn" to="/new">{c.newGroup}</Link></section>
  {todos.length>0&&<section className="zTodo" aria-labelledby="todoHead"><div className="dHead"><h2 id="todoHead">{t('waitingForYou')} {todos.length>0&&<span className="zCount">{todos.length}</span>}</h2></div>
   {todos.length?<div className="zTodoList">{todos.map((x,i)=>{const I=x.kind==='claim'?Receipt:x.kind==='pay'?ArrowUpRight:BellRing;return <Link key={i} to={x.href} className={'zTodoRow '+x.kind}><span className="zTodoIc"><I size={20} aria-hidden="true"/></span><span className="zTodoTxt"><b>{x.title}</b><small>{x.sub}</small></span><span className="zPill">{x.btn}</span></Link>})}</div>
   :<div className="zTodoEmpty"><b>{t('allCaughtUp')}</b><small>{t('todoEmptyHint')}</small></div>}</section>}
  <div className="dCols"><section><div className="dHead"><h2>{c.groups}</h2><Link to="/my-groups">{c.all}</Link></div>
   <div className="dGroups">{rows.map(r=>{const b=r.balance;return <Link key={r.slug} className="dGroup" to={'/g/'+encodeURIComponent(r.slug)}>
    <i className={'dTile t'+(r.name.charCodeAt(0)%4)}>{r.avatar?.startsWith('data:image/')?<img src={r.avatar} alt=""/>:r.name.charAt(0).toUpperCase()}</i>
    <div className="dGroupMid"><strong>{r.name}</strong><small>{r.members!==undefined?r.members+' '+c.members:''}</small></div>
    {b!==undefined&&<div className="dGroupBal"><small>{Math.abs(b)<.005?c.even:b>0?c.owedShort:c.oweShort}</small><b className={Math.abs(b)<.005?'':b>0?'pos':'neg'}>{money(Math.abs(b),r.currency)}</b></div>}</Link>})}
   {!rows.length&&<section className="card muted">{c.empty}</section>}</div>
   <Link className="secondaryButton dJoin" to="/join">{c.join}</Link></section>
   {recent.length>0&&<section id="nedavno"><div className="dHead"><h2>{c.recent}</h2></div><div className="dRecent">{recent.map((x,i)=><div key={i}><span>{x.text}</span><small>{x.group}</small></div>)}</div></section>}
  </div></main>}
