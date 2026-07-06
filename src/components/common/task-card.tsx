"use client";

import TaskCheck from "@/components/common/task-check";
import {
  alphaColor,
  areaColor,
} from "@/constants/life-area-constant";
import { PRIORITIES } from "@/constants/priority-constant";
import { cn } from "@/lib/utils";
import { useTaskDetailStore } from "@/stores/task-detail-store";
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
  const openTask = useTaskDetailStore((s) => s.openTask);
  const done = task.status === "done";
  const c = areaColor(task.life_area);
  const pr = PRIORITIES[task.priority];
  const subtasks = task.subtasks ?? [];
  const doneSub = subtasks.filter((s) => s.status === "done").length;

  return (
    <div className="border-line flex items-start gap-3 rounded-2xl border bg-white px-3.5 py-[13px]">
      <TaskCheck done={done} onToggle={() => onToggle(task.id)} />
      <button
        onClick={() => openTask(task)}
        className="min-w-0 flex-1 text-left"
      >
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
          {task.space_id && (
            <span className="text-teal flex items-center gap-1 text-[10.5px] font-bold">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-label="Berbagi"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              Berbagi
            </span>
          )}
          {task.repeat_rule && (
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#8AA09C"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-label="Berulang"
            >
              <path d="M17 2l4 4-4 4" />
              <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
              <path d="M7 22l-4-4 4-4" />
              <path d="M21 13v1a4 4 0 0 1-4 4H3" />
            </svg>
          )}
          {subtasks.length > 0 && (
            <span className="text-mute-2 flex items-center gap-1 text-[10.5px] font-bold">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
              {doneSub}/{subtasks.length}
            </span>
          )}
        </div>
        {(task.tags?.length ?? 0) > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {task.tags!.map((t) => (
              <span
                key={t.id}
                className="text-mute bg-soft rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
              >
                #{t.name}
              </span>
            ))}
          </div>
        )}
      </button>
    </div>
  );
}
