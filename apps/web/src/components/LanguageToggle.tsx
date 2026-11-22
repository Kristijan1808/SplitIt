import { useState } from "react";
import { Globe } from "lucide-react";
import { RichSelect, Flag } from "./RichSelect";
import { useLanguage, languageOptions, type LanguageCode } from "../i18n";

export function LanguageToggle({ variant = "menu" }: { variant?: "menu" | "select" }) {
  const { language, setLanguage, t } = useLanguage();
  const [showMenu, setShowMenu] = useState(false);

  if (variant === "select") {
    return (
      <RichSelect
        id="language-select"
        ariaLabel={t("languageSelector")}
        value={language}
        onChange={(v) => setLanguage(v as LanguageCode)}
        options={languageOptions.map((option) => ({ value: option.code, label: option.label, visual: <Flag code={option.code} /> }))}
      />
    );
  }

  return (
    <div className="languageToggleWrap">
      <button
        type="button"
        className="languageToggle"
        aria-label={t("languageSelector")}
        onClick={() => setShowMenu((current) => !current)}
      >
        <Globe size={16} />
        <Flag code={language} />
      </button>
      {showMenu && (
        <div className="languageMenu" role="menu">
          {languageOptions.map((option) => (
            <button
              key={option.code}
              type="button"
              className={`languageOption ${language === option.code ? "active" : ""}`}
              onClick={() => {
                setLanguage(option.code);
                setShowMenu(false);
              }}
            >
              <Flag code={option.code} />
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
