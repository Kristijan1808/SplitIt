import type {RequestHandler} from 'express';
const attempts=new Map<string,{count:number;until:number}>();
export const joinLimit:RequestHandler=(req,res,next)=>{
 const now=Date.now();for(const [k,v] of attempts)if(v.until<now)attempts.delete(k);
 const key=req.ip||req.socket.remoteAddress||'unknown';const a=attempts.get(key)||{count:0,until:now+60000};
 if(a.count>=15){res.setHeader('Retry-After','60');res.status(429).json({error:'Previše pokušaja. Pokušaj ponovno za minutu.'});return;}
 if(attempts.size>=10000&&!attempts.has(key)){res.status(429).json({error:'Pokušaj ponovno kasnije.'});return;}
 a.count++;attempts.set(key,a);next();
};
