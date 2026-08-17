import { MoonStar, SunMedium } from "lucide-react";
import { useEffect, useState } from "react";
import { applyTheme, getSavedTheme, type Theme } from "../theme";
import { useLanguage } from "../i18n";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => getSavedTheme());
  const { t } = useLanguage();

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    <button
      type="button"
      className="themeToggle"
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      aria-label={theme === "light" ? t("themeDark") : t("themeLight")}
    >
      {theme === "light" ? <SunMedium size={16} /> : <MoonStar size={16} />}
      <span>{theme === "light" ? t("themeLight") : t("themeDark")}</span>
    </button>
  );
}