import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../i18n";

type GoogleCredentialResponse = {
  credential: string;
};

type GoogleIdentityApi = {
  accounts: {
    id: {
      initialize: (options: {
        client_id: string;
        callback: (response: GoogleCredentialResponse) => void;
      }) => void;
      renderButton: (
        element: HTMLElement,
        options: {
          theme: "outline";
          size: "large";
          text: "continue_with" | "signup_with";
          shape: "rectangular";
          width: number;
        }
      ) => void;
    };
  };
};

declare global {
  interface Window {
    google?: GoogleIdentityApi;
  }
}

const GOOGLE_SCRIPT_URL = "https://accounts.google.com/gsi/client";
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

type Props = {
  mode: "login" | "register";
  onCredential: (credential: string) => void;
};

export function GoogleSignInButton({ mode, onCredential }: Props) {
  const { t } = useLanguage();
  const buttonRef = useRef<HTMLDivElement>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    let disposed = false;
    const renderButton = () => {
      if (disposed || !window.google || !buttonRef.current) return;
      buttonRef.current.replaceChildren();
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => onCredential(response.credential)
      });
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: "outline",
        size: "large",
        text: mode === "register" ? "signup_with" : "continue_with",
        shape: "rectangular",
        width: Math.min(320, buttonRef.current.parentElement?.clientWidth ?? 320)
      });
    };
    const handleLoadError = () => setLoadError(true);

    if (window.google) {
      renderButton();
      return () => {
        disposed = true;
      };
    }

    let script = document.querySelector<HTMLScriptElement>(
      `script[src="${GOOGLE_SCRIPT_URL}"]`
    );
    if (!script) {
      script = document.createElement("script");
      script.src = GOOGLE_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      document.head.append(script);
    }

    script.addEventListener("load", renderButton);
    script.addEventListener("error", handleLoadError);
    return () => {
      disposed = true;
      script?.removeEventListener("load", renderButton);
      script?.removeEventListener("error", handleLoadError);
    };
  }, [mode, onCredential]);

  if (!GOOGLE_CLIENT_ID) {
    return <p className="muted">{t("googleSignInNotConfigured")}</p>;
  }

  return (
    <div className="googleSignIn" aria-label={t("continueWithGoogle")}>
      <div ref={buttonRef} />
      {loadError && <p className="error">{t("googleSignInUnavailable")}</p>}
    </div>
  );
}
