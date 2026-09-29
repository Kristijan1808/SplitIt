import {currencySchema} from "./currency.service.js";
import type {Request, RequestHandler} from "express";
import {Router} from "express";
import {Prisma} from "@prisma/client";
import {z} from "zod";
import {randomBytes} from "node:crypto";
import {prisma} from "../core.js";
import {billKeys,creatorKey,canManageBill} from "./bill-permissions.js";
import {ensureCanViewGroup,ensureCanEditGroup} from "./access.service.js";
export const failure=(message:string,status=400)=>Object.assign(new Error(message),{status});
export async function actorPerson(req:Request,groupId:string){
 const id=req.get("X-SplitIt-Participant-Id");
 const person=id?await prisma.person.findFirst({where:{id,groupId,inactive:false}}):null;
 if(!person || !person.identityKey || !billKeys(req).includes(person.identityKey))throw failure("Odaberi i poveži svoj profil u Sudionicima.",403);
 return person;
}
export const groupGate:RequestHandler=async(req,res,next)=>{try{
 const group=await prisma.group.findUnique({where:{slug:req.params.slug as string}});
 if(!group)throw failure("Grupa nije pronađena.",404);
 const access=await ensureCanViewGroup(group,req);if(!access.allowed)throw failure(access.error!,access.status);
 const sessions=await prisma.groupSession.findMany({where:{groupId:group.id,key:{in:billKeys(req)}}});
 res.locals.group=group;res.locals.admin=sessions.some(session=>["OWNER","ADMIN"].includes(session.role));
 res.locals.owner=!!group.ownerKey && billKeys(req).includes(group.ownerKey);
 next();
}catch(e){next(e)}};
export const adminGate:RequestHandler=(_req,res,next)=>res.locals.admin?next():next(failure("Ovu radnju može izvršiti administrator grupe.",403));
export const workflowRouter=Router({mergeParams:true});
const wrap=(fn:(req:Request,res:any)=>Promise<unknown>):RequestHandler=>async(req,res,next)=>{try{await fn(req,res)}catch(e){next(e)}};
async function editable(req:Request,group:any){const a=await ensureCanEditGroup(group,req);if(!a.allowed)throw failure(a.error!,a.status)}
const serial={isolationLevel:Prisma.TransactionIsolationLevel.Serializable};
workflowRouter.get("/",wrap(async(req,res)=>{
 const g=res.locals.group,keys=billKeys(req);
 const [people,selections,transfers,sessions]=await Promise.all([
 prisma.person.findMany({where:{groupId:g.id},orderBy:{createdAt:"asc"}}),
 prisma.draftSelection.findMany({where:{draft:{groupId:g.id,confirmedExpenseId:null}}}),
 prisma.settlementTransfer.findMany({where:{groupId:g.id},orderBy:{createdAt:"desc"}}),
 prisma.groupSession.findMany({where:{groupId:g.id}})]);
 res.json({avatar:g.avatar,archived:g.archived,canAdmin:res.locals.admin,canOwn:res.locals.owner,
 people:people.map(p=>({id:p.id,name:p.name,role:sessions.find(s=>s.key===p.identityKey)?.role||"MEMBER",inactive:p.inactive,claimed:!!p.identityKey,mine:!!p.identityKey&&keys.includes(p.identityKey)})),selections,
 transfers:transfers.map(p=>({...p,amount:Number(p.amount)}))});
}));
workflowRouter.post("/identity",wrap(async(req,res)=>{
 const g=res.locals.group;await editable(req,g);
 const {personId}=z.object({personId:z.string().min(1)}).strict().parse(req.body);const keys=billKeys(req),key=creatorKey(req);
 await prisma.$transaction(async tx=>{
 const p=await tx.person.findFirst({where:{id:personId,groupId:g.id,inactive:false}});
 if(!p)throw failure("Sudionik nije pronađen.",404);
 if(p.identityKey&&!keys.includes(p.identityKey))throw failure("Ovaj profil je već povezan s drugim računom ili uređajem.",409);
 const prior=await tx.person.findFirst({where:{groupId:g.id,identityKey:{in:keys},id:{not:personId}}});
 if(prior)throw failure("Već imaš povezan profil u ovoj grupi. Za ispravak se obrati administratoru.",409);
 await tx.person.update({where:{id:personId},data:{identityKey:key}});
 // An authenticated guest keeps ownership of bills on this device when upgrading identity.
 if(key.startsWith('user:')){
 const guests=keys.filter(k=>k.startsWith('guest:'));
 const previous=await tx.groupSession.findFirst({where:{groupId:g.id,key:{in:guests}},orderBy:{role:'desc'}});
 if(previous){await tx.groupSession.upsert({where:{groupId_key:{groupId:g.id,key}},create:{groupId:g.id,key,role:previous.role},update:{role:previous.role}});}
 if(g.ownerKey&&guests.includes(g.ownerKey))await tx.group.update({where:{id:g.id},data:{ownerKey:key}});
 await tx.expense.updateMany({where:{groupId:g.id,creatorKey:{in:guests}},data:{creatorKey:key}});
 await tx.expenseDraft.updateMany({where:{groupId:g.id,creatorKey:{in:guests}},data:{creatorKey:key}});
 }
 },serial);res.json({ok:true,personId});
}));
workflowRouter.patch("/people/:id",adminGate,wrap(async(req,res)=>{
 const {inactive}=z.object({inactive:z.boolean()}).strict().parse(req.body);
 const count=await prisma.person.updateMany({where:{id:req.params.id as string,groupId:res.locals.group.id},data:{inactive}});
 if(!count.count)throw failure("Sudionik nije pronađen.",404);
 await prisma.history.create({data:{groupId:res.locals.group.id,action:inactive?"ARCHIVE":"RESTORE",entity:"PERSON",entityId:req.params.id as string,message:inactive?"Sudionik je deaktiviran; prethodni računi ostaju.":"Sudionik je ponovno aktiviran."}});
 res.json({ok:true});
}));
workflowRouter.patch("/settings",adminGate,wrap(async(req,res)=>{
 const body=z.object({currency:currencySchema.optional(),archived:z.boolean().optional(),avatar:z.enum(["👥","🏠","🍽️","✈️","🎉","🏖️","🚗","💼"]).optional()}).strict().parse(req.body);
 await prisma.$transaction(async tx=>{
 const live=await tx.group.findUniqueOrThrow({where:{id:res.locals.group.id}});
 if(body.currency&&body.currency!==live.currency){
 const count=await tx.expense.count({where:{groupId:live.id}});const transfers=await tx.settlementTransfer.count({where:{groupId:live.id}});
 if(count||transfers)throw failure("Glavna valuta može se promijeniti prije prvog računa ili uplate. Postojeći iznosi ne smiju samo promijeniti oznaku.");
 }
 await tx.group.update({where:{id:live.id},data:body});
 },{isolationLevel:"Serializable"});
 await prisma.history.create({data:{groupId:res.locals.group.id,action:"UPDATE",entity:"GROUP",message:"Promijenjene su postavke grupe.",newValue:JSON.stringify(body)}});res.json({ok:true});
}));
workflowRouter.post("/rotate-invite",adminGate,wrap(async(req,res)=>{
 const password=z.string().min(8).max(80).parse(req.body.password);
 const bcrypt=await import('bcryptjs');const code=randomBytes(6).toString('hex').slice(0,6).toUpperCase();
 await prisma.group.update({where:{id:res.locals.group.id},data:{code,passwordHash:await bcrypt.default.hash(password,12)}});
 await prisma.history.create({data:{groupId:res.locals.group.id,action:"UPDATE",entity:"GROUP",message:"Promijenjeni su kod i lozinka pozivnice."}});res.json({code});
}));
workflowRouter.post("/drafts/:id/response",wrap(async(req,res)=>{
 const g=res.locals.group;await editable(req,g);const me=await actorPerson(req,g.id);
 const {status}=z.object({status:z.enum(["DONE","SKIP","PENDING"])}).strict().parse(req.body);
 await prisma.$transaction(async tx=>{
 const draft=await tx.expenseDraft.findFirst({where:{id:req.params.id as string,groupId:g.id,confirmedExpenseId:null},include:{items:{include:{shares:true}}}});
 if(!draft)throw failure("Račun u pripremi nije pronađen.",404);
 if(status==='SKIP'&&draft.items.some(i=>i.shares.some(s=>s.personId===me.id)))throw failure("Prvo ukloni svoje kvačice, zatim odaberi da ne sudjeluješ.");
 await tx.expenseDraft.update({where:{id:draft.id},data:{updatedAt:new Date()}});
 await tx.draftSelection.upsert({where:{draftId_personId:{draftId:draft.id,personId:me.id}},create:{draftId:draft.id,personId:me.id,status},update:{status}});
 },serial);res.json({ok:true});
}));
workflowRouter.delete("/drafts/:id",wrap(async(req,res)=>{
 await editable(req,res.locals.group);
 const d=await prisma.expenseDraft.findFirst({where:{id:req.params.id as string,groupId:res.locals.group.id,confirmedExpenseId:null}});
 if(!d)throw failure("Račun nije pronađen.",404);if(!canManageBill(d,req))throw failure("Samo autor može obrisati račun u pripremi.",403);
 await prisma.$transaction(async tx=>{await tx.expenseDraft.delete({where:{id:d.id,confirmedExpenseId:null}});await tx.history.create({data:{groupId:d.groupId,action:"DELETE",entity:"DRAFT",entityId:d.id,message:`Obrisan račun u pripremi: ${d.note||'Račun'}`}})});res.json({ok:true});
}));
workflowRouter.post("/transfers",wrap(async(req,res)=>{
 const g=res.locals.group;await editable(req,g);const me=await actorPerson(req,g.id);
 const b=z.object({requestId:z.string().uuid(),fromId:z.string(),toId:z.string(),amount:z.number().positive().max(1000000).refine(v=>Math.abs(v*100-Math.round(v*100))<1e-7),note:z.string().max(200).optional(),occurredAt:z.string().datetime()}).strict().parse(req.body);
 if(b.fromId===b.toId)throw failure("Odaberi dvije različite osobe.");
 if(![b.fromId,b.toId].includes(me.id))throw failure("Možeš evidentirati samo uplatu u kojoj sudjeluješ.",403);
 const people=await prisma.person.count({where:{id:{in:[b.fromId,b.toId]},groupId:g.id}});if(people!==2)throw failure("Obje osobe moraju pripadati grupi.");
 const key=creatorKey(req);const id=`${g.id}:${key}:${b.requestId}`;
 const previous=await prisma.settlementTransfer.findUnique({where:{requestId:id}});if(previous)return res.json(previous);
 const transfer=await prisma.$transaction(async tx=>{
 const row=await tx.settlementTransfer.create({data:{...b,requestId:id,groupId:g.id,creatorKey:key,occurredAt:new Date(b.occurredAt)}});
 await tx.history.create({data:{groupId:g.id,entity:"TRANSFER",entityId:row.id,action:"CREATE",message:`${me.name}: evidentirana uplata ${b.amount.toFixed(2)} €`,newValue:JSON.stringify({fromId:b.fromId,toId:b.toId,amount:b.amount})}});return row;
 });res.status(201).json({...transfer,amount:Number(transfer.amount)});
}));
workflowRouter.delete("/transfers/:id",wrap(async(req,res)=>{
 await editable(req,res.locals.group);const row=await prisma.settlementTransfer.findFirst({where:{id:req.params.id as string,groupId:res.locals.group.id}});
 if(!row)throw failure("Uplata nije pronađena.",404);if(!canManageBill(row,req))throw failure("Samo autor može poništiti ovaj zapis.",403);
 if(row.voidedAt)return res.json({ok:true});
 await prisma.$transaction(async tx=>{await tx.settlementTransfer.update({where:{id:row.id},data:{voidedAt:new Date()}});await tx.history.create({data:{groupId:row.groupId,entity:"TRANSFER",entityId:row.id,action:"VOID",message:"Poništen je zapis uplate.",oldValue:JSON.stringify({amount:Number(row.amount)})}})});res.json({ok:true});
}));
workflowRouter.post("/people/:id/release",adminGate,wrap(async(req,res)=>{
 const p=await prisma.person.findFirst({where:{id:req.params.id as string,groupId:res.locals.group.id}});
 if(!p)throw failure("Sudionik nije pronađen.",404);
 // Releasing a profile never transfers ownership of its historical bills.
 await prisma.$transaction(async tx=>{await tx.person.update({where:{id:p.id},data:{identityKey:null}});await tx.history.create({data:{groupId:p.groupId,entity:"PERSON",entityId:p.id,action:"UPDATE",message:`Administrator je oslobodio profil ${p.name} za novo povezivanje.`}})});res.json({ok:true});
}));
workflowRouter.patch("/people/:id/role",wrap(async(req,res)=>{
 if(!res.locals.owner)throw failure("Samo vlasnik može mijenjati administratore.",403);
 const {role}=z.object({role:z.enum(["ADMIN","MEMBER"])}).strict().parse(req.body);
 const p=await prisma.person.findFirst({where:{id:req.params.id as string,groupId:res.locals.group.id}});
 if(!p?.identityKey)throw failure("Osoba najprije treba povezati svoj profil.");
 if(p.identityKey===res.locals.group.ownerKey)throw failure("Uloga vlasnika ne može se promijeniti ovdje.");
 await prisma.$transaction(async tx=>{await tx.groupSession.updateMany({where:{groupId:p.groupId,key:p.identityKey!},data:{role}});await tx.history.create({data:{groupId:p.groupId,entity:"PERSON",entityId:p.id,action:"UPDATE",message:`${p.name}: uloga ${role}`}})});res.json({ok:true});
}));
