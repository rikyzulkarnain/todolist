"use client";

import TaskCard from "@/components/common/task-card";
import { LIFE_AREAS } from "@/constants/life-area-constant";
import { PRIORITIES, PRIORITY_KEYS } from "@/constants/priority-constant";
import { getTasks, toggleTask } from "@/features/tasks/action";
import { cn } from "@/lib/utils";
import { useSheetStore } from "@/stores/sheet-store";
import { LifeArea, Task } from "@/types/task";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { useState } from "react";

type GroupBy = "area" | "pr" | "due";

const SEG_TABS: { key: GroupBy; label: string }[] = [
  { key: "area", label: "Life Area" },
  { key: "pr", label: "Prioritas" },
  { key: "due", label: "Jatuh tempo" },
];

function dayOffset(t: Task): number {
  if (!t.due_date) return 99;
  return differenceInCalendarDays(parseISO(t.due_date), new Date());
}

export default function TasksView({ initialTasks }: { initialTasks: Task[] }) {
  const queryClient = useQueryClient();
  const openSheet = useSheetStore((s) => s.openSheet);
  const [groupBy, setGroupBy] = useState<GroupBy>("area");

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: () => getTasks(),
    initialData: initialTasks,
  });

  async function onToggle(id: string) {
    await toggleTask(id);
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
  }

  let groups: { name: string; color: string; tasks: Task[] }[] = [];
  if (groupBy === "area") {
    groups = (Object.keys(LIFE_AREAS) as LifeArea[]).map((a) => ({
      name: a,
      color: LIFE_AREAS[a],
      tasks: tasks.filter((t) => t.life_area === a),
    }));
  } else if (groupBy === "pr") {
    groups = PRIORITY_KEYS.map((k) => ({
      name: PRIORITIES[k].label,
      color: PRIORITIES[k].color,
      tasks: tasks.filter((t) => t.priority === k),
    }));
  } else {
    const buckets: [string, (t: Task) => boolean][] = [
      ["Hari ini", (t) => dayOffset(t) <= 0],
      ["Besok", (t) => dayOffset(t) === 1],
      ["Minggu ini", (t) => dayOffset(t) >= 2],
    ];
    groups = buckets.map(([name, fn]) => ({
      name,
      color: "#0F766E",
      tasks: tasks.filter(fn),
    }));
  }
  groups = groups.filter((g) => g.tasks.length);

  return (
    <div className="flex flex-col gap-4 px-5 pt-[22px] pb-[90px]">
      <div className="text-ink text-[22px] font-extrabold tracking-[-0.4px]">
        Tugas
      </div>

      {/* segmented control */}
      <div className="bg-seg flex gap-1 rounded-xl p-1">
        {SEG_TABS.map((tab) => {
          const on = groupBy === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setGroupBy(tab.key)}
              className={cn(
                "h-9 flex-1 rounded-[9px] text-[12.5px] font-bold transition",
                on
                  ? "text-ink bg-white shadow-[0_2px_6px_rgba(11,59,54,.1)]"
                  : "text-mute",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {tasks.length === 0 ? (
        /* empty state */
        <div className="flex flex-col items-center gap-1.5 px-6 py-12 text-center">
          <svg width="120" height="90" viewBox="0 0 120 90" fill="none">
            <rect x="24" y="14" width="72" height="62" rx="10" fill="#E7F1EF" />
            <rect x="34" y="28" width="40" height="7" rx="3.5" fill="#BCD9D4" />
            <rect x="34" y="42" width="52" height="7" rx="3.5" fill="#CFE4E0" />
            <rect x="34" y="56" width="30" height="7" rx="3.5" fill="#CFE4E0" />
            <circle cx="92" cy="66" r="16" fill="#0F766E" />
            <path
              d="M86 66h12M92 60v12"
              stroke="#fff"
              strokeWidth="2.6"
              strokeLinecap="round"
            />
          </svg>
          <div className="text-ink mt-1.5 text-base font-extrabold">
            Belum ada tugas
          </div>
          <div className="text-mute max-w-[230px] text-[13px] leading-[1.55] text-pretty">
            Tambahkan tugas pertamamu — bisa juga lewat suara atau foto nanti.
          </div>
          <button
            onClick={openSheet}
            className="bg-teal hover:bg-teal-deep mt-3 h-11 rounded-xl px-5 text-[13.5px] font-bold text-white transition"
          >
            Tambah tugas
          </button>
        </div>
      ) : (
        groups.map((grp) => (
          <div key={grp.name} className="flex flex-col gap-2">
            <div className="mt-1 flex items-center gap-2">
              <div
                className="h-2 w-2 rounded-full"
                style={{ background: grp.color }}
              />
              <div className="text-slate text-[12.5px] font-extrabold tracking-[.5px] uppercase">
                {grp.name}
              </div>
              <div className="text-mute-2 text-[11.5px] font-bold">
                {grp.tasks.length}
              </div>
            </div>
            {grp.tasks.map((t) => (
              <TaskCard key={t.id} task={t} onToggle={onToggle} />
            ))}
          </div>
        ))
      )}
    </div>
  );
}
