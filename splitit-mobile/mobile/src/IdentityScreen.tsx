import React,{useState} from 'react';
import {View,Pressable} from 'react-native';
import {Button,Card,Field,Page,Txt,Icon,useUI,s} from './ui';
import {api} from './api';
import type {Group,Workflow} from './types';
import type {Run} from './GroupScreen';
export function IdentityScreen({group,workflow,run,done,leave}:{group:Group;workflow:Workflow;run:Run;done:(id:string)=>Promise<void>;leave:()=>void}){
 const {c,t,busy}=useUI();const [selected,setSelected]=useState(''),[adding,setAdding]=useState(false),[name,setName]=useState('');
 const people=workflow.people.filter(p=>!p.inactive);const blocked=group.locked||workflow.archived;
 const duplicate=people.some(p=>p.name.trim().toLocaleLowerCase()===name.trim().toLocaleLowerCase());
 const confirm=()=>void run(async()=>{
  let id=selected;
  if(adding){const result=await api.createIdentity(group.slug,name.trim());id=result.personId;}
  else await api.claim(group.slug,id);
  await done(id);
 });
 return <Page>
 <View style={{gap:8,paddingVertical:12}}><View style={{width:60,height:60,borderRadius:20,backgroundColor:c.tint,alignItems:'center',justifyContent:'center'}}><Icon name="user" color={c.accent} size={30}/></View><Txt bold size={30}>{t('Tko si ti?','Who are you?')}</Txt><Txt bold>{group.name}</Txt><Txt muted>{t('Odaberi svoje ime da vidiš svoj saldo i označiš svoje stavke. Ako te nema na popisu, dodaj se.','Choose your name to see your balance and select your items. Add yourself if you are not listed.')}</Txt></View>
 {blocked&&<Card><Txt>{t('Grupa je zaključana ili arhivirana. Administrator je treba otvoriti prije odabira imena.','The group is locked or archived. An administrator must reopen it before you can choose a name.')}</Txt></Card>}
 <Txt bold>{t('Postojeći sudionici','Existing participants')}</Txt>
 {!people.length&&<Txt muted>{t('Još nema sudionika. Upiši svoje ime ispod.','No participants yet. Enter your name below.')}</Txt>}
 {people.map(p=><Pressable key={p.id} accessibilityRole="radio" accessibilityLabel={`${p.name}${p.claimed&&!p.mine?t(' · ime je zauzeto',' · name is taken'):''}`} accessibilityState={{checked:!adding&&selected===p.id,disabled:busy||blocked||(p.claimed&&!p.mine)}} disabled={busy||blocked||(p.claimed&&!p.mine)} onPress={()=>{setSelected(p.id);setAdding(false)}} style={[s.row,{padding:14,minHeight:62,borderWidth:1,borderRadius:16,borderColor:!adding&&selected===p.id?c.accent:c.line,backgroundColor:!adding&&selected===p.id?c.tint:c.card,opacity:p.claimed&&!p.mine?.5:1}]}><Icon name="user" color={c.accent}/><View style={{flex:1}}><Txt bold>{p.name}</Txt>{p.claimed&&!p.mine&&<Txt muted size={12}>{t('Već povezano s drugim uređajem','Already linked to another device')}</Txt>}</View>{!adding&&selected===p.id&&<Icon name="check" color={c.accent}/>}</Pressable>)}
 <Button secondary icon="plus" disabled={blocked} label={t('Nema me na popisu · novo ime','Add me · new name')} onPress={()=>{setAdding(true);setSelected('')}}/>
 {adding&&<Card><Field label={t('Tvoje ime','Your name')} value={name} onChange={setName} maxLength={60}/>{duplicate&&<Txt style={{color:c.danger}}>{t('Ime već postoji. Odaberi ga s popisa ako je tvoje ili upiši drugo ime.','This name already exists. Select it if it is yours or enter another name.')}</Txt>}</Card>}
 <Button label={adding?t('Dodaj me i nastavi','Add me and continue'):t('Nastavi u grupu','Continue to group')} disabled={blocked||(adding?(!name.trim()||duplicate):!selected)} onPress={confirm}/>
 <Button secondary disabled={busy} label={t('Natrag na moje grupe','Back to my groups')} onPress={leave}/>
 </Page>;
}
