"use client";

import {
  alphaColor,
  LIFE_AREA_NAMES,
  LIFE_AREAS,
} from "@/constants/life-area-constant";
import { PRIORITIES, PRIORITY_KEYS } from "@/constants/priority-constant";
import { transcribeAudio } from "@/features/ai/transcribe";
import { addTask } from "@/features/tasks/action";
import { useAudioRecorder } from "@/hooks/use-audio-recorder";
import { useOnline } from "@/hooks/use-online";
import { ensureNotificationPermission } from "@/lib/notifications";
import { cn } from "@/lib/utils";
import { useSheetStore } from "@/stores/sheet-store";
import { LifeArea, Priority, ReminderType } from "@/types/task";
import { useQueryClient } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";

const DAY_OPTIONS: { value: number; name: string }[] = [
  { value: 0, name: "Hari ini" },
  { value: 1, name: "Besok" },
  { value: 3, name: "Minggu ini" },
];

// FAB tampil hanya di Home & Tasks (mengikuti prototype).
const FAB_ROUTES = ["/home", "/tasks"];

/**
 * FAB "+" dan bottom sheet "Tambah tugas". Sheet bisa dibuka dari mana saja
 * lewat useSheetStore (empty state Home/Tasks/Calendar).
 */
export default function AddTaskSheet() {
  const pathname = usePathname();
  const online = useOnline();
  const queryClient = useQueryClient();
  const { open, openSheet, closeSheet } = useSheetStore();

  const [title, setTitle] = useState("");
  const [area, setArea] = useState<LifeArea>("Karier");
  const [priority, setPriority] = useState<Priority>("sedang");
  const [dayOffset, setDayOffset] = useState(0);
  const [time, setTime] = useState("");
  const [reminder, setReminder] = useState<ReminderType>("push");
  const [busy, setBusy] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [dragY, setDragY] = useState(0);
  const dragStart = useRef<number | null>(null);

  const { recording, toggle: toggleVoice } = useAudioRecorder({
    onRecorded: async (audio) => {
      setTranscribing(true);
      try {
        const res = await transcribeAudio(audio);
        if (res.error || !res.text) {
          toast.error(res.error ?? "Suara tidak terdengar. Coba lagi ya.");
          return;
        }
        setTitle((prev) => (prev ? `${prev} ${res.text}` : res.text!));
      } finally {
        setTranscribing(false);
      }
    },
  });

  const showFab = FAB_ROUTES.some((r) => pathname.startsWith(r)) && !open;

  async function pickReminder(value: ReminderType) {
    setReminder(value);
    if (value !== "none") await ensureNotificationPermission();
  }

  function onDragEnd() {
    if (dragY > 110) closeSheet();
    setDragY(0);
    dragStart.current = null;
  }

  async function save() {
    const clean = title.trim();
    if (!clean) {
      toast.error("Tulis judul tugas dulu");
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const res = await addTask({
        title: clean,
        lifeArea: area,
        priority,
        dayOffset,
        time: time || undefined,
        reminder: time ? reminder : "none",
      });
      if (res.error) {
        toast.error(
          online ? res.error : "Gagal sinkron — disimpan offline",
        );
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      closeSheet();
      setTitle("");
      setTime("");
      toast.success("Tugas ditambahkan");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {showFab && (
        <button
          onClick={openSheet}
          aria-label="Tambah tugas"
          className="bg-teal hover:bg-teal-deep absolute right-[18px] bottom-[86px] z-20 flex h-[54px] w-[54px] items-center justify-center rounded-[18px] shadow-[0_10px_24px_rgba(15,118,110,.4)] transition active:scale-[.94]"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="2.4"
            strokeLinecap="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      )}

      {open && (
        <>
          <div
            onClick={closeSheet}
            className="absolute inset-0 z-50 bg-[rgba(9,40,37,.45)]"
          />
          <div
            className="anim-sheet-up absolute right-0 bottom-0 left-0 z-[51] max-h-[92%] overflow-y-auto rounded-t-3xl bg-white px-5 pt-3.5 pb-6"
            style={{
              transform: dragY ? `translateY(${dragY}px)` : undefined,
              transition: dragY ? "none" : "transform .22s ease",
            }}
          >
            {/* grabber — tarik ke bawah / klik untuk menutup */}
            <div
              onClick={closeSheet}
              onTouchStart={(e) => (dragStart.current = e.touches[0].clientY)}
              onTouchMove={(e) => {
                if (dragStart.current === null) return;
                const dy = e.touches[0].clientY - dragStart.current;
                if (dy > 0) setDragY(dy);
              }}
              onTouchEnd={onDragEnd}
              className="-mx-5 -mt-3.5 cursor-pointer px-5 pt-3.5 pb-1"
              style={{ touchAction: "none" }}
              aria-label="Tarik atau klik untuk menutup"
            >
              <div className="bg-line-3 mx-auto h-1.5 w-11 rounded-full" />
            </div>
            <div className="mt-2 mb-3.5 flex items-center justify-between pt-3">
              <div className="text-ink text-[17px] font-extrabold">
                Tambah tugas
              </div>
              <button
                onClick={closeSheet}
                aria-label="Tutup"
                className="text-slate flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-[#F1F5F4]"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex gap-2">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && save()}
                placeholder={
                  transcribing ? "Mendengarkan…" : "Apa yang perlu dikerjakan?"
                }
                className="border-line-2 bg-soft text-ink-2 focus:border-teal h-[50px] min-w-0 flex-1 rounded-[14px] border-[1.5px] px-4 text-[15px] outline-none focus:bg-white"
              />
              <button
                onClick={toggleVoice}
                disabled={busy || transcribing}
                aria-label={recording ? "Berhenti merekam" : "Isi dengan suara"}
                className={cn(
                  "flex h-[50px] w-[50px] flex-none items-center justify-center rounded-[14px] border-[1.5px] transition disabled:opacity-50",
                  recording
                    ? "border-red-500 bg-red-500 text-white"
                    : "border-line-2 text-teal hover:bg-mint-3 bg-white",
                )}
              >
                {recording ? (
                  <div className="h-3.5 w-3.5 rounded-[3px] bg-white" />
                ) : transcribing ? (
                  <div className="border-teal h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" />
                ) : (
                  <svg
                    width="19"
                    height="19"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <path d="M12 19v4" />
                  </svg>
                )}
              </button>
            </div>

            <div className="text-slate mt-4 mb-2 text-[11.5px] font-extrabold tracking-[.5px] uppercase">
              Life Area
            </div>
            <div className="flex flex-wrap gap-[7px]">
              {LIFE_AREA_NAMES.map((a) => {
                const sel = area === a;
                const c = LIFE_AREAS[a];
                return (
                  <button
                    key={a}
                    onClick={() => setArea(a)}
                    className="h-8 rounded-2xl border-[1.5px] px-3 text-xs font-bold transition-all duration-100"
                    style={{
                      borderColor: sel ? c : "#D6E1DF",
                      background: sel ? alphaColor(c, 0.14) : "#fff",
                      color: sel ? c : "#5B7370",
                    }}
                  >
                    {a}
                  </button>
                );
              })}
            </div>

            <div className="text-slate mt-4 mb-2 text-[11.5px] font-extrabold tracking-[.5px] uppercase">
              Prioritas
            </div>
            <div className="flex gap-[7px]">
              {PRIORITY_KEYS.map((k) => {
                const sel = priority === k;
                const c = PRIORITIES[k].color;
                return (
                  <button
                    key={k}
                    onClick={() => setPriority(k)}
                    className="h-8 rounded-2xl border-[1.5px] px-3 text-xs font-bold transition-all duration-100"
                    style={{
                      borderColor: sel ? c : "#D6E1DF",
                      background: sel ? alphaColor(c, 0.12) : "#fff",
                      color: sel ? c : "#5B7370",
                    }}
                  >
                    {PRIORITIES[k].label}
                  </button>
                );
              })}
            </div>

            <div className="text-slate mt-4 mb-2 text-[11.5px] font-extrabold tracking-[.5px] uppercase">
              Jatuh tempo
            </div>
            <div className="flex gap-[7px]">
              {DAY_OPTIONS.map((d) => {
                const sel = dayOffset === d.value;
                return (
                  <button
                    key={d.value}
                    onClick={() => setDayOffset(d.value)}
                    className={cn(
                      "h-8 rounded-2xl border-[1.5px] px-3 text-xs font-bold transition-all duration-100",
                      sel
                        ? "border-teal bg-mint-2 text-teal"
                        : "border-line-2 text-slate-2 bg-white",
                    )}
                  >
                    {d.name}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex items-start gap-4">
              <div>
                <div className="text-slate mb-2 text-[11.5px] font-extrabold tracking-[.5px] uppercase">
                  Waktu
                </div>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="border-line-2 bg-soft text-ink-2 focus:border-teal h-8 rounded-2xl border-[1.5px] px-3 text-xs font-bold outline-none focus:bg-white"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-slate mb-2 text-[11.5px] font-extrabold tracking-[.5px] uppercase">
                  Pengingat
                </div>
                <div className="flex gap-[7px]">
                  {(["none", "push", "alarm"] as ReminderType[]).map((r) => {
                    const sel = reminder === r;
                    const label =
                      r === "none"
                        ? "Tidak"
                        : r === "push"
                          ? "Notifikasi"
                          : "Alarm";
                    return (
                      <button
                        key={r}
                        onClick={() => pickReminder(r)}
                        disabled={!time}
                        className={cn(
                          "h-8 rounded-2xl border-[1.5px] px-3 text-xs font-bold transition-all duration-100 disabled:opacity-40",
                          sel
                            ? "border-teal bg-mint-2 text-teal"
                            : "border-line-2 text-slate-2 bg-white",
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <button
              onClick={save}
              disabled={busy}
              className="bg-teal hover:bg-teal-deep mt-5 h-[50px] w-full rounded-[14px] text-[15px] font-bold text-white transition disabled:opacity-60"
            >
              {busy ? "Menyimpan…" : "Simpan"}
            </button>
          </div>
        </>
      )}
    </>
  );
}
