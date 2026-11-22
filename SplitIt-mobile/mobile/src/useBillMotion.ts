import {useEffect,useState} from 'react';
import {AccessibilityInfo,LayoutAnimation,Platform,UIManager} from 'react-native';
export function useBillMotion(){
 const [reduce,setReduce]=useState(true);
 useEffect(()=>{let live=true,changed=false;const sub=AccessibilityInfo.addEventListener('reduceMotionChanged',v=>{changed=true;setReduce(v)});AccessibilityInfo.isReduceMotionEnabled().then(v=>{if(live&&!changed)setReduce(v)}).catch(()=>{});if(Platform.OS==='android')UIManager.setLayoutAnimationEnabledExperimental?.(true);return()=>{live=false;sub.remove()}},[]);
 return {reduce,toggle:(fn:()=>void)=>{if(!reduce&&Platform.OS!=='web')LayoutAnimation.configureNext({duration:200,update:{type:'easeInEaseOut'},create:{type:'easeInEaseOut',property:'opacity'},delete:{type:'easeInEaseOut',property:'opacity'}});fn()}}
}
