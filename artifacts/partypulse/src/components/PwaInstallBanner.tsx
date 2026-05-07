import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "pp_install_dismissed_at";
const COOLDOWN_DAYS = 7;

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}
function isInStandaloneMode() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true;
}
function wasDismissedRecently() {
  const ts = localStorage.getItem(DISMISSED_KEY);
  if (!ts) return false;
  const diff = Date.now() - parseInt(ts, 10);
  return diff < COOLDOWN_DAYS * 86_400_000;
}

export default function PwaInstallBanner() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIos, setShowIos] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isInStandaloneMode() || wasDismissedRecently()) return;

    if (isIos()) {
      setShowIos(true);
      setVisible(true);
      return;
    }

    function handler(e: Event) {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    }
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setVisible(false);
  }

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") setVisible(false);
    else dismiss();
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-20 left-3 right-3 z-[9998] bg-card border border-primary/30 rounded-2xl shadow-2xl p-4 flex items-start gap-3">
      <div className="text-3xl flex-shrink-0">🎉</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-foreground">Add PartyPulse to Home Screen</p>
        {showIos ? (
          <p className="text-xs text-muted-foreground mt-0.5">
            Tap <span className="font-semibold">Share</span> then{" "}
            <span className="font-semibold">Add to Home Screen</span> in Safari.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground mt-0.5">
            Get instant access — no app store needed.
          </p>
        )}
      </div>
      <div className="flex flex-col gap-1.5 flex-shrink-0">
        {!showIos && (
          <button
            onClick={install}
            className="text-xs bg-primary text-primary-foreground rounded-lg px-3 py-1.5 font-semibold hover:opacity-90"
          >
            Install
          </button>
        )}
        <button
          onClick={dismiss}
          className="text-xs text-muted-foreground hover:text-foreground text-right"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
