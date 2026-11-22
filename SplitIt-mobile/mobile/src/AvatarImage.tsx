import React from 'react';
import {Image} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

export const isImageAvatar=(value?:string|null):value is string=>!!value&&value.startsWith('data:image/');

export function AvatarImage({uri,size,radius}:{uri:string;size:number;radius?:number}){
 return <Image accessibilityIgnoresInvertColors source={{uri}} style={{width:size,height:size,borderRadius:radius??size/2}}/>;
}

// Lets the person crop a square from the gallery, then scales it down to a small JPEG data URL (API limit 70 000 chars).
export async function pickAvatarDataUrl():Promise<string|null>{
 const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsEditing:true,aspect:[1,1],quality:1});
 if(result.canceled)return null;
 const asset=result.assets[0];
 for(const compress of [0.8,0.6,0.45,0.3]){
  const out=await ImageManipulator.manipulateAsync(asset.uri,[{resize:{width:256,height:256}}],{compress,format:ImageManipulator.SaveFormat.JPEG,base64:true});
  if(!out.base64)continue;
  const url=`data:image/jpeg;base64,${out.base64}`;
  if(url.length<=68000)return url;
 }
 throw new Error('Image is too large / Slika je prevelika.');
}
