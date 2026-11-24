import { prisma } from "../core.js";
// Account-only groups resolve identity from the signed-in user's membership, never the device.
export function participantIdentity(p:{userId:string|null;identityKey:string|null},access:string,userId:string|undefined,keys:string[]){
 const byAccount=!!p.userId && p.userId===userId;
 return {claimed:!!p.userId||!!p.identityKey,mine:byAccount||(access!=="REGISTERED_ONLY"&&!p.userId&&!!p.identityKey&&keys.includes(p.identityKey))};
}

/** Profilne slike računa povezanih sa sudionicima (sudionici bez računa nemaju sliku). */
export async function accountAvatars(people:{userId:string|null}[]):Promise<Map<string,string>>{
 const ids=[...new Set(people.map(p=>p.userId).filter((id):id is string=>!!id))];
 if(!ids.length)return new Map();
 const users=await prisma.user.findMany({where:{id:{in:ids}},select:{id:true,avatarImage:true}});
 return new Map(users.filter(u=>u.avatarImage).map(u=>[u.id,u.avatarImage as string]));
}
