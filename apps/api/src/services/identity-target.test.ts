import {test} from 'node:test';
import assert from 'node:assert/strict';
import {identityTarget} from './identity-target.js';
function mock(mine:any=null,existing:any=null){const created:any[]=[];let call=0;return {created,person:{findFirst:async()=>++call===1?mine:existing,create:async({data}:any)=>{created.push(data);return {id:'new-person',...data}}},history:{create:async()=>({})}};}
test('new identity trims and creates a participant in the joined group',async()=>{const tx=mock();assert.equal(await identityTarget(tx,'group',{name:'  Jura  '},['guest:a']),'new-person');assert.deepEqual(tx.created,[{groupId:'group',name:'Jura'}]);});
test('retry of own new name is idempotent',async()=>{const tx=mock({id:'mine',name:'Jura',inactive:false});assert.equal(await identityTarget(tx,'group',{name:'jura'},['guest:a']),'mine');assert.equal(tx.created.length,0);});
test('duplicate name never claims someone else and an existing identity cannot create another',async()=>{for(const tx of [mock(null,{id:'other',name:'Jura'}),mock({id:'mine',name:'Ana'})]){await assert.rejects(()=>identityTarget(tx,'group',{name:'Jura'},['guest:a']));assert.equal(tx.created.length,0);}});
test('empty and oversized names and ambiguous input rejected',async()=>{for(const body of [{name:' '},{name:'a'.repeat(61)},{name:'Jura',personId:'x'}])await assert.rejects(()=>identityTarget(mock(),'group',body,['guest:a']));});
