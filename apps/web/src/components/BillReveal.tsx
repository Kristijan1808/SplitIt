import {useEffect,useState,type ReactNode} from 'react';
import './home-bleed.css';
export function BillReveal({open,children}:{open:boolean;children:ReactNode}){
 const [keep,setKeep]=useState(open);
 useEffect(()=>{if(open){setKeep(true);return}const id=setTimeout(()=>setKeep(false),window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:210);return ()=>clearTimeout(id)},[open]);
 return <div className="billReveal" data-open={open} inert={!open} aria-hidden={!open}><div>{(open||keep)&&children}</div></div>
}
