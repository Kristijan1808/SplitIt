import {useState} from 'react';
import {Link} from 'react-router-dom';
import {useOverview} from '../overview';
import {useLanguage} from '../i18n';
const copy:Record<string,any>={hr:{title:'Aktivnost',all:'Sve',exp:'Troškovi',pay:'Uplate',pick:'Odabir',today:'DANAS',yest:'JUČER',older:'RANIJE',none:'Još nema aktivnosti.'},en:{title:'Activity',all:'All',exp:'Expenses',pay:'Payments',pick:'Selections',today:'TODAY',yest:'YESTERDAY',older:'EARLIER',none:'No activity yet.'}};
const kind=(t:string)=>/uplat|payment|transfer/i.test(t)?'pay':/odabir|stavk|select|claim|item/i.test(t)?'pick':'exp';
export function ActivityPage(){
 const {language}=useLanguage(),c=copy[language]??copy.en,{rows,loading}=useOverview();
 const [f,setF]=useState('all');
 const items=rows.flatMap(r=>r.recent).filter(x=>f==='all'||kind(x.text)===f).sort((a,b)=>b.at.localeCompare(a.at));
 const day=(iso:string)=>{const d=new Date(iso),n=new Date(),dd=Math.floor((+new Date(n.toDateString())-+new Date(d.toDateString()))/864e5);return dd<=0?c.today:dd===1?c.yest:c.older};
 const groups:Record<string,typeof items>={};items.forEach(x=>{(groups[day(x.at)]??=[]).push(x)});
 return <main className="page zPage"><h1 className="zH1">{c.title}</h1>
  <div className="zTabs small">{(['all','exp','pay','pick'] as const).map(k=><button key={k} className={'zTab'+(f===k?' on':'')} onClick={()=>setF(k)}>{c[k]}</button>)}</div>
  <div className="zCols"><div className="zCard zFeed">{Object.entries(groups).map(([d,list])=><div key={d}><div className="zSectionLabel">{d}</div>{list.map((x,i)=><Link key={i} className="zRow" to={'/g/'+encodeURIComponent(x.slug)}><i className="zAv">{x.group.charAt(0).toUpperCase()}</i><div className="grow"><b>{x.text}</b><span className="zMuted">{x.group} · {new Date(x.at).toLocaleTimeString('hr-HR',{hour:'2-digit',minute:'2-digit'})}</span></div></Link>)}</div>)}
  {!items.length&&<p className="zMuted">{loading?'…':c.none}</p>}</div></div></main>;
}
