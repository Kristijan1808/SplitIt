import React,{useState} from 'react';
import {View,Share,Platform,Alert} from 'react-native';
import {Button,Card,Chip,Field,Txt,s,useUI} from './ui';
import {api} from './api';
import {cents,requestKey,exportCSV} from './domain.mjs';
import type {Group,Workflow,DraftExpense,SettlementResult} from './types';
import type {Run} from './GroupScreen';
export function ask(title:string,message:string,action:()=>void){
 if(Platform.OS==='web'){if(globalThis.confirm(`${title}\n${message}`))action();}
 else Alert.alert(title,message,[{text:'Odustani',style:'cancel'},{text:'Potvrdi',onPress:action}]);
}
export function IdentityPanel({group,workflow,choose}:{group:Group;workflow:Workflow;choose:(id:string)=>Promise<void>}){
 const {t,c}=useUI();
 return <Card style={{borderColor:c.info,backgroundColor:c.infoTint}}>
 <Txt bold size={20}>{t('Tko si ti?','Who are you?')}</Txt>
 <Txt size={13}>{t('Odaberi svoje ime. Profil se povezuje s tvojim računom ili ovim uređajem.','Select your name. It will be linked to your account or this device.')}</Txt>
 <View style={s.wrap}>{workflow.people.filter(p=>!p.inactive).map(p=><Chip key={p.id} label={`${p.name}${p.claimed&&!p.mine?' · povezano':''}`} selected={p.mine} disabled={p.claimed&&!p.mine} onPress={()=>void choose(p.id)}/>)}</View>
 <Txt muted size={12}>{t('Nema te na popisu? Dodaj svoje ime u Sudionicima pa ga odaberi.','Missing from the list? Add your name in People, then select it.')}</Txt>
 </Card>;
}
export function DraftResponses({draft,workflow,personId,run,refresh,slug}:{draft:DraftExpense;workflow:Workflow;personId?:string;run:Run;refresh:()=>Promise<void>;slug:string}){
 const {c,t}=useUI();const people=workflow.people.filter(p=>!p.inactive),responses=workflow.selections.filter(x=>x.draftId===draft.id);
 const done=people.filter(p=>responses.some(x=>x.personId===p.id&&x.status!=='PENDING'));
 const mine=responses.find(x=>x.personId===personId)?.status;
 const update=(status:string)=>void run(async()=>{await api.response(slug,draft.id,status);await refresh()});
 return <Card style={{backgroundColor:c.infoTint}}>
 <Txt bold>{done.length}/{people.length} {t('članova završilo','members finished')}</Txt>
 <View style={s.wrap}>{people.map(p=><Txt key={p.id} size={12}>{responses.some(x=>x.personId===p.id&&x.status!=='PENDING')?'✓':'○'} {p.name}</Txt>)}</View>
 {personId&&<>{mine&&mine!=='PENDING'?<Button secondary label={t('Ponovno otvori moj odabir','Reopen my selection')} onPress={()=>update('PENDING')}/>:<><Button label={t('Završio/la sam odabir','I finished selecting')} onPress={()=>update('DONE')}/><Button secondary label={t('Ne sudjelujem u ovom računu','I did not participate')} onPress={()=>update('SKIP')}/></>}
 <Txt muted size={12}>{t('Promjena tvoje kvačice ponovno otvara tvoj odabir. Autorova promjena podjele traži novu provjeru svih članova.','Changing your selection reopens it. Author allocation changes require everyone to review again.')}</Txt></>}
 </Card>;
}
export function TransferPanel({group,workflow,personId,run,refresh,settlements}:{group:Group;workflow:Workflow;personId?:string;run:Run;refresh:()=>Promise<void>;settlements:SettlementResult}){
 const {t,c}=useUI();const [open,setOpen]=useState(false),[to,setTo]=useState(''),[amount,setAmount]=useState(''),[note,setNote]=useState('');const [id,setId]=useState(requestKey);
 const name=(id:string)=>group.people.find(p=>p.id===id)?.name||'?';
 return <Card><Txt bold size={18}>{t('Podmirivanje dugova','Repayments')}</Txt>
 <Txt muted size={12}>{t('Ovo je zapis stvarne uplate, ne novi trošak. Aplikacija ne šalje novac.','This records a real repayment, not an expense. The app does not send money.')}</Txt>
 <Button secondary disabled={!personId||group.locked||workflow.archived} label={open?t('Zatvori unos','Close'):t('Evidentiraj moju uplatu','Record my repayment')} onPress={()=>setOpen(!open)}/>
 {open&&<><Txt bold>{t('Kome si uplatio/la?','Who did you pay?')}</Txt><View style={s.wrap}>{group.people.filter(p=>p.id!==personId).map(p=><Chip key={p.id} label={p.name} selected={to===p.id} onPress={()=>{setTo(p.id);const debt=settlements.settlements.find(x=>x.from===personId&&x.to===p.id);setAmount(debt?String(debt.amount):'')}}/>)}</View>
 <Field label={t('Uplaćeni iznos (€)','Amount paid (€)')} decimal value={amount} onChange={setAmount}/><Field label={t('Bilješka','Note')} value={note} onChange={setNote}/>
 <Button label={t('Spremi zapis uplate','Save repayment')} disabled={!to||!amount} onPress={()=>ask(t('Evidentirati uplatu?','Record repayment?'),`${name(personId!)} → ${name(to)} · ${amount} €`,()=>void run(async()=>{await api.transfer(group.slug,{requestId:id,fromId:personId,toId:to,amount:cents(amount)/100,note,occurredAt:new Date().toISOString()});setId(requestKey());setOpen(false);setAmount('');await refresh()}))}/></>}
 {workflow.transfers.slice(0,15).map(x=><View key={x.id} style={{gap:4,borderTopWidth:1,borderColor:c.line,paddingTop:8}}><Txt bold>{name(x.fromId)} → {name(x.toId)} · {Number(x.amount).toFixed(2)} €</Txt><Txt muted size={12}>{new Date(x.occurredAt).toLocaleDateString()} {x.voidedAt?'· Poništeno':''}</Txt>{!!x.note&&<Txt size={12}>{x.note}</Txt>}{x.canManage&&!x.voidedAt&&<Button secondary label={t('Poništi ovaj zapis','Void this record')} disabled={group.locked||workflow.archived} onPress={()=>ask('Poništi zapis','Saldo će se ponovno izračunati.',()=>void run(async()=>{await api.voidTransfer(group.slug,x.id);await refresh()}))}/>}</View>)}
 </Card>;
}
export function GroupUtilities({group,workflow,run,refresh}:{group:Group;workflow:Workflow;run:Run;refresh:()=>Promise<void>}){
 const {t}=useUI();const [trash,setTrash]=useState<{id:string;note:string;totalAmount:number}[]|null>(null),[password,setPassword]=useState('');
 return <Card><Txt size={18} bold>{t('Upravljanje i izvoz','Management and export')}</Txt>
 <Button secondary label={t('Podijeli CSV troškova','Share expense CSV')} onPress={()=>void run(async()=>{await Share.share({title:group.name+'.csv',message:exportCSV(group)})})}/>
 <Button secondary label={t('Moji obrisani računi','My deleted bills')} onPress={()=>void run(async()=>setTrash(await api.trash(group.slug)))}/>
 {trash?.map(e=><View key={e.id}><Txt>{e.note||'Račun'} · {Number(e.totalAmount).toFixed(2)} €</Txt><Button secondary label={t('Vrati račun','Restore bill')} disabled={group.locked||workflow.archived} onPress={()=>void run(async()=>{await api.restore(group.slug,e.id);setTrash(await api.trash(group.slug));await refresh()})}/></View>)}
 {trash?.length===0&&<Txt muted>{t('Nema obrisanih računa.','No deleted bills.')}</Txt>}
 {workflow.canAdmin&&<><Txt bold>{t('Pristup sudionika','Participant access')}</Txt>{workflow.people.filter(p=>p.claimed).map(p=><View key={p.id} style={{gap:6}}><Txt>{p.name} · {p.role||'MEMBER'}</Txt><Button secondary label={t('Oslobodi profil za drugi uređaj','Release profile for another device')} onPress={()=>ask('Osloboditi profil?',`Profil ${p.name} moći će ponovno odabrati član s pristupom grupi. Vlasništvo računa ostaje nepromijenjeno.`,()=>void run(async()=>{await api.release(group.slug,p.id);await refresh()}))}/>{workflow.canOwn&&p.role!=='OWNER'&&<Button secondary label={p.role==='ADMIN'?'Ukloni administratorsku ulogu':'Postavi administratora'} onPress={()=>ask('Promijeniti ulogu?',p.name,()=>void run(async()=>{await api.role(group.slug,p.id,p.role==='ADMIN'?'MEMBER':'ADMIN');await refresh()}))}/>}</View>)}<Txt bold>{t('Oznaka grupe','Group avatar')}</Txt><View style={s.wrap}>{['👥','🏠','🍽️','✈️','🎉','🏖️','🚗','💼'].map(avatar=><Chip key={avatar} label={avatar} selected={workflow.avatar===avatar} onPress={()=>void run(async()=>{await api.groupSettings(group.slug,{avatar});await refresh()})}/>)}</View>
 <Button secondary label={workflow.archived?t('Aktiviraj grupu','Unarchive group'):t('Arhiviraj grupu','Archive group')} onPress={()=>ask('Promjena statusa grupe','Arhivirana grupa ostaje čitljiva, ali se ne može mijenjati.',()=>void run(async()=>{await api.groupSettings(group.slug,{archived:!workflow.archived});await refresh()}))}/>
 <Field secure label={t('Nova lozinka pozivnice (najmanje 8 znakova)','New invitation password (at least 8 characters)')} value={password} onChange={setPassword}/><Button secondary disabled={password.length<8} label={t('Obnovi kod i lozinku pozivnice','Rotate invitation code and password')} onPress={()=>ask('Obnovi pozivnicu','Stare pozivnice više neće raditi. Postojeći članovi ostaju.',()=>void run(async()=>{await api.rotateInvite(group.slug,password);setPassword('');await refresh()}))}/></>}
 </Card>;
}

export function Comments({slug,expenseId,disabled,run}:{slug:string;expenseId:string;disabled:boolean;run:Run}){
 const {t}=useUI();const [rows,setRows]=useState<{id:string;message:string;createdAt:string}[]|null>(null),[message,setMessage]=useState('');
 return <Card><Button secondary label={rows?t('Sakrij raspravu','Hide discussion'):t('Rasprava o računu','Bill discussion')} onPress={()=>rows?setRows(null):void run(async()=>setRows(await api.comments(slug,expenseId)))}/>{rows&&<>{rows.map(x=><View key={x.id}><Txt>{x.message}</Txt><Txt muted size={11}>{new Date(x.createdAt).toLocaleString()}</Txt></View>)}{!rows.length&&<Txt muted>{t('Još nema poruka.','No messages yet.')}</Txt>}<Field label={t('Poruka uz račun','Message about this bill')} value={message} onChange={setMessage} maxLength={500}/><Button disabled={disabled||!message.trim()} label={t('Dodaj poruku','Add message')} onPress={()=>void run(async()=>{await api.comment(slug,expenseId,message);setMessage('');setRows(await api.comments(slug,expenseId))})}/></>}</Card>;
}
