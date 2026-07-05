"use client";

import LogoMark from "@/components/common/logo-mark";
import { sendMagicLinkAction } from "@/features/auth/action";
import { createClient } from "@/lib/supabase/client";
import { useState } from "react";
import { toast } from "sonner";

export default function LoginView() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function sendMagic() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await sendMagicLinkAction({
        email,
        redirectTo: `${window.location.origin}/auth/callback`,
      });
      if (res.error) toast.error(res.error);
      else toast.success(res.message);
    } finally {
      setBusy(false);
    }
  }

  async function googleLogin() {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) toast.error(error.message);
  }

  return (
    <div className="flex flex-1 flex-col overflow-auto px-7 py-8">
      <div className="flex flex-1 flex-col justify-center">
        <LogoMark className="mb-5" />
        <div className="text-ink text-[28px] font-extrabold tracking-[-0.5px]">
          AI Life OS
        </div>
        <div className="text-slate-2 mt-2 max-w-[280px] text-[14.5px] leading-[1.55] text-pretty">
          Selalu tahu apa yang harus dikerjakan sekarang — AI yang memahami
          tujuan dan kebiasaanmu.
        </div>

        <div className="mt-9 flex flex-col gap-3">
          <div>
            <label className="text-slate mb-1.5 block text-xs font-bold">
              Email
            </label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMagic()}
              placeholder="nama@email.com"
              type="email"
              className="border-line-2 text-ink-2 focus:border-teal h-[50px] w-full rounded-[14px] border-[1.5px] bg-white px-4 text-[15px] outline-none"
            />
          </div>
          <button
            onClick={sendMagic}
            disabled={busy}
            className="bg-teal hover:bg-teal-deep h-[50px] rounded-[14px] text-[15px] font-bold text-white transition active:scale-[.985] disabled:opacity-60"
          >
            {busy ? "Mengirim…" : "Kirim magic link"}
          </button>

          <div className="my-1 flex items-center gap-3">
            <div className="bg-line-3 h-px flex-1" />
            <span className="text-mute-2 text-xs">atau</span>
            <div className="bg-line-3 h-px flex-1" />
          </div>

          <button
            onClick={googleLogin}
            className="border-line-2 text-ink-2 hover:bg-mint-3 flex h-[50px] items-center justify-center gap-2.5 rounded-[14px] border-[1.5px] bg-white text-[15px] font-semibold transition"
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.1h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.7 2.9c2.3-2.1 3.7-5.1 3.7-8.6z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.7-2.9c-1 .7-2.4 1.2-4.2 1.2-3.2 0-6-2.1-6.9-5.1l-3.9 3C3.2 21.3 7.3 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.1 14.3c-.3-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3l-3.9-3C.4 8.3 0 10.1 0 12s.4 3.7 1.2 5.3l3.9-3z"
              />
              <path
                fill="#EA4335"
                d="M12 4.7c2.3 0 3.8 1 4.7 1.8l3.4-3.3C18 1.2 15.2 0 12 0 7.3 0 3.2 2.7 1.2 6.7l3.9 3c1-3 3.7-5 6.9-5z"
              />
            </svg>
            Lanjut dengan Google
          </button>
        </div>
      </div>

      <div className="text-mute-2 text-center text-[11.5px] leading-normal text-pretty">
        Dengan masuk, kamu menyetujui Kebijakan Privasi. Datamu terenkripsi dan
        tidak dikirim ke AI tanpa izinmu.
      </div>
    </div>
  );
}
