import {test} from "node:test";import assert from "node:assert/strict";import {participantIdentity as id} from "./participant-identity.js";
test("registered identity follows verified account across devices, never the selected device identity",()=>{
const p={userId:"alice",identityKey:"device-a"};assert.equal(id(p,"REGISTERED_ONLY","alice",["device-b"]).mine,true);assert.equal(id(p,"REGISTERED_ONLY","bob",["device-a"]).mine,false);assert.equal(id({...p,userId:null},"REGISTERED_ONLY","bob",["device-a"]).mine,false);
});
test("guest identity still follows its device",()=>{const p={userId:null,identityKey:"a"};assert.equal(id(p,"MIXED",undefined,["a"]).mine,true);assert.equal(id(p,"ANONYMOUS_ONLY",undefined,["b"]).mine,false)});
