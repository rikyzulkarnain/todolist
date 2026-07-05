"use client";

import TaskCheck from "@/components/common/task-check";
import {
  alphaColor,
  areaColor,
} from "@/constants/life-area-constant";
import { PRIORITIES } from "@/constants/priority-constant";
import { cn } from "@/lib/utils";
import { Task } from "@/types/task";
import { differenceInCalendarDays, parseISO } from "date-fns";

const DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

/** "Hari ini · 09:00", "Besok", nama hari, atau tanggal untuk label jatuh tempo. */
export function dueLabel(task: Task): string {
  if (!task.due_date) return "Fleksibel";
  const date = parseISO(task.due_date);
  const diff = differenceInCalendarDays(date, new Date());
  let base: string;
  if (diff === 0) base = "Hari ini";
  else if (diff === 1) base = "Besok";
  else if (diff > 1 && diff < 7) base = DAY_NAMES[date.getDay()];
  else base = task.due_date;
  return task.due_time ? `${base} · ${task.due_time}` : base;
}

/** Kartu task list (Tugas & kelompok kalender) sesuai prototype. */
export default function TaskCard({
  task,
  onToggle,
}: {
  task: Task;
  onToggle: (id: string) => void;
}) {
  const done = task.status === "done";
  const c = areaColor(task.life_area);
  const pr = PRIORITIES[task.priority];

  return (
    <div className="border-line flex items-start gap-3 rounded-2xl border bg-white px-3.5 py-[13px]">
      <TaskCheck done={done} onToggle={() => onToggle(task.id)} />
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "text-ink-2 text-sm leading-[1.35] font-bold",
            done && "line-through opacity-50",
          )}
        >
          {task.title}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <span
            className="rounded-md px-2 py-[3px] text-[10.5px] font-bold"
            style={{ background: alphaColor(c, 0.12), color: c }}
          >
            {task.life_area}
          </span>
          <span
            className="text-[10.5px] font-bold"
            style={{ color: pr.color }}
          >
            {pr.label}
          </span>
          <span className="text-mute-2 text-[11px] font-semibold">
            {dueLabel(task)}
          </span>
        </div>
      </div>
    </div>
  );
}
