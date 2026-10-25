import { useSyncExternalStore } from "react";

export type ToastNotification = {
  id: number;
  message: string;
};

let notification: ToastNotification | null = null;
let nextId = 0;
let timeout: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

export function showToast(message: string) {
  notification = { id: ++nextId, message };
  if (timeout) clearTimeout(timeout);
  timeout = setTimeout(() => {
    notification = null;
    timeout = undefined;
    notify();
  }, 5000);
  notify();
}

export function useToastNotification() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => notification,
    () => null
  );
}
