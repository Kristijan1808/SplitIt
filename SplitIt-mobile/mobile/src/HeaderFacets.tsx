import React from 'react';
import {View,StyleSheet} from 'react-native';
import Svg,{Path} from 'react-native-svg';

// Decorative only; neutral translucent triangles pick up the current theme.
const faces = [
  ["M0 0 L98 0 L0 77 Z","#000",0.18],
  ["M98 0 L110 71 L0 77 Z","#000",0.18],
  ["M98 0 L231 0 L216 65 Z","#fff",0.025],
  ["M98 0 L216 65 L110 71 Z","#000",0.26],
  ["M231 0 L287 0 L216 65 Z","#000",0.18],
  ["M287 0 L318 48 L216 65 Z","#000",0.1],
  ["M287 0 L398 0 L381 49 Z","#000",0.26],
  ["M287 0 L381 49 L318 48 Z","#fff",0.1],
  ["M398 0 L496 0 L381 49 Z","#000",0.18],
  ["M496 0 L500 50 L381 49 Z","#fff",0.025],
  ["M496 0 L599 0 L628 59 Z","#fff",0.1],
  ["M496 0 L628 59 L500 50 Z","#fff",0.1],
  ["M599 0 L717 0 L628 59 Z","#000",0.1],
  ["M717 0 L711 67 L628 59 Z","#fff",0.05],
  ["M717 0 L800 0 L800 71 Z","#000",0.18],
  ["M717 0 L800 71 L711 67 Z","#fff",0.1],
  ["M0 77 L110 71 L124 130 Z","#000",0.26],
  ["M0 77 L124 130 L0 130 Z","#000",0.1],
  ["M110 71 L216 65 L124 130 Z","#000",0.26],
  ["M216 65 L191 130 L124 130 Z","#fff",0.05],
  ["M216 65 L318 48 L270 130 Z","#fff",0.1],
  ["M216 65 L270 130 L191 130 Z","#fff",0.1],
  ["M318 48 L381 49 L270 130 Z","#000",0.18],
  ["M381 49 L423 130 L270 130 Z","#000",0.26],
  ["M381 49 L500 50 L488 130 Z","#fff",0.1],
  ["M381 49 L488 130 L423 130 Z","#fff",0.025],
  ["M500 50 L628 59 L488 130 Z","#000",0.18],
  ["M628 59 L627 130 L488 130 Z","#fff",0.1],
  ["M628 59 L711 67 L668 130 Z","#000",0.26],
  ["M628 59 L668 130 L627 130 Z","#000",0.18],
  ["M711 67 L800 71 L668 130 Z","#fff",0.1],
  ["M800 71 L800 130 L668 130 Z","#000",0.26],
] as const;
export function HeaderFacets(){return <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
 <Svg width="100%" height="100%" viewBox="0 0 800 130" preserveAspectRatio="none">
  {faces.map(([d,fill,opacity],i)=><Path key={i} d={d} fill={fill} opacity={opacity}/>)}
 </Svg></View>}
export function FacetPlate({fill,tab=false}:{fill:string;tab?:boolean}) {
 return <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
 <Svg width="100%" height="100%" viewBox="0 0 100 44" preserveAspectRatio="none">
 <Path d={tab?'M0 0H87L100 44H0Z':'M16 0H100L84 44H0Z'} fill={fill}/>
 </Svg></View>
}
