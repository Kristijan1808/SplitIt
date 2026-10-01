import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { prisma } from "../core.js";
import { groupService } from "./group.service.js";
import { billKeys, creatorKey, canManageBill } from "./bill-permissions.js";
import { ensureCanViewGroup, ensureCanEditGroup } from "./access.service.js";
const secret = "c".repeat(64);
function request(extra: any = {}): any {
  return { headers:{}, get:(name:string)=>name === "X-SplitIt-Guest-Token" ? secret : undefined,
    body:{name:"Ekipa",password:"lozinka",people:["Jura","Ana"]}, ...extra };
}
const group = {id:"g",slug:"code",code:"ABC123",name:"Ekipa",accessType:"REGISTERED_ONLY",locked:false,
  passwordHash:"",ownerKey:null,ownerUserId:"removed-user",expenses:[],people:[],history:[],draftExpenses:[]};

test("creating a group ignores missing account even with an old signed token", async () => {
  const oldFind = prisma.group.findUnique, oldCreate = prisma.group.create;
  const token = jwt.sign({userId:"deleted-user",username:"old"},process.env.JWT_SECRET ?? "dev-secret-change-me");
  let data:any;
  (prisma.group as any).findUnique=async()=>null;
  (prisma.group as any).create=async(args:any)=>{data=args.data;return group;};
  try {
    const req=request({headers:{authorization:`Bearer ${token}`}});
    const result=await groupService.create(req);
    assert.equal(data.ownerUserId,null);
    assert.equal(data.members,undefined);
    assert.equal(data.accessType,"ANONYMOUS_ONLY");
    assert.equal(data.ownerKey,creatorKey(req));
    assert.ok(data.ownerKey.startsWith("guest:"));
    assert.equal(data.sessions.create.role,"OWNER");
    assert.deepEqual(data.people.create,[{name:"Jura"},{name:"Ana"}]);
    assert.equal((result as any).ownerUserId,undefined);
    assert.equal(result.accessType,"ANONYMOUS_ONLY");
  } finally {(prisma.group as any).findUnique=oldFind;(prisma.group as any).create=oldCreate;}
});

test("guest joins a formerly registered-only group with code and password", async () => {
  const oldFind=prisma.group.findUnique,oldSession=prisma.groupSession.upsert;
  const found={...group,passwordHash:await bcrypt.hash("lozinka",4)};let saved:any;
  (prisma.group as any).findUnique=async()=>found;
  (prisma.groupSession as any).upsert=async(args:any)=>{saved=args;return {};};
  try {
    const req=request({body:{code:"ABC123",password:"lozinka"}});
    await groupService.join(req);
    assert.equal(saved.create.key,creatorKey(req));
    assert.equal(saved.create.groupId,"g");
    saved=null;
    await assert.rejects(groupService.join(request({body:{code:"ABC123",password:"wrong"}})),/Invalid password/);
    assert.equal(saved,null);
  } finally {(prisma.group as any).findUnique=oldFind;(prisma.groupSession as any).upsert=oldSession;}
});

test("guest access still requires a group session and respects locked groups",async()=>{
 const old=prisma.groupSession.findFirst;
 try {
  (prisma.groupSession as any).findFirst=async()=>null;
  assert.equal((await ensureCanViewGroup(group,request())).allowed,false);
  (prisma.groupSession as any).findFirst=async()=>({role:"MEMBER"});
  assert.equal((await ensureCanViewGroup(group,request())).allowed,true);
  assert.equal((await ensureCanEditGroup({...group,locked:true},request())).status,423);
 } finally {(prisma.groupSession as any).findFirst=old;}
});

test("forged bearer and public participant ID cannot claim someone else's receipt",()=>{
 const req=request({headers:{authorization:"Bearer forged"},body:{personId:"another-person"}});
 assert.equal(billKeys(req).length,1);
 assert.equal(canManageBill({creatorKey:"user:victim"},req),false);
 assert.equal(canManageBill({creatorKey:creatorKey(req)},req),true);
 assert.throws(()=>creatorKey(request({get:()=>undefined})),/identiteta/);
});

test("upgrade carries existing rights to a device without reading users", async () => {
 const {preserveDeviceAccess}=await import("./device-access.js");
 const oldFind=prisma.groupSession.findUnique,oldTx=prisma.$transaction;
 const writes:any[]=[];
 (prisma.groupSession as any).findUnique=async()=>({role:"OWNER"});
 (prisma as any).$transaction=async(fn:any)=>fn({
  groupSession:{findUnique:async()=>({role:"MEMBER"}),upsert:async(args:any)=>writes.push(args)},
  group:{updateMany:async(args:any)=>writes.push(args)},
  person:{updateMany:async(args:any)=>writes.push(args)},
  expense:{updateMany:async(args:any)=>writes.push(args)},
  expenseDraft:{updateMany:async(args:any)=>writes.push(args)},
 });
 try {
  await preserveDeviceAccess("g",["guest:device","user:old"]);
  assert.equal(writes[0].update.role,"OWNER");
  assert.equal(writes[1].data.ownerKey,"guest:device");
  assert.equal(writes[2].data.identityKey,"guest:device");
  assert.equal(writes[3].data.creatorKey,"guest:device");
  writes.length=0;
  (prisma.groupSession as any).findUnique=async()=>null;
  await preserveDeviceAccess("g",["guest:stranger","user:unknown"]);
  assert.equal(writes.length,0);
 } finally {(prisma.groupSession as any).findUnique=oldFind;(prisma as any).$transaction=oldTx;}
});
