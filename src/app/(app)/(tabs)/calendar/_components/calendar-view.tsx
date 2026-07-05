"use client";

import { areaColor } from "@/constants/life-area-constant";
import { getTasks } from "@/features/tasks/action";
import { cn } from "@/lib/utils";
import { useSheetStore } from "@/stores/sheet-store";
import { Task } from "@/types/task";
import { useQuery } from "@tanstack/react-query";
import { addDays, format } from "date-fns";
import { useState } from "react";

type CalView = "harian" | "mingguan";

const DAY_SHORT = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const DAY_LONG = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

function offsetLabel(offset: number, date: Date): string {
  if (offset === 0) return "Hari ini";
  if (offset === 1) return "Besok";
  return DAY_LONG[date.getDay()];
}

export default function CalendarView({
  initialTasks,
}: {
  initialTasks: Task[];
}) {
  const openSheet = useSheetStore((s) => s.openSheet);
  const [calView, setCalView] = useState<CalView>("harian");
  const [selDay, setSelDay] = useState(0);

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: () => getTasks(),
    initialData: initialTasks,
  });

  const days = [0, 1, 2, 3, 4, 5, 6].map((i) => {
    const date = addDays(new Date(), i);
    const key = format(date, "yyyy-MM-dd");
    return {
      offset: i,
      date,
      key,
      tasks: tasks
        .filter((t) => t.due_date === key)
        .sort((a, b) => (a.due_time ?? "99").localeCompare(b.due_time ?? "99")),
    };
  });

  const selected = days[selDay];

  return (
    <div className="flex flex-col gap-4 px-5 pt-[22px] pb-[90px]">
      <div className="flex items-center justify-between">
        <div className="text-ink text-[22px] font-extrabold tracking-[-0.4px]">
          Kalender
        </div>
        <div className="bg-seg flex gap-[3px] rounded-[10px] p-[3px]">
          {(["harian", "mingguan"] as CalView[]).map((k) => {
            const on = calView === k;
            return (
              <button
                key={k}
                onClick={() => setCalView(k)}
                className={cn(
                  "h-8 rounded-lg px-3.5 text-xs font-bold capitalize transition",
                  on
                    ? "text-ink bg-white shadow-[0_2px_6px_rgba(11,59,54,.1)]"
                    : "text-mute",
                )}
              >
                {k === "harian" ? "Harian" : "Mingguan"}
              </button>
            );
          })}
        </div>
      </div>

      {/* strip 7 hari */}
      <div className="flex gap-1.5">
        {days.map((d) => {
          const sel = selDay === d.offset;
          const has = d.tasks.length > 0;
          return (
            <button
              key={d.offset}
              onClick={() => setSelDay(d.offset)}
              className={cn(
                "flex flex-1 flex-col items-center gap-[3px] rounded-[14px] pt-2.5 pb-2 transition",
                sel ? "bg-teal" : "bg-transparent",
              )}
            >
              <span
                className={cn(
                  "text-[10.5px] font-bold uppercase",
                  sel ? "text-aqua-2" : "text-mute-2",
                )}
              >
                {DAY_SHORT[d.date.getDay()]}
              </span>
              <span
                className={cn(
                  "text-[15px] font-extrabold",
                  sel ? "text-white" : "text-ink-2",
                )}
              >
                {d.date.getDate()}
              </span>
              <span
                className="h-[5px] w-[5px] rounded-full"
                style={{
                  background: has ? (sel ? "#7BD8CD" : "#0F766E") : "transparent",
                }}
              />
            </button>
          );
        })}
      </div>

      {calView === "harian" ? (
        <>
          <div className="text-slate text-[13.5px] font-extrabold">
            {offsetLabel(selected.offset, selected.date)} —{" "}
            {selected.tasks.length} task
          </div>
          {selected.tasks.length === 0 ? (
            <div className="border-line-4 flex flex-col items-center gap-2 rounded-2xl border border-dashed bg-white p-7 text-center">
              <div className="text-slate-2 text-[13.5px] font-bold">
                Tidak ada task di hari ini
              </div>
              <button
                onClick={openSheet}
                className="text-teal p-1 text-[13px] font-bold hover:underline"
              >
                + Tambah task
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {selected.tasks.map((t) => {
                const done = t.status === "done";
                return (
                  <div
                    key={t.id}
                    className={cn(
                      "border-line flex items-center gap-3 rounded-2xl border bg-white px-3.5 py-3",
                      done && "opacity-50",
                    )}
                  >
                    <div className="text-slate w-11 flex-none text-xs font-bold tabular-nums">
                      {t.due_time ?? "—"}
                    </div>
                    <div
                      className="h-[30px] w-[3px] flex-none rounded-sm"
                      style={{ background: areaColor(t.life_area) }}
                    />
                    <div className="min-w-0 flex-1">
                      <div
                        className={cn(
                          "text-ink-2 text-[13.5px] font-bold",
                          done && "line-through",
                        )}
                      >
                        {t.title}
                      </div>
                      <div
                        className="mt-0.5 text-[11px] font-semibold"
                        style={{ color: areaColor(t.life_area) }}
                      >
                        {t.life_area}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col gap-3.5">
          {days
            .filter((d) => d.tasks.length)
            .map((d) => (
              <div key={d.offset}>
                <div className="text-slate mb-2 text-[12.5px] font-extrabold tracking-[.5px] uppercase">
                  {offsetLabel(d.offset, d.date)} · {d.date.getDate()}
                </div>
                <div className="flex flex-col gap-1.5">
                  {d.tasks.map((t) => {
                    const done = t.status === "done";
                    return (
                      <div
                        key={t.id}
                        className={cn(
                          "border-line flex items-center gap-2.5 rounded-[13px] border bg-white px-3 py-2.5",
                          done && "opacity-50",
                        )}
                      >
                        <div
                          className="h-[22px] w-[3px] flex-none rounded-sm"
                          style={{ background: areaColor(t.life_area) }}
                        />
                        <div
                          className={cn(
                            "text-ink-2 min-w-0 flex-1 text-[13px] font-semibold",
                            done && "line-through",
                          )}
                        >
                          {t.title}
                        </div>
                        <div className="text-mute-2 flex-none text-[11.5px] font-semibold">
                          {t.due_time ?? ""}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          {days.every((d) => !d.tasks.length) && (
            <div className="border-line-4 flex flex-col items-center gap-2 rounded-2xl border border-dashed bg-white p-7 text-center">
              <div className="text-slate-2 text-[13.5px] font-bold">
                Tidak ada task minggu ini
              </div>
              <button
                onClick={openSheet}
                className="text-teal p-1 text-[13px] font-bold hover:underline"
              >
                + Tambah task
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
