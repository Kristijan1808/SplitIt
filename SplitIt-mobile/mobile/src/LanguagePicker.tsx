import React, {useState} from 'react';
import {View,Pressable} from 'react-native';
import {useUI,Txt,Icon} from './ui';
export type LocaleCode='hr'|'en'|'de'|'ja';
export const localeOptions:{code:LocaleCode;label:string}[]=[
 {code:'hr',label:'Hrvatski'},{code:'en',label:'English'},{code:'de',label:'Deutsch'},{code:'ja',label:'日本語'}
];
// Dropdown with the same look as PalettePicker.
export function LanguagePicker({selected,onChange}:{selected:LocaleCode;onChange:(code:LocaleCode)=>void}) {
 const {c,busy,t}=useUI();
 const [expanded,setExpanded]=useState(false);
 const active=localeOptions.find(o=>o.code===selected)||localeOptions[0];
 return <View style={{gap:6}}>
  <Pressable accessibilityRole="button" accessibilityLabel={`${t('Jezik','Language')}: ${active.label}`}
   accessibilityState={{expanded,disabled:busy}} disabled={busy} onPress={()=>setExpanded(v=>!v)}
   style={({pressed})=>({minHeight:52,padding:12,borderRadius:12,borderWidth:1,borderColor:expanded?c.accent:c.line,
    backgroundColor:c.card,flexDirection:'row',alignItems:'center',gap:10,opacity:pressed?.75:1})}>
   <Txt style={{flex:1}}>{active.label}</Txt>
   <Txt size={18}>{expanded?'▴':'▾'}</Txt>
  </Pressable>
  {expanded&&<View style={{borderWidth:1,borderColor:c.line,borderRadius:12,overflow:'hidden',backgroundColor:c.card}}>
   {localeOptions.map(o=><Pressable key={o.code} accessibilityRole="button" accessibilityLabel={o.label}
    accessibilityState={{selected:selected===o.code,disabled:busy}} disabled={busy}
    onPress={()=>{setExpanded(false);onChange(o.code)}}
    style={({pressed})=>({minHeight:50,padding:12,backgroundColor:selected===o.code?c.tint:c.card,
     flexDirection:'row',alignItems:'center',gap:10,opacity:pressed?.75:1})}>
    <Txt style={{flex:1}} bold={selected===o.code}>{o.label}</Txt>
    {selected===o.code&&<Icon name="check" size={18} color={c.accent}/>}
   </Pressable>)}
  </View>}
 </View>;
}
