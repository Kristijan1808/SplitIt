import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateBalances} from '../dist/services/balance-domain.js';
import {publicBills,billKeys} from '../dist/services/bill-permissions.js';
import {prisma} from '../dist/core.js';
import {actorPerson,groupGate,workflowRouter} from '../dist/services/workflow.service.js';
import express from 'express';
import {Prisma} from '@prisma/client';
const people=[{id:'a',name:'Ana'},{id:'b',name:'Luka'},{id:'c',name:'Petra'}];
const expenses=[{payers:[{personId:'a',amount:10.01}],shares:[{personId:'a',amount:3.34},{personId:'b',amount:3.34},{personId:'c',amount:3.33}]}];
test('repayments reduce debt without changing expense totals',()=>{
 const before=calculateBalances(people,expenses,[]);
 assert.equal(before.balances[0].balance,6.67);
 const after=calculateBalances(people,expenses,[{fromId:'b',toId:'a',amount:1}]);
 assert.equal(after.balances[0].balance,5.67);assert.equal(after.balances[1].balance,-2.34);
 assert.equal(after.balances.reduce((sum,b)=>sum+b.paid,0),10.01);
 const settled=calculateBalances(people,expenses,[{fromId:'b',toId:'a',amount:3.34},{fromId:'c',toId:'a',amount:3.33}]);assert.deepEqual(settled.settlements,[]);
});
test('repayment overpayment reverses creditor without destroying cents',()=>{
 const result=calculateBalances(people,expenses,[{fromId:'b',toId:'a',amount:12}]);
 assert.equal(Math.round(result.balances.reduce((s,b)=>s+b.balance,0)*100),0);
 assert.ok(result.settlements.some(x=>x.to==='b'));
});
test('public payload removes credentials recursively and returns numeric money',()=>{
 const value=publicBills({ownerKey:'private',passwordHash:'hash',person:{identityKey:'private'},bill:{creatorKey:'me',requestId:'private',amount:new Prisma.Decimal('12.34')}},['me']);
 assert.equal(value.bill.amount,12.34);assert.equal(value.bill.canManage,true);
 assert.equal(JSON.stringify(value).includes('private'),false);assert.equal(JSON.stringify(value).includes('hash'),false);
});
test('a participant header cannot impersonate another bound identity',async()=>{
 const req={headers:{},get:n=>n==='X-SplitIt-Guest-Token'?'a'.repeat(64):'a'};
 const old=prisma.person.findFirst;
 try{prisma.person.findFirst=async()=>({id:'a',identityKey:'someone-else'});await assert.rejects(actorPerson(req,'g'),e=>e.status===403);
 prisma.person.findFirst=async()=>({id:'a',identityKey:billKeys(req)[0]});assert.equal((await actorPerson(req,'g')).id,'a');}finally{prisma.person.findFirst=old;}
});
test('group routes reject non-members and ordinary members cannot administer',async()=>{
 const saved={group:prisma.group.findUnique,session:prisma.groupSession.findFirst,sessions:prisma.groupSession.findMany};
 let member=false;prisma.group.findUnique=async()=>({id:'g',slug:'demo',accessType:'MIXED'});prisma.groupSession.findFirst=async()=>member?{role:'MEMBER'}:null;prisma.groupSession.findMany=async()=>member?[{role:'MEMBER'}]:[];
 const app=express();app.use(express.json());app.use('/groups/:slug',groupGate);app.use('/groups/:slug/workflow',workflowRouter);app.use((e,req,res,next)=>res.status(e.status||500).json({error:e.message}));
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const base=`http://127.0.0.1:${server.address().port}/groups/demo/workflow`;
 try {let response=await fetch(base);assert.equal(response.status,403);member=true;response=await fetch(base+'/settings',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({archived:true})});assert.equal(response.status,403);
 response=await fetch(base+'/people/a/release',{method:'POST'});assert.equal(response.status,403);
 response=await fetch(base+'/people/a/role',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({role:'ADMIN'})});assert.equal(response.status,403);
 }finally{await new Promise(resolve=>server.close(resolve));prisma.group.findUnique=saved.group;prisma.groupSession.findFirst=saved.session;prisma.groupSession.findMany=saved.sessions;}
});
