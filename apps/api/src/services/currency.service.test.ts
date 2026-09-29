import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareCurrencyExpense,apportion} from './currency.service.js';
const body=()=>({expectedUpdatedAt:new Date().toISOString(),currency:'USD',exchangeRate:.92345,payers:[{personId:'a',amount:7},{personId:'b',amount:3}],items:[{name:'Food',price:3.33,shares:[{personId:'a'},{personId:'b'}]},{name:'Drink',price:6.67,shares:[]}]});
test('foreign receipt converts once and conserves cents across items and payers',()=>{
 const p=prepareCurrencyExpense(body(),['a','b'],'EUR');
 assert.equal(p.totalAmount,9.23);assert.equal(p.originalTotal,10);assert.equal(p.currency,'USD');
 assert.equal(p.items.reduce((a,i)=>a+Math.round(i.price*100),0),923);
 assert.equal(p.body.payers.reduce((a,i)=>a+Math.round(i.amount*100),0),923);
 assert.equal(p.items[0].shares.reduce((a,i)=>a+Math.round(i.amount*100),0),Math.round(p.items[0].price*100));
 assert.deepEqual(p.items[1].shares,[]);
});
test('same currency ignores exchange rate and legacy requests inherit main currency',()=>{
 const b=body();b.currency='EUR';b.exchangeRate=99;
 const p=prepareCurrencyExpense(b,['a','b'],'EUR');assert.equal(p.totalAmount,10);assert.equal(p.exchangeRate,1);
 const legacy:any=body();delete legacy.currency;delete legacy.exchangeRate;assert.equal(prepareCurrencyExpense(legacy,['a','b'],'GBP').currency,'GBP');
});
test('unsupported currency, invalid rates and mismatched original totals are rejected',()=>{
 for(const rate of [0,-1,NaN,Infinity,1000001])assert.throws(()=>prepareCurrencyExpense({...body(),exchangeRate:rate},['a','b'],'EUR'));
 assert.throws(()=>prepareCurrencyExpense({...body(),currency:'BAD'},['a','b'],'EUR'));
 assert.throws(()=>prepareCurrencyExpense({...body(),exchangeRate:undefined},['a','b'],'EUR'));
 assert.throws(()=>prepareCurrencyExpense({...body(),payers:[{personId:'a',amount:11}]},['a','b'],'EUR'));
});
test('conversion rounding preserves totals over varied rates and participant counts',()=>{
 for(let amount=1;amount<1000;amount++)for(let count=1;count<9;count++){
 const xs=apportion(amount,Array.from({length:count},(_,i)=>i+1));assert.equal(xs.reduce((a,b)=>a+b,0),amount);assert.ok(xs.every(x=>x>=0&&Number.isInteger(x)));
 }
});
