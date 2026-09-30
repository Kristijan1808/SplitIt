// Durable write-ahead queue. All mutations are serialized, including sync acknowledgements.
export function createOutbox({read,write,send,now=Date.now}) {
 let tail=Promise.resolve(), syncing;
 const mutate=fn=>{const task=tail.then(async()=>{const rows=await read();const result=await fn(rows);await write(rows);return result;});tail=task.catch(()=>{});return task;};
 return {
  async list(scope){await tail;return (await read()).filter(x=>x.scope===scope);},
  enqueue(entry){return mutate(rows=>{if(!rows.some(x=>x.id===entry.id&&x.scope===entry.scope))rows.push({...entry,status:'pending',attempts:0,nextAttempt:0,createdAt:new Date(now()).toISOString()});});},
  retry(scope){return mutate(rows=>{for(const x of rows)if(x.scope===scope){x.status='pending';x.nextAttempt=0;}});},
  sync(scope,context){
   if(syncing)return syncing;
   syncing=(async()=>{
    const entries=await this.list(scope);let sent=0;
    for(const entry of entries){
     if(entry.status==='error'||entry.nextAttempt>now())continue;
     try {
      await send(entry,context);
      await mutate(rows=>{const i=rows.findIndex(x=>x.id===entry.id&&x.scope===scope);if(i>=0)rows.splice(i,1);});
      sent++;
     } catch(error){
      const status=error?.status;
      const retryable=!status||status>=500||[408,429].includes(status);
      await mutate(rows=>{const x=rows.find(x=>x.id===entry.id&&x.scope===scope);if(!x)return;x.attempts++;x.status=retryable?'pending':'error';x.error=error instanceof Error?error.message:String(error);x.nextAttempt=now()+Math.min(300000,15000*2**Math.min(x.attempts-1,5));});
      if(retryable)break;
     }
    }
    return sent;
   })().finally(()=>{syncing=undefined;});return syncing;
  }
 };
}
