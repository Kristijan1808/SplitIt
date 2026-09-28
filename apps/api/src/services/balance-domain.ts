import {expenseAllocation} from "./allocation.js";
// Integer cents throughout; repayments alter balances, never expense totals.
export function calculateBalances(people:{id:string;name:string}[],expenses:{payers:{personId:string;amount:unknown}[];shares:{personId:string;amount:unknown}[]}[],transfers:{fromId:string;toId:string;amount:unknown}[]){
 expenses=expenses.map(e=>{const a=expenseAllocation(e);return a.paymentIncomplete?{...e,payers:[],shares:[]}:{...e,shares:[...e.shares,...a.provisionalShares]}});
 const cents=(n:unknown)=>Math.round(Number(n)*100);
 const balances=people.map(p=>{
 const paid=expenses.reduce((sum,e)=>sum+e.payers.filter(x=>x.personId===p.id).reduce((s,x)=>s+cents(x.amount),0),0);
 const owed=expenses.reduce((sum,e)=>sum+e.shares.filter(x=>x.personId===p.id).reduce((s,x)=>s+cents(x.amount),0),0);
 const sent=transfers.filter(x=>x.fromId===p.id).reduce((s,x)=>s+cents(x.amount),0),received=transfers.filter(x=>x.toId===p.id).reduce((s,x)=>s+cents(x.amount),0);
 return {...p,paid:paid/100,owed:owed/100,balance:(paid-owed+sent-received)/100};
 });
 const creditors=balances.filter(p=>p.balance>0).map(p=>({...p,left:cents(p.balance)}));
 const debtors=balances.filter(p=>p.balance<0).map(p=>({...p,left:-cents(p.balance)}));
 const settlements:{from:string;fromName:string;to:string;toName:string;amount:number}[]=[];
 let i=0,j=0;while(i<creditors.length&&j<debtors.length){const c=creditors[i],d=debtors[j],amount=Math.min(c.left,d.left);if(amount)settlements.push({from:d.id,fromName:d.name,to:c.id,toName:c.name,amount:amount/100});c.left-=amount;d.left-=amount;if(!c.left)i++;if(!d.left)j++;}
 return {balances,settlements};
}
