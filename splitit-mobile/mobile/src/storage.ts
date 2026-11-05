import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import type { Group } from "./types";
export type SavedGroup = Pick<Group, "slug" | "name" | "code"> & {
  participantId?: string;
  participantName?: string;
  pinned?: boolean;
  archived?: boolean;
  balance?: number;
  currency?:string;
  draftCount?: number;
  avatar?: string;
  memberCount?: number;
};
// Only read old credentials to preserve existing group ownership and queued bills.
export type Session = {token:string;user:{id:string;username?:string}};
type LegacySession = Session;
export const storage = {
  async readStrict<T>(key:string,fallback:T):Promise<T> {const raw=await AsyncStorage.getItem(`splitit.${key}`);return raw===null?fallback:JSON.parse(raw);},
  async guestToken(): Promise<string | null> {
    return Platform.OS === "web"
      ? AsyncStorage.getItem("splitit.guest-token")
      : SecureStore.getItemAsync("splitit.guest-token");
  },
  async setGuestToken(value: string) {
    if (Platform.OS === "web")
      await AsyncStorage.setItem("splitit.guest-token", value);
    else await SecureStore.setItemAsync("splitit.guest-token", value);
  },
  async read<T>(key: string, fallback: T): Promise<T> {
    const raw = await AsyncStorage.getItem(`splitit.${key}`);
    if (!raw&&Platform.OS==="web"&&key==="groups"){try{return JSON.parse(await AsyncStorage.getItem("splitit:groups")||"[]")}catch{return fallback}}
    if (!raw&&Platform.OS==="web"&&key==="prefs")return {locale:await AsyncStorage.getItem("splitit:locale")||"hr",dark:await AsyncStorage.getItem("splitit:theme")==="dark"} as T;
    if (!raw) return fallback;
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  async write(key: string, value: unknown) {
    await AsyncStorage.setItem(`splitit.${key}`, JSON.stringify(value));
  },
  async setSession(s:Session|null){
    if(Platform.OS==="web"){
      if(s){await AsyncStorage.setItem("splitit:token",s.token);await AsyncStorage.setItem("splitit:user",JSON.stringify(s.user))}
      else{await AsyncStorage.removeItem("splitit:token");await AsyncStorage.removeItem("splitit:user")}
    }else if(s)await SecureStore.setItemAsync("splitit.auth",JSON.stringify(s));else await SecureStore.deleteItemAsync("splitit.auth");
  },
  async legacySession(): Promise<LegacySession | null> {
    if(Platform.OS==="web"){try{const token=await AsyncStorage.getItem("splitit:token"),user=JSON.parse(await AsyncStorage.getItem("splitit:user")||"null");return token&&user?.id?{token,user}:null}catch{return null}}
    const raw = await SecureStore.getItemAsync("splitit.auth");
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },
};
