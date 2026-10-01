import { preserveDeviceAccess } from "./device-access.js";
import type { Request } from "express";
import { prisma } from "../core.js";
import { billKeys } from "./bill-permissions.js";
export type GroupAccess = {id:string;accessType:string;locked?:boolean;archived?:boolean};
export async function ensureCanViewGroup(group:GroupAccess,req:Request) {


 await preserveDeviceAccess(group.id,billKeys(req));
 const session=await prisma.groupSession.findFirst({where:{groupId:group.id,key:{in:billKeys(req)}}});
 return {allowed:!!session,status:session?200:403,error:session?null:"Ponovno se pridruži grupi kodom i lozinkom."};
}
export async function ensureCanEditGroup(group:GroupAccess,req:Request){
 const access=await ensureCanViewGroup(group,req);
 if(!access.allowed)return access;
 if(group.locked || group.archived)return {...access,allowed:false,status:423,error:"Grupa je zaključana ili arhivirana."};
 return access;
}
