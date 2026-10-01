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
type LegacySession = {token:string;user:{id:string}};
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
  async legacySession(): Promise<LegacySession | null> {
    if (Platform.OS === "web") return null;
    const raw = await SecureStore.getItemAsync("splitit.auth");
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },
};
