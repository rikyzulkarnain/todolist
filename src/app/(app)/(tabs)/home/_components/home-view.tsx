"use client";

import TaskCheck from "@/components/common/task-check";
import { areaColor } from "@/constants/life-area-constant";
import { PRIORITIES, priorityWeight } from "@/constants/priority-constant";
import { getTasks, rescheduleTask, toggleTask } from "@/features/tasks/action";
import { cn } from "@/lib/utils";
import { useSheetStore } from "@/stores/sheet-store";
import { Task } from "@/types/task";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const SNOOZE_KEY = "aios-reminder-snooze";

function greetingLabel(): string {
  const h = new Date().getHours();
  if (h < 11) return "Selamat pagi";
  if (h < 15) return "Selamat siang";
  if (h < 19) return "Selamat sore";
  return "Selamat malam";
}

export default function HomeView({
  name,
  initialTasks,
}: {
  name: string;
  initialTasks: Task[];
}) {
  const queryClient = useQueryClient();
  const openSheet = useSheetStore((s) => s.openSheet);
  const [reminderDismissed, setReminderDismissed] = useState(true);

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: () => getTasks(),
    initialData: initialTasks,
  });

  const today = format(new Date(), "yyyy-MM-dd");
  const todayTasks = tasks.filter((t) => t.due_date === today);
  const doneCount = todayTasks.filter((t) => t.status === "done").length;
  const progressPct = todayTasks.length
    ? Math.round((doneCount / todayTasks.length) * 100)
    : 0;

  // 3 task teratas hari ini: yang belum selesai dulu, lalu prioritas terberat.
  const focusItems = todayTasks
    .slice()
    .sort(
      (a, b) =>
        Number(a.status === "done") - Number(b.status === "done") ||
        priorityWeight(b.priority) - priorityWeight(a.priority),
    )
    .slice(0, 3);

  const scheduleItems = todayTasks
    .filter((t) => t.due_time)
    .sort((a, b) => (a.due_time ?? "").localeCompare(b.due_time ?? ""));

  // Reminder in-app: task berwaktu paling awal hari ini yang sudah lewat jamnya
  // dan belum selesai. Muncul 2,5 detik setelah layar dibuka (seperti prototype).
  const nowTime = format(new Date(), "HH:mm");
  const dueNow = scheduleItems.find(
    (t) => t.status !== "done" && (t.due_time ?? "") <= nowTime,
  );

  useEffect(() => {
    const snoozeUntil = Number(localStorage.getItem(SNOOZE_KEY) ?? 0);
    if (Date.now() < snoozeUntil) return;
    const timer = setTimeout(() => setReminderDismissed(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  async function onToggle(id: string) {
    const current = queryClient.getQueryData<Task[]>(["tasks"]);
    const willBeDone = current?.find((t) => t.id === id)?.status !== "done";
    // Optimistik: centang langsung berubah, server menyusul.
    queryClient.setQueryData<Task[]>(["tasks"], (old) =>
      old?.map((t) =>
        t.id === id
          ? { ...t, status: t.status === "done" ? "todo" : "done" }
          : t,
      ),
    );
    const res = await toggleTask(id);
    if (res?.error) toast.error(res.error);
    else if (willBeDone) toast.success("Task selesai 🎉");
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
  }

  async function remDone() {
    if (!dueNow) return;
    setReminderDismissed(true);
    await onToggle(dueNow.id);
  }

  function remSnooze() {
    setReminderDismissed(true);
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + 15 * 60 * 1000));
    toast("Reminder ditunda 15 menit");
  }

  async function remReschedule() {
    if (!dueNow) return;
    setReminderDismissed(true);
    await rescheduleTask(dueNow.id, 1);
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
    toast(`Dipindah ke besok${dueNow.due_time ? " " + dueNow.due_time : ""}`);
  }

  const dateStr = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="relative flex flex-col gap-4 px-5 pt-[22px] pb-[90px]">
      {/* reminder banner */}
      {dueNow && !reminderDismissed && (
        <div className="anim-slide-down absolute top-3.5 right-3.5 left-3.5 z-40 rounded-[18px] bg-[#12332F] p-3.5 px-4 shadow-[0_12px_32px_rgba(0,0,0,.3)]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[11px] bg-white/[.12]">
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#7BD8CD"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.7 21a2 2 0 0 1-3.4 0" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-aqua text-[11px] font-bold tracking-[.5px] uppercase">
                Reminder · {dueNow.due_time}
              </div>
              <div className="mt-px text-sm font-bold text-white">
                {dueNow.title}
              </div>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={remDone}
              className="bg-teal h-9 flex-1 rounded-[10px] text-[12.5px] font-bold text-white hover:bg-[#14887F]"
            >
              Selesai
            </button>
            <button
              onClick={remSnooze}
              className="h-9 flex-1 rounded-[10px] bg-white/[.12] text-[12.5px] font-semibold text-white hover:bg-white/20"
            >
              Snooze 15m
            </button>
            <button
              onClick={remReschedule}
              className="h-9 flex-1 rounded-[10px] bg-white/[.12] text-[12.5px] font-semibold text-white hover:bg-white/20"
            >
              Jadwalkan ulang
            </button>
          </div>
        </div>
      )}

      {/* header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-ink text-[22px] font-extrabold tracking-[-0.4px]">
            {greetingLabel()}, {name}
          </div>
          <div className="text-mute mt-0.5 text-[13px]">{dateStr}</div>
        </div>
        <Link
          href="/profile"
          className="bg-teal flex h-11 w-11 items-center justify-center rounded-full text-base font-extrabold text-white hover:opacity-90"
        >
          {name.charAt(0).toUpperCase()}
        </Link>
      </div>

      {todayTasks.length === 0 ? (
        /* empty state */
        <div className="border-line flex flex-col items-center gap-1.5 rounded-[20px] border bg-white px-6 py-9 text-center">
          <div className="bg-mint mb-2 flex h-[72px] w-[72px] items-center justify-center rounded-3xl">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#0F766E"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M8 6h13" />
              <path d="M8 12h13" />
              <path d="M8 18h13" />
              <path d="M3 6h.01" />
              <path d="M3 12h.01" />
              <path d="M3 18h.01" />
            </svg>
          </div>
          <div className="text-ink text-base font-extrabold">
            Belum ada task hari ini
          </div>
          <div className="text-mute max-w-[230px] text-[13px] leading-[1.55] text-pretty">
            Mulai dengan satu task kecil, atau biarkan AI menyusun harimu.
          </div>
          <div className="mt-3.5 flex gap-2.5">
            <button
              onClick={() => openSheet()}
              className="bg-teal hover:bg-teal-deep h-11 rounded-xl px-[18px] text-[13.5px] font-bold text-white transition"
            >
              Buat task
            </button>
            <Link
              href="/ai"
              className="border-line-4 text-teal hover:bg-mint-3 flex h-11 items-center rounded-xl border-[1.5px] bg-white px-[18px] text-[13.5px] font-bold transition"
            >
              Tanya AI
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* kartu Fokus Hari Ini */}
          <div className="rounded-[20px] bg-[linear-gradient(150deg,#0F766E,#0A5750)] p-[18px] text-white">
            <div className="mb-3.5 flex items-center justify-between">
              <div className="text-aqua-2 text-xs font-bold tracking-[.8px] uppercase">
                Fokus Hari Ini
              </div>
              <div className="text-aqua-2 text-[11.5px] font-semibold">
                {doneCount} dari {todayTasks.length} selesai
              </div>
            </div>
            <div className="flex flex-col gap-2.5">
              {focusItems.map((t) => {
                const done = t.status === "done";
                return (
                  <div
                    key={t.id}
                    className="flex items-start gap-3 rounded-[14px] bg-white/[.08] px-3.5 py-3"
                  >
                    <TaskCheck done={done} onToggle={() => onToggle(t.id)} onDark />
                    <div className="min-w-0">
                      <div
                        className={cn(
                          "text-sm leading-[1.35] font-bold",
                          done && "line-through opacity-[.55]",
                        )}
                      >
                        {t.title}
                      </div>
                      <div className="text-aqua-2 mt-[3px] text-xs leading-[1.4]">
                        {t.ai_reason ??
                          `Prioritas ${PRIORITIES[t.priority].label.toLowerCase()}`}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-3.5">
              <div className="h-1.5 overflow-hidden rounded-[3px] bg-white/[.18]">
                <div
                  className="bg-aqua h-full rounded-[3px] transition-[width] duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          </div>

          {/* tombol Tanya AI */}
          <Link
            href="/ai?q=Saya bingung hari ini"
            className="border-line hover:border-teal hover:bg-[#FBFDFD] flex items-center gap-3 rounded-2xl border bg-white px-4 py-3.5 text-left transition"
          >
            <div className="bg-mint flex h-[38px] w-[38px] flex-none items-center justify-center rounded-xl">
              <svg
                width="19"
                height="19"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#0F766E"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="text-ink text-sm font-bold">
                Saya bingung hari ini
              </div>
              <div className="text-mute mt-px text-xs">
                Minta AI menyusun agenda prioritasmu
              </div>
            </div>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#8AA09C"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </Link>

          {/* jadwal hari ini */}
          <div className="border-line rounded-[18px] border bg-white px-[18px] py-4">
            <div className="text-ink mb-3 text-[13px] font-extrabold">
              Jadwal hari ini
            </div>
            {scheduleItems.length === 0 ? (
              <div className="text-mute-2 py-1.5 text-[13px]">
                Tidak ada jadwal berwaktu hari ini.
              </div>
            ) : (
              <div className="flex flex-col gap-0.5">
                {scheduleItems.map((s) => {
                  const done = s.status === "done";
                  return (
                    <div
                      key={s.id}
                      className={cn(
                        "flex items-center gap-3 py-2",
                        done && "opacity-45",
                      )}
                    >
                      <div className="text-slate w-[42px] flex-none text-xs font-bold tabular-nums">
                        {s.due_time}
                      </div>
                      <div
                        className="h-[26px] w-[3px] flex-none rounded-sm"
                        style={{ background: areaColor(s.life_area) }}
                      />
                      <div
                        className={cn(
                          "text-ink-2 min-w-0 text-[13.5px] font-semibold",
                          done && "line-through",
                        )}
                      >
                        {s.title}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* refleksi & tinjauan mingguan (v1.1) */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/reflection"
          className="border-line hover:border-teal flex flex-col gap-1.5 rounded-2xl border bg-white px-4 py-3.5 transition"
        >
          <span className="text-xl">📝</span>
          <span className="text-ink text-[13px] font-bold">Refleksi harian</span>
          <span className="text-mute text-[11.5px] leading-tight">
            Catat mood &amp; harimu
          </span>
        </Link>
        <Link
          href="/review"
          className="border-line hover:border-teal flex flex-col gap-1.5 rounded-2xl border bg-white px-4 py-3.5 transition"
        >
          <span className="text-xl">📊</span>
          <span className="text-ink text-[13px] font-bold">Tinjauan mingguan</span>
          <span className="text-mute text-[11.5px] leading-tight">
            Statistik &amp; insight
          </span>
        </Link>
      </div>
    </div>
  );
}
