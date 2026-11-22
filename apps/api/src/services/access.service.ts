import { preserveDeviceAccess } from "./device-access.js";
import type { Request } from "express";
import { getUserFromRequest, prisma } from "../core.js";
import { billKeys } from "./bill-permissions.js";
export type GroupAccess = {id:string;accessType:string;ownerUserId?:string|null;locked?:boolean;archived?:boolean};
export async function ensureCanViewGroup(group:GroupAccess,req:Request) {
 await preserveDeviceAccess(group.id,billKeys(req));
 const session=await prisma.groupSession.findFirst({where:{groupId:group.id,key:{in:billKeys(req)}}});
 const user=getUserFromRequest(req);
 const member=user?await prisma.groupMember.findUnique({where:{groupId_userId:{groupId:group.id,userId:user.id}}}):null;
 const registered=!!member||(!!user&&group.ownerUserId===user.id);
 // "Samo anonimni": ulaz je kodom i lozinkom bez računa. Uređaj koji je već u grupi (sesija uređaja)
 // zadržava pristup i nakon prijave; prijavljeni bez te sesije i dalje ne mogu ući.
 const allowed=group.accessType==="REGISTERED_ONLY"?registered:group.accessType==="ANONYMOUS_ONLY"?!!session||(!!user&&group.ownerUserId===user.id):registered||!!session;
 return {allowed,status:allowed?200:403,error:allowed?null:group.accessType==="REGISTERED_ONLY"?"Sign in and join this group to access it.":"Ponovno se pridruži grupi kodom i lozinkom."};
}
export async function ensureCanEditGroup(group:GroupAccess,req:Request){
 const access=await ensureCanViewGroup(group,req);
 if(!access.allowed)return access;
 if(group.locked || group.archived)return {...access,allowed:false,status:423,error:"Grupa je zaključana ili arhivirana."};
 return access;
}
