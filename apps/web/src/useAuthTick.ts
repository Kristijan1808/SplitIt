import { useEffect, useState } from "react";

/** Ponovno iscrta komponentu kad se promijeni prijava/profil ili popis grupa na uređaju. */
export function useAuthTick() {
  const [, set] = useState(0);
  useEffect(() => {
    const on = () => set((x) => x + 1);
    window.addEventListener("splitit:auth", on);
    window.addEventListener("splitit:groups", on);
    return () => { window.removeEventListener("splitit:auth", on); window.removeEventListener("splitit:groups", on); };
  }, []);
}
