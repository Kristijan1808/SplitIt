export type Theme = "light" | "dark";

const DARK_STYLE_ID = "splitit-dark-theme";

export function applyTheme(theme: Theme) {
  localStorage.setItem("splitit:theme", theme);

  const existing = document.getElementById(DARK_STYLE_ID);

  if (theme === "dark") {
    if (!existing) {
      const link = document.createElement("link");
      link.id = DARK_STYLE_ID;
      link.rel = "stylesheet";
      link.href = "/src/style-dark.css";
      document.head.appendChild(link);
    }

    document.documentElement.dataset.theme = "dark";
    return;
  }

  existing?.remove();
  document.documentElement.dataset.theme = "light";
}

export function getSavedTheme(): Theme {
  return localStorage.getItem("splitit:theme") === "dark" ? "dark" : "light";
}