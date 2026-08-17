import { useState } from "react";
import { Globe } from "lucide-react";
import { useLanguage, languageOptions } from "../i18n";

export function LanguageToggle() {
  const { language, setLanguage, t } = useLanguage();
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="languageToggleWrap">
      <button
        type="button"
        className="languageToggle"
        aria-label={t("languageSelector")}
        onClick={() => setShowMenu((current) => !current)}
      >
        <Globe size={16} />
        <span>{languageOptions.find((option) => option.code === language)?.flag ?? "🇭🇷"}</span>
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
              <span>{option.flag}</span>
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
