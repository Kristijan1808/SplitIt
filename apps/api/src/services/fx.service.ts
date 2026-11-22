import {z} from 'zod';
import type {RequestHandler} from 'express';
import {prisma} from '../core.js';
import {codeSchema,latestRate,listCurrencies} from './fx-provider.js';
export const currencies:RequestHandler=async(_req,res,next)=>{try{res.json(await listCurrencies())}catch(e){next(e)}};
export const createQuote:RequestHandler=async(req,res,next)=>{
 try{
 const base=codeSchema.parse(req.body.currency);const group=res.locals.group;const quote=group.currency||'EUR';
 if(base===quote){res.json({id:null,base,quote,rate:1,rateDate:null,source:null,expiresAt:null});return;}
 const rate=await latestRate(base,quote);
 const record=await prisma.fxQuote.create({data:{...rate,groupId:group.id,expiresAt:new Date(Date.now()+15*60000)}});
 // Quotes are snapshots; removing expired unused records cannot change stored expense rates.
 void prisma.fxQuote.deleteMany({where:{expiresAt:{lt:new Date(Date.now()-86400000)}}}).catch(()=>{});
 res.json({...record,rate:Number(record.rate)});
 }catch(e){next(e)}
};
export async function resolveQuote(tx:any,input:any,group:{id:string;currency?:string}){
 const currency=codeSchema.parse(input.currency??group.currency??'EUR');const base=group.currency||'EUR';
 if(currency===base)return {...input,currency,exchangeRate:1,rateDate:null,rateSource:null};
 const id=z.string().uuid().safeParse(input.quoteId);
 if(!id.success)throw Object.assign(new Error('Osvježi automatski tečaj prije spremanja računa.'),{status:409});
 const quote=await tx.fxQuote.findUnique({where:{id:id.data}});
 if(!quote||quote.groupId!==group.id||quote.base!==currency||quote.quote!==base||quote.expiresAt.getTime()<=Date.now())throw Object.assign(new Error('Tečaj je istekao ili ne odgovara računu. Osvježi tečaj.'),{status:409});
 return {...input,currency,exchangeRate:Number(quote.rate),rateDate:quote.rateDate,rateSource:quote.source};
}
