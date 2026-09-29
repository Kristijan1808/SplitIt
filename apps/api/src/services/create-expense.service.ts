import {prepareCurrencyExpense} from "./currency.service.js";
import type {RequestHandler} from "express";
import {Prisma} from "@prisma/client";
import {z} from "zod";
import {prisma} from "../core.js";
import {creatorKey} from "./bill-permissions.js";
import {expenseActor,auditValue} from "./expense-audit.js";
import {prepareExpenseEdit,ExpenseInputError} from "./expense-edit.validation.js";
import {expenseDetailsInclude,serializeExpense} from "../utils.js";
import {ensureCanEditGroup} from "./access.service.js";
export const createExpense:RequestHandler=async(req,res,next)=>{
 let requestId:string|undefined;
 try {
  const group=res.locals.group;const access=await ensureCanEditGroup(group,req);
  if(!access.allowed){res.status(access.status).json({error:access.error});return;}
  const uuid=z.string().uuid().parse(req.body.requestId);const owner=creatorKey(req);
  requestId=`${group.id}:${owner}:${uuid}`;
  const prior=await prisma.expense.findUnique({where:{requestId},include:expenseDetailsInclude});
  if(prior){res.json(serializeExpense(prior));return;}
  const actor=await expenseActor(req,group.id);
  const expense=await prisma.$transaction(async tx=>{
   const live=await tx.group.findUniqueOrThrow({where:{id:group.id}});
   if(live.locked||live.archived)throw Object.assign(new Error("Grupa je zaključana ili arhivirana."),{status:423});
   const people=await tx.person.findMany({where:{groupId:group.id,inactive:false},select:{id:true}});
   const prepared=prepareCurrencyExpense({...req.body,expectedUpdatedAt:new Date().toISOString()},people.map(p=>p.id),live.currency||"EUR");
   const e=await tx.expense.create({data:{groupId:group.id,currency:prepared.currency,exchangeRate:prepared.exchangeRate,originalTotal:prepared.originalTotal,creatorKey:owner,requestId,note:prepared.body.note||null,totalAmount:prepared.totalAmount,
    billDate:prepared.body.billDate?new Date(prepared.body.billDate):new Date(),category:prepared.body.category||"other",
    payers:{create:prepared.body.payers},items:{create:prepared.items.map(i=>({...i,shares:{create:i.shares}}))},shares:{create:prepared.shares}},include:expenseDetailsInclude});
   await tx.history.create({data:{groupId:group.id,entity:"EXPENSE",entityId:e.id,action:"CREATE",message:`${actor.name}: ${e.note||"Račun"} · ${prepared.totalAmount.toFixed(2)} ${live.currency||"EUR"}`,newValue:auditValue(actor,e)}});return e;
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  res.status(201).json(serializeExpense(expense));
 }catch(error){
  if(error instanceof ExpenseInputError){res.status(400).json({error:error.message});return;}
  if(requestId&&error instanceof Prisma.PrismaClientKnownRequestError&&error.code==="P2002"){
   try{const e=await prisma.expense.findUnique({where:{requestId},include:expenseDetailsInclude});if(e){res.json(serializeExpense(e));return;}}catch{}
  }
  next(error);
 }
};
