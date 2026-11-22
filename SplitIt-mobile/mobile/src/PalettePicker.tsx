import React, {useState} from 'react';
import {View,Pressable,ScrollView} from 'react-native';
import {palettes,getPalette,type PaletteId} from './palettes';
import {useUI,Txt,Icon} from './ui';
export function PalettePicker({selected,onChange}:{selected:PaletteId;onChange:(id:PaletteId)=>void}) {
 const {c,busy,t}=useUI();
 const [expanded,setExpanded]=useState(false);
 const active=getPalette(selected);
 const swatches=(colors:readonly string[])=><View style={{flexDirection:'row',borderRadius:6,overflow:'hidden'}}>{colors.map(color=><View key={color} style={{backgroundColor:color,width:16,height:24}}/>)}</View>;
 return <View style={{gap:6}}>
  <Pressable accessibilityRole="button" accessibilityLabel={`${t('Tema','Theme')}: ${active.name}`}
   accessibilityState={{expanded,disabled:busy}} disabled={busy} onPress={()=>setExpanded(value=>!value)}
   style={({pressed})=>({minHeight:52,padding:12,borderRadius:12,borderWidth:1,borderColor:expanded?c.accent:c.line,
    backgroundColor:c.card,flexDirection:'row',alignItems:'center',gap:10,opacity:pressed?.75:1})}>
   {swatches(active.swatches)}<Txt style={{flex:1}}>{active.name}</Txt>
   <Txt size={18}>{expanded?'▴':'▾'}</Txt>
  </Pressable>
  {expanded&&<View style={{borderWidth:1,borderColor:c.line,borderRadius:12,overflow:'hidden',backgroundColor:c.card}}>
   <ScrollView nestedScrollEnabled style={{maxHeight:280}} keyboardShouldPersistTaps="handled">
    {palettes.map(p=><Pressable key={p.id} accessibilityRole="button" accessibilityLabel={p.name}
     accessibilityState={{selected:selected===p.id,disabled:busy}} disabled={busy}
     onPress={()=>{setExpanded(false);onChange(p.id)}}
     style={({pressed})=>({minHeight:50,padding:12,backgroundColor:selected===p.id?c.tint:c.card,
      flexDirection:'row',alignItems:'center',gap:10,opacity:pressed?.75:1})}>
     {swatches(p.swatches)}<Txt style={{flex:1}} bold={selected===p.id}>{p.name}</Txt>
     {selected===p.id&&<Icon name="check" size={18} color={c.accent}/>}
    </Pressable>)}
   </ScrollView>
  </View>}
 </View>;
}
