import React,{useState,useEffect} from 'react';
import {View} from 'react-native';
import {Card,Txt,Button,useUI} from './ui';
import {outbox,outboxScope,syncOutbox,type QueuedExpense} from './outbox';
export function OutboxPanel({slug,refresh,offline=false}:{slug:string;refresh:()=>Promise<void>;offline?:boolean}){
 const {c,t}=useUI();const [rows,setRows]=useState<QueuedExpense[]>([]),[error,setError]=useState(''),[working,setWorking]=useState(false);
 useEffect(()=>{let active=true;const read=async()=>{try{const all=await outbox.list(await outboxScope());if(active)setRows(all.filter((x:QueuedExpense)=>x.slug===slug));}catch(e){if(active)setError(String(e));}};void read();const timer=setInterval(read,2000);return()=>{active=false;clearInterval(timer)};},[slug]);
 if(!rows.length&&!error&&!offline)return null;
 return <Card style={{borderColor:c.info,backgroundColor:c.infoTint}}>
  <Txt bold>{offline?t('Nema internetske veze','No internet connection'):t('Čeka sinkronizaciju','Waiting to sync')}{rows.length?` (${rows.length})`:''}</Txt>
  <Txt muted size={12}>{offline?t('Novi račun možeš unijeti ručno. Spremljeni računi poslat će se kada se vrati veza.','You can enter bills manually. Saved bills will upload when connected.'):t('Računi su lokalno spremljeni. U saldo ulaze nakon potvrde servera.','Bills are saved locally and affect balances after server confirmation.')}</Txt>
  {rows.map(x=><View key={x.id} style={{gap:3,paddingVertical:5}}><Txt bold size={14}>{x.body.note||t('Račun','Bill')} · {x.body.items.reduce((n:number,i:any)=>n+Number(i.price),0).toFixed(2)} {x.body.currency}</Txt><Txt size={12} style={{color:x.status==='error'?c.danger:c.muted}}>{x.status==='error'?x.error:t('Čeka sinkronizaciju','Waiting to sync')}</Txt>{x.body.currency!==x.baseCurrency&&<Txt muted size={11}>{t('Tečaj će se dohvatiti pri slanju.','Exchange rate will be fetched when uploading.')}</Txt>}</View>)}
  {!!error&&<Txt style={{color:c.danger}}>{error}</Txt>}
  <Button compact secondary disabled={working} label={working?t('Sinkroniziram…','Syncing…'):offline?t('Pokušaj ponovno','Retry'):t('Pokušaj slanje','Try uploading')} onPress={()=>{setWorking(true);setError('');void (async()=>{await outbox.retry(await outboxScope());await syncOutbox();await refresh();})().catch(e=>setError(e.message)).finally(()=>setWorking(false));}}/>
 </Card>;
}
