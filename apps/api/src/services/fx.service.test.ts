import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseRate,parseCurrencies} from './fx-provider.js';
import {resolveQuote} from './fx.service.js';
const id='4ac783a8-704f-4a8e-92c3-59342d09be84';
const group={id:'group',currency:'EUR'};
const row=()=>({id,groupId:'group',base:'USD',quote:'EUR',rate:.91,rateDate:'2026-09-29',source:'Frankfurter',expiresAt:new Date(Date.now()+60000)});
const tx=(value:any)=>({fxQuote:{findUnique:async()=>value}});
test('saved rate comes from server quote, never from client rate',async()=>{
 const body=await resolveQuote(tx(row()),{currency:'USD',quoteId:id,exchangeRate:999},group);
 assert.equal(body.exchangeRate,.91);assert.equal(body.rateDate,'2026-09-29');
});
test('missing, expired, foreign-group and mismatched quotes cannot be saved',async()=>{
 await assert.rejects(()=>resolveQuote(tx(row()),{currency:'USD',exchangeRate:1},group));
 for(const bad of [null,{...row(),expiresAt:new Date(0)},{...row(),groupId:'other'},{...row(),base:'GBP'},{...row(),quote:'CHF'}])await assert.rejects(()=>resolveQuote(tx(bad),{currency:'USD',quoteId:id},group));
});
test('same currency remains usable without external quote',async()=>{
 const body=await resolveQuote({}, {currency:'EUR',exchangeRate:999},group);assert.equal(body.exchangeRate,1);assert.equal(body.rateDate,null);
});
test('provider data rejects stale, wrong pair, zero, invalid and tiny rates',()=>{
 const now=Date.parse('2026-09-29T12:00:00Z');const good={date:'2026-09-29',base:'USD',quote:'EUR',rate:.923456789};
 assert.equal(parseRate(good,'USD','EUR',now).rate,.92345679);
 for(const bad of [{...good,date:'2026-08-01'},{...good,quote:'GBP'},{...good,rate:0},{...good,rate:1e-12},{...good,date:'nonsense'}])assert.throws(()=>parseRate(bad,'USD','EUR',now));
});
test('catalog supports provider currencies beyond old list and excludes metals',()=>{
 const rows=parseCurrencies([{iso_code:'JPY',name:'Yen'},{iso_code:'AED',name:'Dirham'},{iso_code:'XAU',name:'Gold'},{iso_code:'JPY',name:'Yen'}]);assert.deepEqual(rows.map(x=>x.code),['AED','JPY']);
 assert.throws(()=>parseCurrencies([{iso_code:'bad',name:'Wrong'}]));
});
