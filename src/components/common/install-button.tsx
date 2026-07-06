"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Kartu "Install aplikasi" untuk PWA. Menampilkan tombol native install saat
 * browser memicu `beforeinstallprompt` (Chrome/Android/desktop). Di iOS —
 * yang tak punya event itu — menampilkan petunjuk manual. Tersembunyi bila
 * app sudah terpasang (standalone).
 */
export default function InstallButton() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const nav = navigator as Navigator & { standalone?: boolean };
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      nav.standalone === true;
    if (standalone) {
      setInstalled(true);
      return;
    }
    const ua = navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(ua) && !/crios|fxios/.test(ua));

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") toast.success("Aplikasi dipasang 🎉");
    setDeferred(null);
  }

  // Sudah terpasang, atau tak bisa install & bukan iOS → sembunyikan.
  if (installed || (!deferred && !isIOS)) return null;

  return (
    <div className="rounded-[18px] bg-[linear-gradient(150deg,#0F766E,#0A5750)] p-[18px] text-white">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 flex-none items-center justify-center rounded-2xl bg-white/15">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 3v12" />
            <path d="m8 11 4 4 4-4" />
            <path d="M4 21h16" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-extrabold">Install aplikasi</div>
          <div className="text-[12px] leading-snug text-[#B9E6E0]">
            {isIOS
              ? "Buka menu Bagikan (⬆️) → Add to Home Screen"
              : "Pasang di layar utama untuk akses cepat & notifikasi"}
          </div>
        </div>
        {deferred && (
          <button
            onClick={install}
            className="text-teal h-9 flex-none rounded-[10px] bg-white px-4 text-[13px] font-extrabold transition hover:opacity-90"
          >
            Install
          </button>
        )}
      </div>
    </div>
  );
}
