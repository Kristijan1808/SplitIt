import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import type { AuthResponse, Group } from "./types";
export type SavedGroup = Pick<Group, "slug" | "name" | "code"> & {
  participantId?: string;
  participantName?: string;
};
// Browser preview keeps auth in memory; native tokens always use SecureStore.
let previewAuth: AuthResponse | null = null;
export const storage = {
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
  async auth(): Promise<AuthResponse | null> {
    if (Platform.OS === "web") return previewAuth;
    const raw = await SecureStore.getItemAsync("splitit.auth");
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },
  async setAuth(auth: AuthResponse | null) {
    if (Platform.OS === "web") {
      previewAuth = auth;
      return;
    }
    if (auth)
      await SecureStore.setItemAsync("splitit.auth", JSON.stringify(auth));
    else await SecureStore.deleteItemAsync("splitit.auth");
  },
};
