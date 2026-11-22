import React from 'react';
import {View} from 'react-native';
import Svg,{Path,Circle,G} from 'react-native-svg';
import {Txt,useUI} from './ui';
export function FullHomeBanner(){const {t,c}=useUI();return <View style={{minHeight:152,backgroundColor:c.hero,overflow:'hidden',borderRadius:28,marginHorizontal:12,marginTop:12,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:22,gap:10}}><Txt bold size={31} style={{flex:1,color:'#fff',lineHeight:35,letterSpacing:-1}}>{t("Dobra ekipa\ndijeli fer.","Good company\nshares fairly.")}</Txt><Svg accessible={false} width={80} height={64} viewBox="0 0 84 64"><G fill="white" opacity={.74}><Circle cx={16} cy={22} r={7}/><Circle cx={68} cy={22} r={7}/><Path d="M2 50l6-17 8-4 9 4 7 17zm50 0 7-17 9-4 8 4 6 17z"/></G><G fill="white"><Circle cx={42} cy={15} r={9}/><Path d="M22 57l9-26 11-6 12 6 9 26z"/></G></Svg></View>}
import {ScrollView} from 'react-native';
export function HomeSurface({children}:React.PropsWithChildren){return <ScrollView keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="never"><FullHomeBanner/><View style={{width:'100%',maxWidth:680,alignSelf:'center',padding:12,gap:12}}>{children}</View></ScrollView>}
