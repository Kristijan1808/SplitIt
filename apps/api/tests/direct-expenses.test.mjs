import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareExpenseEdit} from '../dist/services/expense-edit.validation.js';
import {expenseAllocation} from '../dist/services/allocation.js';
import {calculateBalances} from '../dist/services/balance-domain.js';
import {ownShares} from '../dist/services/own-item.service.js';
const people=[{id:'a',name:'Ana'},{id:'b',name:'Boris'},{id:'c',name:'Cecilija'}];
const body={expectedUpdatedAt:'2026-09-28T12:00:00.000Z',payers:[{personId:'a',amount:30}],items:[{name:'Prvo',price:10,quantity:1,shares:[]},{name:'Drugo',price:20,quantity:1,shares:[]}]};
function receipt(body){const v=prepareExpenseEdit(body,people.map(p=>p.id));return {totalAmount:v.totalAmount,payers:v.body.payers,items:v.items,shares:v.shares}}
test('a new unclaimed receipt immediately counts as paid but creates no imaginary claims',()=>{
 const e=receipt(body);const a=expenseAllocation(e);assert.equal(a.unassignedCount,2);assert.equal(a.unassignedAmount,30);assert.equal(a.allocationComplete,false);assert.deepEqual(e.shares,[]);
 const result=calculateBalances(people,[e],[]);assert.equal(result.balances[0].paid,30);assert.equal(result.balances.reduce((s,p)=>s+p.balance,0),0);assert.deepEqual(result.settlements,[]);
});
test('partial claims affect balances immediately and stay zero-sum',()=>{
 const e=receipt({...body,items:[{...body.items[0],shares:[{personId:'b'}]},body.items[1]]});
 const a=expenseAllocation(e);assert.equal(a.unassignedAmount,20);assert.equal(a.unassignedCount,1);
 const result=calculateBalances(people,[e],[]);assert.equal(result.balances[0].balance,10);assert.equal(result.balances[1].balance,-10);assert.deepEqual(result.settlements.map(x=>x.amount),[10]);
});
test('one platter can be shared by three people; the final claimant may unselect',()=>{
 const shares=ownShares(20,[{personId:'a'},{personId:'b'}],'c',true,false);
 const e=receipt({...body,payers:[{personId:'a',amount:20}],items:[{name:'Plata',price:20,quantity:1,shares}]});
 assert.equal(e.items[0].quantity,1);assert.equal(e.items[0].shares.length,3);assert.equal(expenseAllocation(e).allocationComplete,true);
 assert.equal(e.items[0].shares.reduce((s,x)=>s+Math.round(x.amount*100),0),2000);
 assert.deepEqual(ownShares(20,[{personId:'a'}],'a',false,false),[]);
});
test('pending amount is held proportionally by multiple payers with exact cents',()=>{
 const e=receipt({...body,payers:[{personId:'a',amount:20},{personId:'b',amount:10}],items:[{name:'x',price:10.01,shares:[]},{name:'y',price:19.99,shares:[{personId:'c'}]}]});
 assert.deepEqual(expenseAllocation(e).provisionalShares,[{personId:'a',amount:6.67},{personId:'b',amount:3.34}]);
 assert.equal(Math.round(calculateBalances(people,[e],[]).balances.reduce((s,x)=>s+x.balance,0)*100),0);
});
test('invalid quantity and mismatched payers cannot create a new bill',()=>{
 assert.throws(()=>receipt({...body,items:[{...body.items[0],quantity:0},body.items[1]]}));
 assert.throws(()=>receipt({...body,payers:[{personId:'a',amount:29}]}));
});
test('HTTP create is immediate and request retries return the same bill',async()=>{
 const [{default:express},{prisma},{createExpense},{errorHandler}]=await Promise.all([import('express'),import('../dist/core.js'),import('../dist/services/create-expense.service.js'),import('../dist/middleware.error.js')]);
 const original={session:prisma.groupSession.findFirst,find:prisma.expense.findUnique,tx:prisma.$transaction};const rows=new Map();let creations=0;
 prisma.groupSession.findFirst=async()=>({role:'MEMBER'});prisma.expense.findUnique=async({where})=>rows.get(where.requestId)||null;
 prisma.$transaction=async fn=>fn({group:{findUniqueOrThrow:async()=>({locked:false,archived:false})},person:{findMany:async()=>people},history:{create:async()=>({})},expense:{create:async({data})=>{
  creations++;const id='receipt-'+creations;
  const e={...data,id,createdAt:new Date(),updatedAt:new Date(),payers:data.payers.create.map((p,i)=>({...p,id:'p'+i,expenseId:id})),items:data.items.create.map((p,i)=>({...p,id:'i'+i,expenseId:id,shares:p.shares.create.map((s,j)=>({...s,id:'s'+j}))})),shares:data.shares.create.map((s,i)=>({...s,id:'a'+i}))};rows.set(data.requestId,e);return e;
 }}});
 const app=express();app.use(express.json());app.use((req,res,next)=>{res.locals.group={id:'g',accessType:'MIXED'};next()});app.post('/expenses',createExpense);app.use(errorHandler);
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const url=`http://127.0.0.1:${server.address().port}/expenses`;
 const send=b=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json','X-SplitIt-Guest-Token':'a'.repeat(64)},body:JSON.stringify(b)});
 try{
  const request={...body,requestId:'a7262b3a-3df2-4d57-a0b7-48c6cc5c2f42'};
  const first=await send(request);assert.equal(first.status,201);const a=await first.json();assert.equal(a.unassignedCount,2);assert.equal(a.totalAmount,30);
  const retry=await send(request);assert.equal(retry.status,200);assert.equal((await retry.json()).id,a.id);assert.equal(creations,1);
 }finally{await new Promise(resolve=>server.close(resolve));prisma.groupSession.findFirst=original.session;prisma.expense.findUnique=original.find;prisma.$transaction=original.tx;}
});
