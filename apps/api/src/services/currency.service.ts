import {z} from 'zod';
import {prepareExpenseEdit,ExpenseInputError} from './expense-edit.validation.js';
export const currencySchema=z.enum(["EUR","USD","GBP","CHF","CAD","AUD","BAM","RSD","PLN","CZK","SEK","NOK","DKK","HUF"] as const);
// Largest remainders preserve the converted total across items, payers and shares.
export function apportion(total:number,weights:number[]){
 const sum=weights.reduce((a,b)=>a+b,0);if(!sum)return weights.map(()=>0);
 const raw=weights.map(w=>total*w/sum),out=raw.map(Math.floor);
 const order=raw.map((v,i)=>({i,f:v-out[i]})).sort((a,b)=>b.f-a.f||a.i-b.i);
 let remaining=total-out.reduce((a,b)=>a+b,0);for(let i=0;i<remaining;i++)out[order[i%order.length].i]++;
 return out;
}
export function prepareCurrencyExpense(input:any,people:string[],base='EUR'){
 const first=prepareExpenseEdit(input,people);
 const currency=currencySchema.parse(input.currency??base);
 const rate=currency===base?1:z.number().finite().positive().max(1000000).refine(n=>Math.abs(n*1e8-Math.round(n*1e8))<.01,'Najviše 8 decimala tečaja').parse(input.exchangeRate);
 const originalTotal=first.totalAmount;
 const target=Math.round(Math.round(originalTotal*100)*rate);
 if(target<1||target>999999999999)throw new ExpenseInputError('Preračunati iznos je izvan dopuštenog raspona.');
 const itemAmounts=apportion(target,first.items.map(i=>Math.round(i.price*100)));
 const payerAmounts=apportion(target,first.body.payers.map(p=>Math.round(p.amount*100)));
 const converted={...first.body,payers:first.body.payers.map((p,i)=>({...p,amount:payerAmounts[i]/100})).filter(p=>p.amount>0),items:first.items.map((item,i)=>{
 const shares=apportion(itemAmounts[i],item.shares.map(s=>Math.round(s.amount*100)));
 return {...item,price:itemAmounts[i]/100,shares:item.shares.map((s,j)=>({...s,amount:shares[j]/100}))};
 })};
 return {...prepareExpenseEdit(converted,people),currency,exchangeRate:rate,originalTotal};
}
