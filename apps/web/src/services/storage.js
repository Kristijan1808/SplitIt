import { Platform } from "react-native-web";
const AsyncStorage = window.localStorage;
export const storage = {
    async readStrict(key, fallback) { const raw = await AsyncStorage.getItem(`splitit.${key}`); return raw === null ? fallback : JSON.parse(raw); },
    async guestToken() {
        return AsyncStorage.getItem("splitit.guest-token");
    },
    async setGuestToken(value) {
        if (Platform.OS === "web")
            await AsyncStorage.setItem("splitit.guest-token", value);
    },
    async read(key, fallback) {
        const raw = await AsyncStorage.getItem(`splitit.${key}`);
        if (!raw && Platform.OS === "web" && key === "groups") {
            try {
                return JSON.parse(await AsyncStorage.getItem("splitit:groups") || "[]");
            }
            catch {
                return fallback;
            }
        }
        if (!raw && Platform.OS === "web" && key === "prefs")
            return { locale: await AsyncStorage.getItem("splitit:locale") || "hr", dark: await AsyncStorage.getItem("splitit:theme") === "dark" };
        if (!raw)
            return fallback;
        try {
            return JSON.parse(raw);
        }
        catch {
            return fallback;
        }
    },
    async write(key, value) {
        await AsyncStorage.setItem(`splitit.${key}`, JSON.stringify(value));
    },
    async setSession(s) {
        if (Platform.OS === "web") {
            if (s) {
                await AsyncStorage.setItem("splitit:token", s.token);
                await AsyncStorage.setItem("splitit:user", JSON.stringify(s.user));
            }
            else {
                await AsyncStorage.removeItem("splitit:token");
                await AsyncStorage.removeItem("splitit:user");
            }
        }
    },
    async legacySession() {
        if (Platform.OS === "web") {
            try {
                const token = await AsyncStorage.getItem("splitit:token"), user = JSON.parse(await AsyncStorage.getItem("splitit:user") || "null");
                return token && user?.id ? { token, user } : null;
            }
            catch {
                return null;
            }
        }
        return null;
    },
};
