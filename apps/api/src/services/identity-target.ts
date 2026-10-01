import {z} from 'zod';
const input=z.union([z.object({personId:z.string().min(1)}).strict(),z.object({name:z.string().trim().min(1).max(60)}).strict()]);
const failure=(message:string)=>Object.assign(new Error(message),{status:409});
export async function identityTarget(tx:any,groupId:string,body:unknown,keys:string[]){
 const value=input.parse(body);
 if('personId' in value)return value.personId;
 const mine=await tx.person.findFirst({where:{groupId,identityKey:{in:keys}}});
 if(mine){if(!mine.inactive&&mine.name.toLocaleLowerCase()===value.name.toLocaleLowerCase())return mine.id;throw failure('Već imaš povezan ime sudionika u ovoj grupi.');}
 const existing=await tx.person.findFirst({where:{groupId,name:{equals:value.name,mode:'insensitive'}}});
 if(existing)throw failure('Ovo ime već postoji. Odaberi ga s popisa ako je tvoje ili upiši drugo ime.');
 const person=await tx.person.create({data:{groupId,name:value.name}});
 await tx.history.create({data:{groupId,entity:'PERSON',entityId:person.id,action:'CREATE',message:`${value.name} pridružio/la se grupi.`}});
 return person.id;
}
