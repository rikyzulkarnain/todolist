"use client";

import { toggleTask } from "@/features/tasks/action";
import { useAlarmStore } from "@/stores/alarm-store";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

const SNOOZE_MS = 5 * 60 * 1000;

/**
 * Alarm layar penuh yang berbunyi berulang sampai di-acknowledge — fallback web
 * untuk reminder tipe "alarm" (§11 PRD: OS tidak menjamin alarm background,
 * jadi disediakan alarm in-app yang jelas). Nada dibangkitkan via Web Audio
 * (tanpa file aset), plus getar bila perangkat mendukung.
 */
export default function AlarmOverlay() {
  const { task, stop } = useAlarmStore();
  const queryClient = useQueryClient();
  const audioRef = useRef<AudioContext | null>(null);
  const beepTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!task) return;

    // Bunyikan pola "beep beep" tiap 1,2 detik.
    function beep() {
      let ctx = audioRef.current;
      if (!ctx) {
        const AC =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
        audioRef.current = ctx;
      }
      if (ctx.state === "suspended") ctx.resume();
      const now = ctx.currentTime;
      [0, 0.18].forEach((offset) => {
        const osc = ctx!.createOscillator();
        const gain = ctx!.createGain();
        osc.type = "sine";
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.0001, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.4, now + offset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.14);
        osc.connect(gain);
        gain.connect(ctx!.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.16);
      });
      if ("vibrate" in navigator) navigator.vibrate([200, 100, 200]);
    }

    beep();
    beepTimer.current = setInterval(beep, 1200);

    return () => {
      if (beepTimer.current) clearInterval(beepTimer.current);
      beepTimer.current = null;
      audioRef.current?.close().catch(() => {});
      audioRef.current = null;
      if ("vibrate" in navigator) navigator.vibrate(0);
    };
  }, [task]);

  if (!task) return null;

  async function onDone() {
    const t = task!;
    stop();
    await toggleTask(t.id);
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
    toast.success(`"${t.title}" selesai`);
  }

  function onSnooze() {
    const t = task!;
    stop();
    setTimeout(() => useAlarmStore.getState().ring(t), SNOOZE_MS);
    toast("Alarm ditunda 5 menit");
  }

  return (
    <div className="anim-fade-in absolute inset-0 z-[70] flex flex-col items-center justify-center bg-[linear-gradient(160deg,#0F766E,#083F3A)] px-8 text-center text-white">
      <div className="anim-alarm-pulse flex h-24 w-24 items-center justify-center rounded-full bg-white/[.14]">
        <svg
          width="46"
          height="46"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#fff"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
      </div>

      <div className="text-aqua-2 mt-8 text-xs font-bold tracking-[2px] uppercase">
        ⏰ Alarm{task.due_time ? ` · ${task.due_time}` : ""}
      </div>
      <div className="mt-2 text-[26px] leading-[1.25] font-extrabold text-balance">
        {task.title}
      </div>
      <div className="text-aqua-2 mt-2 text-sm">{task.life_area}</div>

      <div className="mt-10 flex w-full max-w-[280px] flex-col gap-2.5">
        <button
          onClick={onDone}
          className="h-[54px] rounded-2xl bg-white text-[15px] font-extrabold text-[#0F766E] transition active:scale-[.98]"
        >
          Selesai
        </button>
        <div className="flex gap-2.5">
          <button
            onClick={onSnooze}
            className="h-12 flex-1 rounded-2xl bg-white/[.14] text-sm font-bold text-white transition hover:bg-white/25"
          >
            Tunda 5 menit
          </button>
          <button
            onClick={stop}
            className="h-12 flex-1 rounded-2xl bg-white/[.14] text-sm font-semibold text-white transition hover:bg-white/25"
          >
            Matikan
          </button>
        </div>
      </div>
    </div>
  );
}
