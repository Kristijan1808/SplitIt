import type { AuthUser } from "./types";

export function getAuthToken() {
  return localStorage.getItem("splitit:token");
}

export function getAuthUser(): AuthUser | null {
  const raw = localStorage.getItem("splitit:user");
  if (!raw) return null;

  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function saveAuth(token: string, user: AuthUser) {
  localStorage.setItem("splitit:token", token);
  localStorage.setItem("splitit:user", JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem("splitit:token");
  localStorage.removeItem("splitit:user");
}

export function isLoggedIn() {
  return Boolean(getAuthToken());
}
