import type { Request } from "express";
import { getUserFromRequest, prisma } from "../core.js";
import { billKeys } from "./bill-permissions.js";
export type GroupAccess = {id:string;accessType:string;locked?:boolean;archived?:boolean};
export async function ensureCanViewGroup(group:GroupAccess,req:Request) {
 const user=getUserFromRequest(req);
 if(group.accessType === "REGISTERED_ONLY" && !user) return {allowed:false,user,status:401,error:"Prijavi se za pristup grupi."};
 const session=await prisma.groupSession.findFirst({where:{groupId:group.id,key:{in:billKeys(req)}}});
 return {allowed:!!session,user,status:session?200:403,error:session?null:"Ponovno se pridruži grupi kodom i lozinkom."};
}
export async function ensureCanEditGroup(group:GroupAccess,req:Request){
 const access=await ensureCanViewGroup(group,req);
 if(!access.allowed)return access;
 if(group.locked || group.archived)return {...access,allowed:false,status:423,error:"Grupa je zaključana ili arhivirana."};
 return access;
}
