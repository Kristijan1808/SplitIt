// Unclaimed amounts temporarily remain with payers; never create false item claims.
export function expenseAllocation(e:{totalAmount?:unknown;payers:{personId:string;amount:unknown}[];items?:{price:unknown;quantity?:number;splitMode?:string;shares:{amount?:unknown;units?:number|null}[]}[]}) {
 const cents=(v:unknown)=>Math.round(Number(v)*100);
 const remainder=(i:{price:unknown;shares:{amount?:unknown}[]})=>Math.max(0,cents(i.price)-i.shares.reduce((n,s)=>n+cents(s.amount??0),0));
 const unassignedItems=e.items?.filter(i=>i.splitMode==="units"?i.shares.reduce((n,s)=>n+(s.units??0),0)<(i.quantity??1):!i.shares.length)||[];
 const unassignedCents=unassignedItems.reduce((s,i)=>s+remainder(i),0);
 const paid=e.payers.reduce((s,p)=>s+cents(p.amount),0);
 const paymentIncomplete=e.totalAmount!==undefined&&paid!==cents(e.totalAmount);
 const raw=e.payers.map(p=>paid?unassignedCents*cents(p.amount)/paid:0),values=raw.map(Math.floor);
 const order=raw.map((v,i)=>({i,remainder:v-values[i]})).sort((a,b)=>b.remainder-a.remainder||a.i-b.i);
 for(let n=unassignedCents-values.reduce((s,v)=>s+v,0),i=0;paid&&i<n;i++)values[order[i%order.length].i]++;
 return {unassignedCount:unassignedItems.length,unassignedAmount:unassignedCents/100,allocationComplete:!unassignedItems.length,paymentIncomplete,
 provisionalShares:e.payers.map((p,i)=>({personId:p.personId,amount:values[i]/100})).filter(s=>s.amount>0)};
}
