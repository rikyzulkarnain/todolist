"use client";

import { saveReflection } from "@/features/reflection/action";
import { cn } from "@/lib/utils";
import { Mood, Reflection } from "@/types/reflection";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

const MOODS: { value: Mood; emoji: string; label: string }[] = [
  { value: 1, emoji: "😞", label: "Berat" },
  { value: 2, emoji: "😕", label: "Kurang" },
  { value: 3, emoji: "😐", label: "Biasa" },
  { value: 4, emoji: "🙂", label: "Baik" },
  { value: 5, emoji: "😄", label: "Hebat" },
];

export default function ReflectionView({
  initial,
}: {
  initial: Reflection | null;
}) {
  const router = useRouter();
  const [mood, setMood] = useState<Mood | null>(initial?.mood ?? null);
  const [note, setNote] = useState(initial?.note ?? "");
  const [busy, setBusy] = useState(false);

  const dateStr = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  async function save() {
    if (!mood) {
      toast.error("Pilih dulu mood-mu hari ini");
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const res = await saveReflection({ mood, note });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Refleksi tersimpan");
      router.push("/home");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-auto px-6 pt-5 pb-7">
      {/* header + back */}
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => router.push("/home")}
          aria-label="Kembali"
          className="border-line-2 text-slate hover:bg-soft flex h-10 w-10 items-center justify-center rounded-full border-[1.5px] bg-white transition"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div>
          <div className="text-ink text-lg font-extrabold">Refleksi harian</div>
          <div className="text-mute text-[12.5px]">{dateStr}</div>
        </div>
      </div>

      <div className="text-ink text-[19px] leading-[1.3] font-extrabold tracking-[-0.3px]">
        Bagaimana harimu?
      </div>
      <div className="text-slate-2 mt-1.5 text-[13.5px] leading-[1.55]">
        Satu ketukan untuk mencatat perasaanmu. AI memakainya untuk memahami pola
        dan menyusun harimu lebih baik.
      </div>

      {/* mood */}
      <div className="mt-6 flex justify-between gap-1.5">
        {MOODS.map((m) => {
          const sel = mood === m.value;
          return (
            <button
              key={m.value}
              onClick={() => setMood(m.value)}
              className={cn(
                "flex flex-1 flex-col items-center gap-1.5 rounded-2xl border-[1.5px] py-3 transition",
                sel
                  ? "border-teal bg-mint-2"
                  : "border-line-2 bg-white hover:bg-soft",
              )}
            >
              <span
                className={cn(
                  "text-[26px] transition",
                  sel ? "scale-110" : "opacity-70 grayscale",
                )}
              >
                {m.emoji}
              </span>
              <span
                className={cn(
                  "text-[10.5px] font-bold",
                  sel ? "text-teal" : "text-mute-2",
                )}
              >
                {m.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* note */}
      <div className="text-slate mt-6 mb-2 text-[11.5px] font-extrabold tracking-[.5px] uppercase">
        Catatan (opsional)
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={4}
        placeholder="Apa yang bikin harimu terasa begitu? Apa yang ingin kamu ubah besok?"
        className="border-line-2 bg-soft text-ink-2 focus:border-teal w-full resize-none rounded-[14px] border-[1.5px] px-4 py-3 text-sm leading-relaxed outline-none focus:bg-white"
      />

      <div className="flex-1" />
      <button
        onClick={save}
        disabled={busy}
        className="bg-teal hover:bg-teal-deep mt-6 h-[50px] rounded-[14px] text-[15px] font-bold text-white transition disabled:opacity-60"
      >
        {busy ? "Menyimpan…" : initial ? "Perbarui refleksi" : "Simpan refleksi"}
      </button>
    </div>
  );
}
