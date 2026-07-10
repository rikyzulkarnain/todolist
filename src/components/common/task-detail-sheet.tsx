"use client";

import {
  alphaColor,
  LIFE_AREA_NAMES,
  LIFE_AREAS,
} from "@/constants/life-area-constant";
import { PRIORITIES, PRIORITY_KEYS } from "@/constants/priority-constant";
import {
  addSubtask,
  deleteTask,
  getTasks,
  toggleTask,
  updateTask,
} from "@/features/tasks/action";
import { getActiveGoals } from "@/features/goals/action";
import { getTags, setTaskTags } from "@/features/tags/action";
import { ensureNotificationPermission } from "@/lib/notifications";
import { cn } from "@/lib/utils";
import { useTaskDetailStore } from "@/stores/task-detail-store";
import TaskLogSection from "@/components/common/task-log-section";
import {
  LifeArea,
  Priority,
  ReminderType,
  RepeatRule,
  Task,
} from "@/types/task";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const REPEAT_OPTIONS: { value: RepeatRule | ""; name: string }[] = [
  { value: "", name: "Tidak" },
  { value: "FREQ=DAILY", name: "Harian" },
  { value: "FREQ=WEEKLY", name: "Mingguan" },
  { value: "FREQ=MONTHLY", name: "Bulanan" },
];

const REMINDER_OPTIONS: { value: ReminderType; name: string }[] = [
  { value: "none", name: "Tidak" },
  { value: "push", name: "Notifikasi" },
  { value: "alarm", name: "Alarm" },
];

export default function TaskDetailSheet() {
  const queryClient = useQueryClient();
  const { task: opened, closeTask } = useTaskDetailStore();

  // Versi terkini dari cache react-query (subtask/tags ikut ter-update setelah
  // mutasi), fallback ke snapshot yang dibuka bila cache belum ada.
  const { data: tasks } = useQuery({
    queryKey: ["tasks"],
    queryFn: () => getTasks(),
    enabled: Boolean(opened),
  });
  const task: Task | null = opened
    ? (tasks?.find((t) => t.id === opened.id) ?? opened)
    : null;

  const { data: allTags = [] } = useQuery({
    queryKey: ["tags"],
    queryFn: () => getTags(),
    enabled: Boolean(opened),
  });

  const { data: activeGoals = [] } = useQuery({
    queryKey: ["active-goals"],
    queryFn: () => getActiveGoals(),
    enabled: Boolean(opened),
  });

  const [title, setTitle] = useState("");
  const [area, setArea] = useState<LifeArea>("Karier");
  const [priority, setPriority] = useState<Priority>("sedang");
  const [dueDate, setDueDate] = useState<string>("");
  const [time, setTime] = useState<string>("");
  const [repeat, setRepeat] = useState<RepeatRule | "">("");
  const [reminder, setReminder] = useState<ReminderType>("push");
  const [goalId, setGoalId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [subtaskInput, setSubtaskInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragY, setDragY] = useState(0);
  const dragStart = useRef<number | null>(null);

  // Isi form saat sheet dibuka untuk task baru (dipantau lewat id).
  useEffect(() => {
    if (!opened) return;
    setTitle(opened.title);
    setArea(opened.life_area);
    setPriority(opened.priority);
    setDueDate(opened.due_date ?? "");
    setTime(opened.due_time ?? "");
    setRepeat(opened.repeat_rule ?? "");
    setReminder(opened.reminder ?? "push");
    setGoalId(opened.goal_id ?? null);
    setNotes(opened.notes ?? "");
    setTags((opened.tags ?? []).map((t) => t.name));
    setTagInput("");
    setSubtaskInput("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened?.id]);

  if (!opened || !task) return null;

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["tasks"] });

  // Swipe/tarik ke bawah pada area grabber untuk menutup sheet.
  function onDragStart(y: number) {
    dragStart.current = y;
  }
  function onDragMove(y: number) {
    if (dragStart.current === null) return;
    const dy = y - dragStart.current;
    if (dy > 0) setDragY(dy);
  }
  function onDragEnd() {
    if (dragY > 110) closeTask();
    setDragY(0);
    dragStart.current = null;
  }

  function addTagFromInput() {
    const clean = tagInput.trim().replace(/,+$/, "");
    if (!clean) return;
    if (!tags.includes(clean)) setTags([...tags, clean]);
    setTagInput("");
  }

  async function pickReminder(value: ReminderType) {
    setReminder(value);
    // Minta izin notifikasi saat pertama memilih push/alarm (butuh gestur user).
    if (value !== "none") {
      const ok = await ensureNotificationPermission();
      if (!ok && value === "push") {
        toast("Izin notifikasi belum aktif — alarm layar penuh tetap berbunyi.");
      }
    }
  }

  async function onSave() {
    const clean = title.trim();
    if (!clean) {
      toast.error("Judul tugas tidak boleh kosong");
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const res = await updateTask({
        id: task!.id,
        title: clean,
        lifeArea: area,
        priority,
        dueDate: dueDate || null,
        time: time || null,
        notes: notes || null,
        repeatRule: repeat || null,
        reminder,
        goalId,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      await setTaskTags(task!.id, tags);
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      toast.success("Tugas diperbarui");
      closeTask();
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await deleteTask(task!.id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      refresh();
      toast.success("Tugas dihapus");
      closeTask();
    } finally {
      setBusy(false);
    }
  }

  async function onAddSubtask() {
    const clean = subtaskInput.trim();
    if (!clean) return;
    setSubtaskInput("");
    const res = await addSubtask(task!.id, clean);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    refresh();
  }

  async function onToggleSubtask(id: string) {
    await toggleTask(id);
    refresh();
  }

  const subtasks = task.subtasks ?? [];
  const doneSub = subtasks.filter((s) => s.status === "done").length;

  return (
    <>
      <div
        onClick={closeTask}
        className="absolute inset-0 z-50 bg-[rgba(9,40,37,.45)]"
      />
      <div
        className="anim-sheet-up absolute right-0 bottom-0 left-0 z-[51] max-h-[88%] overflow-y-auto rounded-t-3xl bg-white px-5 pt-3.5 pb-6"
        style={{
          transform: dragY ? `translateY(${dragY}px)` : undefined,
          transition: dragY ? "none" : "transform .22s ease",
        }}
      >
        {/* grabber — tarik ke bawah / klik untuk menutup */}
        <div
          onClick={closeTask}
          onTouchStart={(e) => onDragStart(e.touches[0].clientY)}
          onTouchMove={(e) => onDragMove(e.touches[0].clientY)}
          onTouchEnd={onDragEnd}
          className="-mx-5 -mt-3.5 cursor-pointer px-5 pt-3.5 pb-1"
          style={{ touchAction: "none" }}
          aria-label="Tarik atau klik untuk menutup"
        >
          <div className="bg-line-3 mx-auto h-1.5 w-11 rounded-full" />
        </div>
        <div className="mt-2 mb-3.5 flex items-center justify-between gap-2 pt-3">
          <div className="text-ink text-[17px] font-extrabold">Detail tugas</div>
          <div className="flex items-center gap-1">
            <button
              onClick={onDelete}
              disabled={busy}
              className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-bold text-[#DC2626] transition hover:bg-[#FEF2F2] disabled:opacity-50"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
              </svg>
              Hapus
            </button>
            <button
              onClick={closeTask}
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
        </div>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Judul tugas"
          className="border-line-2 bg-soft text-ink-2 focus:border-teal h-[50px] w-full rounded-[14px] border-[1.5px] px-4 text-[15px] font-semibold outline-none focus:bg-white"
        />

        <SectionLabel>Life Area</SectionLabel>
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

        <SectionLabel>Prioritas</SectionLabel>
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

        <div className="mt-4 flex gap-3">
          <div className="flex-1">
            <SectionLabel className="mt-0">Jatuh tempo</SectionLabel>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="border-line-2 bg-soft text-ink-2 focus:border-teal h-11 w-full rounded-xl border-[1.5px] px-3 text-[13.5px] font-semibold outline-none focus:bg-white"
            />
          </div>
          <div className="w-[120px]">
            <SectionLabel className="mt-0">Waktu</SectionLabel>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="border-line-2 bg-soft text-ink-2 focus:border-teal h-11 w-full rounded-xl border-[1.5px] px-3 text-[13.5px] font-semibold outline-none focus:bg-white"
            />
          </div>
        </div>

        <SectionLabel>Ulangi</SectionLabel>
        <div className="flex gap-[7px]">
          {REPEAT_OPTIONS.map((o) => {
            const sel = repeat === o.value;
            return (
              <button
                key={o.value || "none"}
                onClick={() => setRepeat(o.value)}
                className={cn(
                  "h-8 rounded-2xl border-[1.5px] px-3 text-xs font-bold transition-all duration-100",
                  sel
                    ? "border-teal bg-mint-2 text-teal"
                    : "border-line-2 text-slate-2 bg-white",
                )}
              >
                {o.name}
              </button>
            );
          })}
        </div>

        <SectionLabel>Pengingat</SectionLabel>
        <div className="flex gap-[7px]">
          {REMINDER_OPTIONS.map((o) => {
            const sel = reminder === o.value;
            return (
              <button
                key={o.value}
                onClick={() => pickReminder(o.value)}
                className={cn(
                  "h-8 rounded-2xl border-[1.5px] px-3 text-xs font-bold transition-all duration-100",
                  sel
                    ? "border-teal bg-mint-2 text-teal"
                    : "border-line-2 text-slate-2 bg-white",
                )}
              >
                {o.name}
              </button>
            );
          })}
        </div>
        {reminder !== "none" && !time && (
          <div className="text-mute-2 mt-1.5 text-[11.5px] font-semibold">
            Isi waktu di atas agar pengingat bisa berbunyi.
          </div>
        )}

        {activeGoals.length > 0 && (
          <>
            <SectionLabel>Goal terkait</SectionLabel>
            <div className="relative">
              <select
                value={goalId ?? ""}
                onChange={(e) => setGoalId(e.target.value || null)}
                className="border-line-2 bg-soft text-ink-2 focus:border-teal h-11 w-full appearance-none rounded-xl border-[1.5px] px-3.5 pr-9 text-[13.5px] font-semibold outline-none focus:bg-white"
              >
                <option value="">Tidak terkait goal</option>
                {activeGoals.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title}
                  </option>
                ))}
              </select>
              <svg
                className="text-mute pointer-events-none absolute top-1/2 right-3 -translate-y-1/2"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </div>
          </>
        )}

        <SectionLabel>Tag</SectionLabel>
        <div className="flex flex-wrap gap-[7px]">
          {tags.map((t) => (
            <span
              key={t}
              className="bg-mint-2 text-teal flex h-8 items-center gap-1.5 rounded-2xl px-3 text-xs font-bold"
            >
              #{t}
              <button
                onClick={() => setTags(tags.filter((x) => x !== t))}
                aria-label={`Hapus tag ${t}`}
                className="text-teal/70 hover:text-teal"
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                addTagFromInput();
              }
            }}
            onBlur={addTagFromInput}
            placeholder="+ tag"
            className="border-line-2 bg-soft text-ink-2 focus:border-teal h-8 w-[90px] rounded-2xl border-[1.5px] px-3 text-xs font-semibold outline-none focus:bg-white"
          />
        </div>
        {allTags.filter((t) => !tags.includes(t.name)).length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {allTags
              .filter((t) => !tags.includes(t.name))
              .slice(0, 8)
              .map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTags([...tags, t.name])}
                  className="text-mute border-line-2 hover:border-teal hover:text-teal h-7 rounded-full border px-2.5 text-[11px] font-semibold transition"
                >
                  #{t.name}
                </button>
              ))}
          </div>
        )}

        <SectionLabel>
          Subtask{subtasks.length > 0 && ` · ${doneSub}/${subtasks.length}`}
        </SectionLabel>
        <div className="flex flex-col gap-1.5">
          {subtasks.map((s) => {
            const done = s.status === "done";
            return (
              <div key={s.id} className="flex items-center gap-2.5">
                <button
                  onClick={() => onToggleSubtask(s.id)}
                  aria-label={done ? "Batalkan subtask" : "Selesaikan subtask"}
                  className={cn(
                    "flex h-[22px] w-[22px] flex-none items-center justify-center rounded-[7px] border-[1.5px] transition",
                    done
                      ? "bg-teal border-teal"
                      : "border-line-3 bg-white hover:border-teal",
                  )}
                >
                  {done && (
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#fff"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </button>
                <span
                  className={cn(
                    "text-ink-2 text-[13.5px] font-semibold",
                    done && "text-mute line-through",
                  )}
                >
                  {s.title}
                </span>
              </div>
            );
          })}
          <div className="mt-1 flex gap-2">
            <input
              value={subtaskInput}
              onChange={(e) => setSubtaskInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onAddSubtask()}
              placeholder="Tambah subtask…"
              className="border-line-2 bg-soft text-ink-2 focus:border-teal h-10 flex-1 rounded-xl border-[1.5px] px-3 text-[13.5px] outline-none focus:bg-white"
            />
            <button
              onClick={onAddSubtask}
              className="border-line-2 text-teal hover:border-teal h-10 rounded-xl border-[1.5px] bg-white px-3.5 text-[13px] font-bold transition"
            >
              Tambah
            </button>
          </div>
        </div>

        <SectionLabel>Catatan</SectionLabel>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Catatan tambahan (opsional)"
          rows={2}
          className="border-line-2 bg-soft text-ink-2 focus:border-teal w-full resize-none rounded-xl border-[1.5px] px-3 py-2.5 text-[13.5px] outline-none focus:bg-white"
        />

        <SectionLabel>Log Kegiatan</SectionLabel>
        <TaskLogSection taskId={task.id} />

        <div className="mt-5 flex gap-2.5">
          <button
            onClick={closeTask}
            className="border-line-2 text-slate h-[50px] flex-1 rounded-[14px] border-[1.5px] bg-white text-[15px] font-bold transition hover:bg-[#F7FAF9]"
          >
            Batal
          </button>
          <button
            onClick={onSave}
            disabled={busy}
            className="bg-teal hover:bg-teal-deep h-[50px] flex-[1.4] rounded-[14px] text-[15px] font-bold text-white transition disabled:opacity-60"
          >
            {busy ? "Menyimpan…" : "Simpan"}
          </button>
        </div>
      </div>
    </>
  );
}

function SectionLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "text-slate mt-4 mb-2 text-[11.5px] font-extrabold tracking-[.5px] uppercase",
        className,
      )}
    >
      {children}
    </div>
  );
}
