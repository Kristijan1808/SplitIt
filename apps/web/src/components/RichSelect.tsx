import {type ReactNode,useEffect,useId,useRef,useState} from "react";
import {Check,ChevronDown} from "lucide-react";

export type RichOption={value:string;label:string;visual?:ReactNode};

/** Padajući izbornik u stilu aplikacije: svaka opcija ima svoj prikaz (zastavu, paletu…). Tipkovnica: strelice, Enter, Esc. */
export function RichSelect({id,value,options,onChange,ariaLabel}:{id?:string;value:string;options:RichOption[];onChange:(v:string)=>void;ariaLabel:string}){
 const [open,setOpen]=useState(false),[hi,setHi]=useState(0),box=useRef<HTMLDivElement>(null),listId=useId();
 const cur=options.find(o=>o.value===value)??options[0];
 useEffect(()=>{if(!open)return;setHi(Math.max(0,options.findIndex(o=>o.value===value)));
  const close=(e:MouseEvent)=>{if(box.current&&!box.current.contains(e.target as Node))setOpen(false)};
  document.addEventListener("mousedown",close);return()=>document.removeEventListener("mousedown",close)},[open]);// eslint-disable-line react-hooks/exhaustive-deps
 const pick=(v:string)=>{onChange(v);setOpen(false)};
 const key=(e:React.KeyboardEvent)=>{
  if(e.key==="Escape"){setOpen(false);return}
  if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault();if(!open){setOpen(true);return}setHi(h=>(h+(e.key==="ArrowDown"?1:-1)+options.length)%options.length);return}
  if((e.key==="Enter"||e.key===" ")&&open){e.preventDefault();pick(options[hi].value)}
 };
 return <div className={"zRich"+(open?" open":"")} ref={box} onKeyDown={key}>
  <button id={id} type="button" className="zRichBtn" aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} aria-label={ariaLabel} onClick={()=>setOpen(o=>!o)}>
   {cur?.visual}<span className="zRichLabel">{cur?.label}</span><ChevronDown size={18} className="zRichChev"/>
  </button>
  {open&&<ul className="zRichList" role="listbox" id={listId} aria-label={ariaLabel}>
   {options.map((o,i)=><li key={o.value} role="option" aria-selected={o.value===value} className={(o.value===value?"on ":"")+(i===hi?"hi":"")} onMouseEnter={()=>setHi(i)} onClick={()=>pick(o.value)}>
    {o.visual}<span className="zRichLabel">{o.label}</span>{o.value===value&&<Check size={16} className="zRichCheck"/>}
   </li>)}
  </ul>}
 </div>;
}

/** Zastave kao SVG (Windows ne prikazuje emoji zastave, nego slova "HR"). */
export function Flag({code}:{code:string}){
 const s={width:28,height:20} as const;
 const wrap=(c:ReactNode)=><svg className="zFlag" viewBox="0 0 28 20" {...s} aria-hidden="true">{c}</svg>;
 if(code==="hr")return wrap(<><rect width="28" height="6.67" fill="#FF0000"/><rect y="6.67" width="28" height="6.67" fill="#fff"/><rect y="13.33" width="28" height="6.67" fill="#171796"/>
  <g transform="translate(10.5 4.2)"><rect width="7" height="8.5" rx="1.4" fill="#fff"/>{[0,1,2,3,4].map(r=>[0,1,2,3,4].map(c=>(r+c)%2===0?<rect key={r+"-"+c} x={c*1.4} y={r*1.6} width="1.4" height="1.6" fill="#FF0000"/>:null))}<rect width="7" height="8.5" rx="1.4" fill="none" stroke="#FF0000" strokeWidth=".4"/></g></>);
 if(code==="en")return wrap(<><rect width="28" height="20" fill="#012169"/><path d="M0 0L28 20M28 0L0 20" stroke="#fff" strokeWidth="4"/><path d="M0 0L28 20M28 0L0 20" stroke="#C8102E" strokeWidth="1.6"/><path d="M14 0V20M0 10H28" stroke="#fff" strokeWidth="6"/><path d="M14 0V20M0 10H28" stroke="#C8102E" strokeWidth="3.4"/></>);
 if(code==="de")return wrap(<><rect width="28" height="6.67" fill="#000"/><rect y="6.67" width="28" height="6.67" fill="#DD0000"/><rect y="13.33" width="28" height="6.67" fill="#FFCE00"/></>);
 if(code==="ja")return wrap(<><rect width="28" height="20" fill="#fff"/><circle cx="14" cy="10" r="6" fill="#BC002D"/></>);
 return wrap(<rect width="28" height="20" fill="#ccc"/>);
}

export function Swatches({colors}:{colors:readonly string[]}){
 return <span className="paletteSwatches zRichSw" aria-hidden="true">{colors.map(c=><i key={c} style={{backgroundColor:c}}/>)}</span>;
}
