import type {ExpenseItem} from '../types';
import {useLanguage} from '../i18n';
const tone=(i:number)=>'c'+((i%4)+1);
export function ReceiptItem({item,people,mine,currency,disabled,onChange}:{item:ExpenseItem,people:{id:string,name:string}[],mine?:string|null,currency:string,disabled:boolean,onChange:(v:number|boolean)=>Promise<void>}){
 const{t,locale}=useLanguage(),units=item.splitMode==='units',qty=item.quantity||1,shares=item.shares||[],me=shares.find(p=>p.personId===mine),own=units?(me?.units||0):Number(!!me),left=Math.max(0,qty-shares.reduce((a,p)=>a+(p.units||0),0)),pending=units?left>0:!shares.length;
 const money=(v:number)=>new Intl.NumberFormat(locale,{style:'currency',currency}).format(v);
 const names=shares.map(p=>({id:p.personId,name:p.person?.name||people.find(x=>x.id===p.personId)?.name||p.personId,n:units?(p.units||0):1,amount:Number(p.amount)}));
 const perHead=names.length?Number(item.price)/Math.max(1,names.reduce((a,p)=>a+p.n,0)):0;
 const only=names.length===1&&names[0].id===mine;
 const who=!names.length?(units&&left>0?t('remainingUnits')+': '+left:t('noItemAssigned')):only?t('onlyYou'):names.length===people.length&&people.length>1?t('everyoneLabel')+' · '+money(perHead):names.map(p=>p.id===mine?t('youShort'):p.name.split(' ')[0]).join(', ')+(names.length>1?' · '+money(perHead):'');
 const toggle=()=>void onChange(units?(own>0?0:1):!own);
 return <article className={'zItem'+(pending?' pending':'')}>
  <button type="button" className={'zCheck'+(own?' on':'')} role="checkbox" aria-checked={!!own} aria-label={item.name} disabled={disabled||(!own&&(units?!left:false))} onClick={toggle}>{own?'\u2713':''}</button>
  <div className="grow"><b>{item.name}{units&&<small className="zMuted"> {qty} {t('pieces')}.</small>}</b>
   <div className="zWho"><span className="zAvs">{names.slice(0,4).map((p,i)=><i key={p.id} className={'zAv s '+tone(i)}>{p.name.trim().charAt(0).toUpperCase()}</i>)}</span><span className="zMuted">{who}</span></div></div>
  {units&&<div className="zStep"><button type="button" aria-label={'\u2212 '+item.name} disabled={disabled||!own} onClick={()=>void onChange(own-1)}>−</button><output>{own}</output><button type="button" aria-label={'+ '+item.name} disabled={disabled||!left} onClick={()=>void onChange(own+1)}>+</button></div>}
  <b className="zItemPrice">{money(Number(item.price))}</b>
 </article>
}
