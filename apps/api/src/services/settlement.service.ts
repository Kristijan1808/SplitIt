import type {RequestHandler} from 'express';
import {prisma} from '../core.js';
import {ensureCanViewGroup} from './access.service.js';
import {calculateBalances} from './balance-domain.js';
export class SettlementService {
 settlements:RequestHandler=async(req,res,next)=>{try{
 const group=await prisma.group.findUnique({where:{slug:req.params.slug as string}});if(!group){res.status(404).json({error:'Group not found'});return}
 const access=await ensureCanViewGroup(group,req);if(!access.allowed){res.status(access.status).json({error:access.error});return}
 const [people,expenses,transfers]=await Promise.all([prisma.person.findMany({where:{groupId:group.id},select:{id:true,name:true},orderBy:{createdAt:'asc'}}),prisma.expense.findMany({where:{groupId:group.id,deletedAt:null},include:{payers:true,shares:true,items:{include:{shares:true}}}}),prisma.settlementTransfer.findMany({where:{groupId:group.id,voidedAt:null}})]);
 res.json(calculateBalances(people,expenses,transfers));
 }catch(e){next(e)}};
}
export const settlementService=new SettlementService();
