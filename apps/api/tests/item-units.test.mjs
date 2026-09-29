import {test} from 'node:test';
import assert from 'node:assert/strict';
import {unitShares} from '../dist/services/unit-allocation.js';
import {expenseAllocation} from '../dist/services/allocation.js';
import {prepareCurrencyExpense} from '../dist/services/currency.service.js';
import {ownShares} from '../dist/services/own-item.service.js';
test('3 colas: two belong to Ana, one remains with payer until claimed',()=>{
 const shares=unitShares(15,3,[{personId:'ana',units:2}]);
 assert.equal(shares[0].amount,10);
 const a=expenseAllocation({totalAmount:15,payers:[{personId:'payer',amount:15}],items:[{price:15,quantity:3,splitMode:'units',shares}]});
 assert.equal(a.unassignedAmount,5);assert.equal(a.allocationComplete,false);
 assert.deepEqual(a.provisionalShares,[{personId:'payer',amount:5}]);
 assert.equal(unitShares(15,3,[...shares,{personId:'ivan',units:1}])[1].amount,5);
 assert.throws(()=>unitShares(15,3,[...shares,{personId:'ivan',units:2}]),e=>e.status===409);
});
test('shared single platter is split between any number of people',()=>{
 let shares=[];for(const id of ['ana','iva','marko'])shares=ownShares(20,shares,id,true,false);
 assert.deepEqual(shares.map(s=>s.amount),[6.67,6.67,6.66]);
});
test('cent conservation for partial claims including zero and FX rounding',()=>{
 for(let price=0;price<35;price++)for(let qty=1;qty<9;qty++)for(let taken=0;taken<=qty;taken++){
  const shares=unitShares(price/100,qty,taken?[{personId:'a',units:taken}]:[]);
  const e=expenseAllocation({payers:[{personId:'b',amount:price/100}],items:[{price:price/100,quantity:qty,splitMode:'units',shares}]});
  assert.equal(Math.round(shares.reduce((n,s)=>n+s.amount,0)*100)+Math.round(e.unassignedAmount*100),price);
  assert.equal(e.allocationComplete,taken===qty);
 }
});
test('edit and currency conversion preserve quantities; legacy remains shared',()=>{
 const input={expectedUpdatedAt:new Date().toISOString(),currency:'USD',exchangeRate:.92,payers:[{personId:'a',amount:15}],items:[{name:'Cola',price:15,quantity:3,splitMode:'units',shares:[{personId:'b',units:2}]}]};
 const result=prepareCurrencyExpense(input,['a','b'],'EUR');
 assert.equal(result.items[0].shares[0].units,2);assert.equal(result.items[0].shares[0].amount,9.2);assert.equal(result.totalAmount,13.8);
 assert.throws(()=>prepareCurrencyExpense({...input,items:[{...input.items[0],quantity:1}]},['a','b'],'EUR'));
 const legacy=prepareCurrencyExpense({...input,currency:'EUR',items:[{name:'Old',price:15,quantity:3,shares:[{personId:'a'},{personId:'b'}]}]},['a','b']);
 assert.equal(legacy.items[0].splitMode,'shared');assert.equal(legacy.items[0].shares[0].amount,7.5);
});
