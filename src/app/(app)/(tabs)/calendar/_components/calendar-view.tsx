"use client";

import { areaColor } from "@/constants/life-area-constant";
import { getTasks } from "@/features/tasks/action";
import { cn } from "@/lib/utils";
import { useSheetStore } from "@/stores/sheet-store";
import { useTaskDetailStore } from "@/stores/task-detail-store";
import { Task } from "@/types/task";
import { useQuery } from "@tanstack/react-query";
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { useState } from "react";

type CalView = "harian" | "mingguan" | "bulanan";

const DAY_SHORT = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const DAY_LONG = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

function offsetLabel(offset: number, date: Date): string {
  if (offset === 0) return "Hari ini";
  if (offset === 1) return "Besok";
  return DAY_LONG[date.getDay()];
}

function byTime(a: Task, b: Task): number {
  return (a.due_time ?? "99").localeCompare(b.due_time ?? "99");
}

export default function CalendarView({
  initialTasks,
}: {
  initialTasks: Task[];
}) {
  const openSheet = useSheetStore((s) => s.openSheet);
  const openTask = useTaskDetailStore((s) => s.openTask);
  const [calView, setCalView] = useState<CalView>("harian");
  const [selDay, setSelDay] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [selDate, setSelDate] = useState(format(new Date(), "yyyy-MM-dd"));

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
      tasks: tasks.filter((t) => t.due_date === key).sort(byTime),
    };
  });

  const selected = days[selDay];

  // Grid bulanan.
  const monthDate = addMonths(new Date(), monthOffset);
  const gridStart = startOfWeek(startOfMonth(monthDate), { weekStartsOn: 0 });
  const gridEnd = endOfWeek(endOfMonth(monthDate), { weekStartsOn: 0 });
  const monthCells: Date[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) monthCells.push(d);
  const monthWeeks: Date[][] = [];
  for (let i = 0; i < monthCells.length; i += 7)
    monthWeeks.push(monthCells.slice(i, i + 7));

  const selDateObj = parseISO(selDate);
  const selDateTasks = tasks
    .filter((t) => t.due_date === selDate)
    .sort(byTime);

  return (
    <div className="flex flex-col gap-4 px-5 pt-[22px] pb-[90px]">
      <div className="flex items-center justify-between">
        <div className="text-ink text-[22px] font-extrabold tracking-[-0.4px]">
          Kalender
        </div>
        <div className="bg-seg flex gap-[3px] rounded-[10px] p-[3px]">
          {(["harian", "mingguan", "bulanan"] as CalView[]).map((k) => {
            const on = calView === k;
            return (
              <button
                key={k}
                onClick={() => setCalView(k)}
                className={cn(
                  "h-8 rounded-lg px-3 text-xs font-bold capitalize transition",
                  on
                    ? "text-ink bg-white shadow-[0_2px_6px_rgba(11,59,54,.1)]"
                    : "text-mute",
                )}
              >
                {k}
              </button>
            );
          })}
        </div>
      </div>

      {calView !== "bulanan" && (
        /* strip 7 hari */
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
                    background: has
                      ? sel
                        ? "#7BD8CD"
                        : "#0F766E"
                      : "transparent",
                  }}
                />
              </button>
            );
          })}
        </div>
      )}

      {calView === "harian" && (
        <>
          <div className="text-slate text-[13.5px] font-extrabold">
            {offsetLabel(selected.offset, selected.date)} —{" "}
            {selected.tasks.length} task
          </div>
          {selected.tasks.length === 0 ? (
            <EmptyDay onAdd={openSheet} label="Tidak ada task di hari ini" />
          ) : (
            <div className="flex flex-col gap-2">
              {selected.tasks.map((t) => {
                const done = t.status === "done";
                return (
                  <button
                    key={t.id}
                    onClick={() => openTask(t)}
                    className={cn(
                      "border-line flex items-center gap-3 rounded-2xl border bg-white px-3.5 py-3 text-left",
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
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {calView === "mingguan" && (
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
                      <button
                        key={t.id}
                        onClick={() => openTask(t)}
                        className={cn(
                          "border-line flex items-center gap-2.5 rounded-[13px] border bg-white px-3 py-2.5 text-left",
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
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          {days.every((d) => !d.tasks.length) && (
            <EmptyDay onAdd={openSheet} label="Tidak ada task minggu ini" />
          )}
        </div>
      )}

      {calView === "bulanan" && (
        <>
          {/* header bulan + navigasi */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setMonthOffset((o) => o - 1)}
              aria-label="Bulan sebelumnya"
              className="border-line-2 text-slate hover:bg-soft flex h-9 w-9 items-center justify-center rounded-full border-[1.5px] bg-white transition"
            >
              <svg
                width="16"
                height="16"
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
            <div className="text-ink text-[15px] font-extrabold capitalize">
              {format(monthDate, "MMMM yyyy", { locale: idLocale })}
            </div>
            <button
              onClick={() => setMonthOffset((o) => o + 1)}
              aria-label="Bulan berikutnya"
              className="border-line-2 text-slate hover:bg-soft flex h-9 w-9 items-center justify-center rounded-full border-[1.5px] bg-white transition"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>

          {/* label hari */}
          <div className="grid grid-cols-7 gap-1">
            {DAY_SHORT.map((d) => (
              <div
                key={d}
                className="text-mute-2 py-1 text-center text-[10.5px] font-bold uppercase"
              >
                {d}
              </div>
            ))}
          </div>

          {/* grid tanggal */}
          <div className="flex flex-col gap-1">
            {monthWeeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 gap-1">
                {week.map((d) => {
                  const key = format(d, "yyyy-MM-dd");
                  const dayTasks = tasks.filter((t) => t.due_date === key);
                  const inMonth = isSameMonth(d, monthDate);
                  const isToday = isSameDay(d, new Date());
                  const isSel = key === selDate;
                  const dots = Array.from(
                    new Set(dayTasks.map((t) => t.life_area)),
                  ).slice(0, 3);
                  return (
                    <button
                      key={key}
                      onClick={() => setSelDate(key)}
                      className={cn(
                        "flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border text-[13px] font-bold transition",
                        isSel
                          ? "border-teal bg-teal text-white"
                          : isToday
                            ? "border-teal/40 bg-mint-2 text-ink"
                            : "border-transparent text-ink-2 hover:bg-soft",
                        !inMonth && !isSel && "text-mute-2/50",
                      )}
                    >
                      {d.getDate()}
                      <span className="flex h-[5px] items-center gap-[3px]">
                        {dots.map((area) => (
                          <span
                            key={area}
                            className="h-[5px] w-[5px] rounded-full"
                            style={{
                              background: isSel ? "#BEEDE7" : areaColor(area),
                            }}
                          />
                        ))}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* task tanggal terpilih */}
          <div className="text-slate mt-1 text-[13.5px] font-extrabold capitalize">
            {format(selDateObj, "EEEE, d MMMM", { locale: idLocale })} —{" "}
            {selDateTasks.length} task
          </div>
          {selDateTasks.length === 0 ? (
            <EmptyDay onAdd={openSheet} label="Tidak ada task di tanggal ini" />
          ) : (
            <div className="flex flex-col gap-1.5">
              {selDateTasks.map((t) => {
                const done = t.status === "done";
                return (
                  <button
                    key={t.id}
                    onClick={() => openTask(t)}
                    className={cn(
                      "border-line flex items-center gap-2.5 rounded-[13px] border bg-white px-3 py-2.5 text-left",
                      done && "opacity-50",
                    )}
                  >
                    <div className="text-slate w-10 flex-none text-[11px] font-bold tabular-nums">
                      {t.due_time ?? "—"}
                    </div>
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
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function EmptyDay({ onAdd, label }: { onAdd: () => void; label: string }) {
  return (
    <div className="border-line-4 flex flex-col items-center gap-2 rounded-2xl border border-dashed bg-white p-7 text-center">
      <div className="text-slate-2 text-[13.5px] font-bold">{label}</div>
      <button
        onClick={onAdd}
        className="text-teal p-1 text-[13px] font-bold hover:underline"
      >
        + Tambah task
      </button>
    </div>
  );
}
