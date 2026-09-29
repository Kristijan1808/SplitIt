import {z} from 'zod';
export const codeSchema=z.string().regex(/^[A-Z]{3}$/);
const upstream='https://api.frankfurter.dev/v2';
export type Currency={code:string;name:string};
let catalog:{at:number;data:Currency[]}|undefined;
let pending:Promise<Currency[]>|undefined;
const fail=(message:string)=>Object.assign(new Error(message),{status:503});
async function fetchJSON(path:string){
 try{const response=await fetch(upstream+path,{signal:AbortSignal.timeout(10000),headers:{Accept:'application/json'}});
 if(!response.ok)throw Error('upstream');return await response.json();}
 catch{throw fail('Servis tečaja trenutačno nije dostupan. Pokušaj ponovno.');}
}
export function parseCurrencies(input:unknown):Currency[]{
 const rows=z.array(z.object({iso_code:codeSchema,name:z.string().min(1)})).min(1).parse(input);
 const excluded=new Set(['XAU','XAG','XPD','XPT','XDR','CMD']);
 return [...new Map(rows.filter(x=>!excluded.has(x.iso_code)).map(x=>[x.iso_code,{code:x.iso_code,name:x.name}])).values()].sort((a,b)=>a.code.localeCompare(b.code));
}
export async function listCurrencies(){
 if(catalog&&Date.now()-catalog.at<3600000)return catalog.data;
 if(!pending)pending=fetchJSON('/currencies').then(parseCurrencies).then(data=>{catalog={at:Date.now(),data};return data}).finally(()=>{pending=undefined});
 return pending;
}
export function parseRate(input:unknown,base:string,quote:string,now=Date.now()){
 const value=z.object({base:codeSchema,quote:codeSchema,date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),rate:z.number().finite().positive().max(1000000)}).parse(input);
 const date=Date.parse(value.date+'T00:00:00Z');
 if(value.base!==base||value.quote!==quote||!Number.isFinite(date)||new Date(date).toISOString().slice(0,10)!==value.date||now-date>7*86400000||date-now>2*86400000)throw fail('Nema dovoljno svježeg tečaja za ovaj valutni par.');
 const rate=Number(value.rate.toFixed(8));if(rate<=0)throw fail('Tečaj je izvan podržane preciznosti.');
 return {base,quote,rate,rateDate:value.date,source:'Frankfurter · dnevni referentni tečaj'};
}
export async function latestRate(base:string,quote:string){
 codeSchema.parse(base);codeSchema.parse(quote);
 const currencies=await listCurrencies();if(!currencies.some(c=>c.code===base)||!currencies.some(c=>c.code===quote))throw Object.assign(new Error('Valuta nije podržana izvorom tečaja.'),{status:400});
 return parseRate(await fetchJSON(`/rate/${base}/${quote}`),base,quote);
}
