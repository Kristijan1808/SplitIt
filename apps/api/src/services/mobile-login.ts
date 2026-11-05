import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
type User={id:string;username:string};
type Ticket={expires:number;approval:Buffer;pickup:Buffer;user?:User};
const hash=(value:string)=>createHash('sha256').update(value).digest();
const random=()=>randomBytes(32).toString('base64url');
export class LoginTickets{
 private tickets=new Map<string,Ticket>();
 constructor(private now=Date.now){}
 start(){
  for(const [id,t] of this.tickets)if(t.expires<=this.now())this.tickets.delete(id);
  if(this.tickets.size>=500)throw Object.assign(new Error('Pokušaj ponovno kasnije.'),{status:429});
  const id=random(),approval=random(),pickup=random();
  this.tickets.set(id,{expires:this.now()+300000,approval:hash(approval),pickup:hash(pickup)});return {id,approval,pickup};
 }
 private get(id:string,secret:string,key:'approval'|'pickup'){
  const t=this.tickets.get(id);if(!t||t.expires<=this.now()){this.tickets.delete(id);throw Object.assign(new Error('Prijava je istekla.'),{status:410})}
  if(typeof secret!=='string'||secret.length!==43||!timingSafeEqual(hash(secret),t[key]))throw Object.assign(new Error('Neispravan zahtjev.'),{status:403});
  return t;
 }
 approve(id:string,secret:string,user:User){const t=this.get(id,secret,'approval');if(t.user)throw Object.assign(new Error('Prijava je već potvrđena.'),{status:409});t.user=user;}
 take(id:string,secret:string){const t=this.get(id,secret,'pickup');if(!t.user)return null;this.tickets.delete(id);return t.user;}
}
