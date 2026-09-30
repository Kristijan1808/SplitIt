import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createOutbox} from '../src/outbox-engine.mjs';
const entry=(id='one',scope='guest')=>({id,scope,slug:'trip',body:{requestId:id}});
function setup(send){let disk=[];const io={read:async()=>structuredClone(disk),write:async rows=>{disk=structuredClone(rows)},send};return {io,q:createOutbox(io)};}
test('offline save survives restart and retries with the identical request id',async()=>{
 let online=false,calls=[];const {q,io}=setup(async e=>{calls.push(e.body.requestId);if(!online)throw new Error('Network failed');});
 await q.enqueue(entry());await q.sync('guest',{});assert.equal((await q.list('guest')).length,1);
 online=true;const restarted=createOutbox(io);await restarted.retry('guest');assert.equal(await restarted.sync('guest',{}),1);assert.deepEqual(calls,['one','one']);assert.deepEqual(await restarted.list('guest'),[]);
});
test('server accepted but response lost: retry is idempotent',async()=>{
 const server=new Map();let first=true;const {q}=setup(async e=>{if(!server.has(e.id))server.set(e.id,e.body);if(first){first=false;throw new Error('timeout');}});
 await q.enqueue(entry());await q.sync('guest',{});await q.retry('guest');await q.sync('guest',{});assert.equal(server.size,1);assert.equal((await q.list('guest')).length,0);
});
test('parallel enqueue and acknowledgement do not lose another bill',async()=>{
 let release;const wait=new Promise(r=>release=r);const {q}=setup(async()=>wait);
 await q.enqueue(entry());const sync=q.sync('guest',{});await new Promise(r=>setTimeout(r,0));await q.enqueue(entry('two'));release();await sync;assert.deepEqual((await q.list('guest')).map(x=>x.id),['two']);
});
test('separate accounts and server rejection remain isolated and durable',async()=>{
 let calls=[];const {q}=setup(async e=>{calls.push(e.id);throw Object.assign(new Error('Group locked'),{status:423});});
 await q.enqueue(entry('a','alice'));await q.enqueue(entry('b','bob'));await q.sync('alice',{});await q.sync('alice',{});
 assert.deepEqual(calls,['a']);assert.equal((await q.list('alice'))[0].status,'error');assert.equal((await q.list('bob'))[0].status,'pending');
});
test('double save and concurrent sync send only once',async()=>{
 let calls=0;const {q}=setup(async()=>{calls++;});await Promise.all([q.enqueue(entry()),q.enqueue(entry())]);await Promise.all([q.sync('guest',{}),q.sync('guest',{})]);assert.equal(calls,1);
});
test('failed local write never reports successful enqueue',async()=>{
 const q=createOutbox({read:async()=>[],write:async()=>{throw new Error('Storage full');},send:async()=>assert.fail('must not send')});await assert.rejects(q.enqueue(entry()),/Storage full/);
});
