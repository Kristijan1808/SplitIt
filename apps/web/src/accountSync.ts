import { api } from "./api";
import { getAuthToken, getAuthUser, isLoggedIn, saveAuth } from "./auth";
import { mergeAccountGroups } from "./storage";

/** Povlači grupe prijavljenog računa sa servera i pamti ih na uređaju. Bez mreže tiho preskače. */
export async function syncAccountGroups(): Promise<boolean> {
  const user = getAuthUser();
  if (!isLoggedIn() || !user?.id) return false;
  try { mergeAccountGroups(user.id, await api.getMyGroups()); return true; } catch { return false; }
}

/** Osvježi spremljenog korisnika (npr. profilnu sliku promijenjenu na drugom uređaju). */
export async function refreshAuthUser(): Promise<void> {
  const token = getAuthToken();
  if (!token) return;
  try {
    const { user } = await api.me();
    const cur = getAuthUser();
    if (getAuthToken() === token && (cur?.avatarImage !== user.avatarImage || cur?.username !== user.username)) saveAuth(token, { ...cur, ...user });
  } catch { /* bez mreže ili istekla prijava: zadrži postojeće */ }
}
