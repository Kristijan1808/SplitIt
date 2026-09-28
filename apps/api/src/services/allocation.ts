// Unclaimed amounts temporarily remain with payers; never create false item claims.
export function expenseAllocation(e:{totalAmount?:unknown;payers:{personId:string;amount:unknown}[];items?:{price:unknown;shares:unknown[]}[]}) {
 const cents=(v:unknown)=>Math.round(Number(v)*100);
 const unassignedItems=e.items?.filter(i=>!i.shares.length)||[];
 const unassignedCents=unassignedItems.reduce((s,i)=>s+cents(i.price),0);
 const paid=e.payers.reduce((s,p)=>s+cents(p.amount),0);
 const paymentIncomplete=e.totalAmount!==undefined&&paid!==cents(e.totalAmount);
 const raw=e.payers.map(p=>paid?unassignedCents*cents(p.amount)/paid:0),values=raw.map(Math.floor);
 const order=raw.map((v,i)=>({i,remainder:v-values[i]})).sort((a,b)=>b.remainder-a.remainder||a.i-b.i);
 for(let n=unassignedCents-values.reduce((s,v)=>s+v,0),i=0;paid&&i<n;i++)values[order[i%order.length].i]++;
 return {unassignedCount:unassignedItems.length,unassignedAmount:unassignedCents/100,allocationComplete:!unassignedItems.length,paymentIncomplete,
 provisionalShares:e.payers.map((p,i)=>({personId:p.personId,amount:values[i]/100})).filter(s=>s.amount>0)};
}
