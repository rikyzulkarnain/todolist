"use client";

import { cn } from "@/lib/utils";
import {
  finishOnboardingAction,
  skipOnboardingAction,
} from "@/features/onboarding/action";
import { ProductiveTime } from "@/types/profile";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

// Pilihan goal cepat saat onboarding (bisa dipilih maks 3).
const GOAL_OPTIONS = [
  "Lulus sertifikasi PM",
  "Konsisten olahraga 3x/minggu",
  "Dana darurat 6 bulan",
  "Baca 12 buku tahun ini",
  "Kurangi screen time",
];

const FOCUS_OPTIONS: { title: ProductiveTime; sub: string; icon: string }[] = [
  { title: "Pagi", sub: "05.00 – 11.00 · umumnya paling produktif", icon: "🌅" },
  { title: "Siang", sub: "11.00 – 17.00 · setelah makan siang", icon: "☀️" },
  { title: "Malam", sub: "17.00 – 23.00 · saat suasana tenang", icon: "🌙" },
];

const EXAMPLE_TASK = "Tinjau 3 goal-ku malam ini";

export default function OnboardingView({ name }: { name: string }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [goalsSel, setGoalsSel] = useState<number[]>([]);
  const [focusSel, setFocusSel] = useState<ProductiveTime>("Pagi");
  const [firstTask, setFirstTask] = useState("");
  const [busy, setBusy] = useState(false);

  function toggleGoal(i: number) {
    setGoalsSel((prev) => {
      if (prev.includes(i)) return prev.filter((x) => x !== i);
      if (prev.length >= 3) return prev;
      return [...prev, i];
    });
  }

  async function finish() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await finishOnboardingAction({
        goals: goalsSel.map((i) => GOAL_OPTIONS[i]),
        productiveTime: focusSel,
        firstTask,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      router.replace("/home");
    } finally {
      setBusy(false);
    }
  }

  async function skip() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await skipOnboardingAction();
      if (res.error) {
        toast.error(res.error);
        return;
      }
      router.replace("/home");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-auto px-7 pt-6 pb-7">
      {/* progress dots + lewati */}
      <div className="mb-7 flex items-center justify-between">
        <div className="flex gap-1.5">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 rounded-[3px] transition-all duration-200",
                i <= step ? "bg-teal" : "bg-line-2",
                i === step ? "w-6" : "w-2.5",
              )}
            />
          ))}
        </div>
        <button
          onClick={skip}
          className="text-mute-2 hover:text-teal p-2 text-[13px] font-semibold"
        >
          Lewati
        </button>
      </div>

      {step === 1 && (
        <div className="anim-fade-in flex flex-1 flex-col justify-center">
          <div className="bg-mint mb-[22px] flex h-[72px] w-[72px] items-center justify-center rounded-[22px]">
            <svg
              width="34"
              height="34"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#0F766E"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.7 21a2 2 0 0 1-3.4 0" />
            </svg>
          </div>
          <div className="text-ink text-2xl leading-[1.25] font-extrabold tracking-[-0.4px]">
            Selamat datang,
            <br />
            {name}!
          </div>
          <div className="text-slate-2 mt-2.5 text-[14.5px] leading-relaxed text-pretty">
            Izinkan notifikasi agar aku bisa mengingatkanmu tepat waktu —
            reminder task, bukan spam.
          </div>
          <div className="mt-8 flex flex-col gap-2.5">
            <button
              onClick={() => {
                if (typeof Notification !== "undefined")
                  Notification.requestPermission();
                setStep(2);
              }}
              className="bg-teal hover:bg-teal-deep h-[50px] rounded-[14px] text-[15px] font-bold text-white transition"
            >
              Izinkan notifikasi
            </button>
            <button
              onClick={() => setStep(2)}
              className="text-slate-2 hover:text-teal h-[50px] rounded-[14px] text-sm font-semibold"
            >
              Nanti saja
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="anim-fade-in flex flex-1 flex-col">
          <div className="text-ink text-[22px] leading-[1.3] font-extrabold tracking-[-0.4px]">
            Apa 1–3 hal besar yang ingin kamu capai?
          </div>
          <div className="text-slate-2 mt-2 text-[13.5px] leading-[1.55]">
            AI memakai ini untuk memprioritaskan harimu. Pilih atau tulis
            sendiri.
          </div>
          <div className="mt-6 flex flex-col gap-2.5">
            {GOAL_OPTIONS.map((label, i) => {
              const sel = goalsSel.includes(i);
              return (
                <button
                  key={label}
                  onClick={() => toggleGoal(i)}
                  className={cn(
                    "flex min-h-[52px] items-center gap-3 rounded-[14px] border-[1.5px] px-4 py-3.5 text-left text-sm font-semibold transition",
                    sel
                      ? "border-teal bg-mint-2 text-ink"
                      : "border-line-2 text-slate bg-white",
                  )}
                >
                  <div
                    className={cn(
                      "flex h-5 w-5 flex-none items-center justify-center rounded-[7px] border-[1.5px]",
                      sel ? "border-teal bg-teal" : "border-[#C4D4D1]",
                    )}
                  >
                    {sel && (
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#fff"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    )}
                  </div>
                  {label}
                </button>
              );
            })}
          </div>
          <div className="flex-1" />
          <button
            onClick={() => setStep(3)}
            className="bg-teal hover:bg-teal-deep mt-5 h-[50px] rounded-[14px] text-[15px] font-bold text-white transition"
          >
            {goalsSel.length
              ? `Lanjut (${goalsSel.length} goal dipilih)`
              : "Lanjut tanpa goal"}
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="anim-fade-in flex flex-1 flex-col">
          <div className="text-ink text-[22px] leading-[1.3] font-extrabold tracking-[-0.4px]">
            Kapan kamu biasanya paling fokus?
          </div>
          <div className="text-slate-2 mt-2 text-[13.5px] leading-[1.55]">
            Task berat akan dijadwalkan di jam produktifmu.
          </div>
          <div className="mt-6 flex flex-col gap-2.5">
            {FOCUS_OPTIONS.map((f) => {
              const sel = focusSel === f.title;
              return (
                <button
                  key={f.title}
                  onClick={() => setFocusSel(f.title)}
                  className={cn(
                    "flex min-h-16 items-center gap-3.5 rounded-2xl border-[1.5px] px-4 py-3.5 text-left transition",
                    sel ? "border-teal bg-mint-2" : "border-line-2 bg-white",
                  )}
                >
                  <div className="w-10 text-center text-2xl">{f.icon}</div>
                  <div>
                    <div
                      className={cn(
                        "text-[15px] font-bold",
                        sel ? "text-ink" : "text-slate",
                      )}
                    >
                      {f.title}
                    </div>
                    <div className="text-mute mt-0.5 text-[12.5px]">{f.sub}</div>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="flex-1" />
          <button
            onClick={() => setStep(4)}
            className="bg-teal hover:bg-teal-deep mt-5 h-[50px] rounded-[14px] text-[15px] font-bold text-white transition"
          >
            Lanjut
          </button>
        </div>
      )}

      {step === 4 && (
        <div className="anim-fade-in flex flex-1 flex-col">
          <div className="text-ink text-[22px] leading-[1.3] font-extrabold tracking-[-0.4px]">
            Buat task pertamamu
          </div>
          <div className="text-slate-2 mt-2 text-[13.5px] leading-[1.55]">
            Satu hal kecil yang ingin kamu selesaikan hari ini.
          </div>
          <input
            value={firstTask}
            onChange={(e) => setFirstTask(e.target.value)}
            placeholder="mis. Rapikan meja kerja 10 menit"
            className="border-line-2 text-ink-2 focus:border-teal mt-6 h-[52px] w-full rounded-[14px] border-[1.5px] bg-white px-4 text-[15px] outline-none"
          />
          <button
            onClick={() => setFirstTask(EXAMPLE_TASK)}
            className="text-teal mt-3 py-1 text-left text-[13px] font-semibold hover:underline"
          >
            Pakai contoh: &quot;{EXAMPLE_TASK}&quot;
          </button>
          <div className="flex-1" />
          <button
            onClick={finish}
            disabled={busy}
            className="bg-teal hover:bg-teal-deep mt-5 h-[50px] rounded-[14px] text-[15px] font-bold text-white transition disabled:opacity-60"
          >
            {busy ? "Menyimpan…" : "Mulai pakai AI Life OS"}
          </button>
        </div>
      )}
    </div>
  );
}
