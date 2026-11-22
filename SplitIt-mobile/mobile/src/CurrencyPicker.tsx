import React,{useEffect,useState} from 'react';
import {Modal,View,FlatList,Pressable} from 'react-native';
import {api,type CurrencyOption} from './api';
import {Button,Field,Txt,useUI} from './ui';
export function CurrencyPicker({visible,selected,onSelect,onClose}:{visible:boolean;selected:string;onSelect:(code:string)=>void;onClose:()=>void}){
 const {t,c,busy}=useUI();const [rows,setRows]=useState<CurrencyOption[]>([]),[search,setSearch]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{if(!visible)return;let alive=true;setLoading(true);setError('');setSearch('');api.currencies().then(x=>{if(alive)setRows(x)}).catch(e=>{if(alive)setError(e.message)}).finally(()=>{if(alive)setLoading(false)});return()=>{alive=false}},[visible,retry]);
 const query=search.trim().toLowerCase();
 return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><View style={{flex:1,backgroundColor:'#00000066',justifyContent:'center',padding:16}}><View accessibilityViewIsModal style={{backgroundColor:c.card,borderRadius:24,padding:16,width:'100%',maxWidth:520,height:'80%',alignSelf:'center',gap:12}}>
 <Txt bold size={22}>{t('Odaberi valutu','Choose currency')}</Txt><Field label={t('Pretraži naziv ili oznaku','Search name or code')} value={search} onChange={setSearch}/>
 {loading?<Txt muted>{t('Učitavanje valuta…','Loading currencies…')}</Txt>:error?<><Txt style={{color:c.danger}}>{error}</Txt><Button label={t('Pokušaj ponovno','Retry')} onPress={()=>setRetry(n=>n+1)}/></>:<FlatList data={rows.filter(x=>`${x.code} ${x.name}`.toLowerCase().includes(query))} keyExtractor={x=>x.code} keyboardShouldPersistTaps="handled" ListEmptyComponent={<Txt muted>{t('Nema rezultata.','No results.')}</Txt>} renderItem={({item})=><Pressable disabled={busy} accessibilityRole="button" accessibilityState={{selected:selected===item.code}} onPress={()=>onSelect(item.code)} style={{padding:12,minHeight:56,borderRadius:12,backgroundColor:selected===item.code?c.tint:undefined}}><Txt bold>{item.code}{selected===item.code?' ✓':''}</Txt><Txt muted size={13}>{item.name}</Txt></Pressable>}/>}
 <Button secondary label={t('Zatvori','Close')} onPress={onClose}/></View></View></Modal>
}
