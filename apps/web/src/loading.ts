import { useSyncExternalStore } from "react";

let pendingRequests = 0;
const listeners = new Set<() => void>();

const notify = () => {
  listeners.forEach((listener) => listener());
};

export const startApiLoading = () => {
  pendingRequests += 1;
  notify();
};

export const endApiLoading = () => {
  pendingRequests = Math.max(0, pendingRequests - 1);
  notify();
};

export const subscribeToApiLoading = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getApiLoadingSnapshot = () => pendingRequests;

export const useApiLoading = () =>
  useSyncExternalStore(
    subscribeToApiLoading,
    getApiLoadingSnapshot,
    getApiLoadingSnapshot
  );
