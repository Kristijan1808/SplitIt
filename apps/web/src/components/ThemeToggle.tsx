import { MoonStar, SunMedium } from "lucide-react";
import { useEffect, useState } from "react";
import { applyTheme, getSavedTheme, type Theme } from "../theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => getSavedTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    <button
      className="secondaryButton themeToggle"
      type="button"
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
    >
      {theme === "light" ? <SunMedium size={16} /> : <MoonStar size={16} />}
      <span>{theme === "light" ? "Light" : "Dark"}</span>
    </button>
  );
}