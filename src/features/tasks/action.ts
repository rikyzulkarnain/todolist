"use server";

import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import {
  LifeArea,
  Priority,
  ReminderType,
  RepeatRule,
  Tag,
  Task,
} from "@/types/task";
import { addDays, addMonths, format, parseISO } from "date-fns";
import { revalidatePath } from "next/cache";
import { generateTaskEmbedding } from "../ai/embedding";

const DATE_FMT = "yyyy-MM-dd";

function revalidateTaskScreens() {
  revalidatePath("/home");
  revalidatePath("/tasks");
  revalidatePath("/calendar");
}

// Baris tasks + join task_tags→tags. Supabase mengembalikan tags bersarang.
type TaskRow = Omit<Task, "tags" | "subtasks"> & {
  task_tags?: { tags: Tag | null }[] | null;
};

function mapTags(row: TaskRow): Tag[] {
  return (row.task_tags ?? [])
    .map((tt) => tt.tags)
    .filter((t): t is Tag => Boolean(t));
}

/**
 * Task top-level milik user (parent_task_id null) beserta tags & subtask-nya.
 * Subtask dinested ke induknya, bukan ditampilkan sebagai item list terpisah.
 */
export async function getTasks(): Promise<Task[]> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return [];

  const { data } = await supabase
    .from("tasks")
    .select("*, task_tags(tags(id, name))")
    .eq("user_id", user.id)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("due_time", { ascending: true, nullsFirst: false })
    .returns<TaskRow[]>();

  const rows = data ?? [];
  const subByParent = new Map<string, Task[]>();
  const parents: Task[] = [];

  for (const row of rows) {
    const task: Task = { ...row, tags: mapTags(row), subtasks: [] };
    if (row.parent_task_id) {
      const list = subByParent.get(row.parent_task_id) ?? [];
      list.push(task);
      subByParent.set(row.parent_task_id, list);
    } else {
      parents.push(task);
    }
  }

  for (const p of parents) p.subtasks = subByParent.get(p.id) ?? [];
  return parents;
}

export type AddTaskInput = {
  title: string;
  lifeArea: LifeArea;
  priority: Priority;
  /** 0 = hari ini, 1 = besok, 3 = minggu ini (mengikuti opsi di bottom sheet). */
  dayOffset: number;
  time?: string;
  source?: Task["source"];
  repeatRule?: RepeatRule | null;
  reminder?: ReminderType;
};

export async function addTask(
  input: AddTaskInput,
): Promise<{ error?: string; id?: string }> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Sesi berakhir. Silakan login ulang." };

  const title = input.title.trim();
  if (!title) return { error: "Tulis judul tugas dulu" };

  const due_date = format(addDays(new Date(), input.dayOffset), DATE_FMT);
  const due_time = input.time || null;
  // Embedding untuk pencarian semantik (pola createTransaction fina-app).
  const embedding = await generateTaskEmbedding({
    title,
    life_area: input.lifeArea,
    priority: input.priority,
    due_date,
    due_time,
  });

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      user_id: user.id,
      title,
      life_area: input.lifeArea,
      priority: input.priority,
      due_date,
      due_time,
      repeat_rule: input.repeatRule ?? null,
      reminder: input.reminder ?? "push",
      source: input.source ?? "manual",
      ...(embedding ? { embedding } : {}),
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidateTaskScreens();
  return { id: data.id as string };
}

export type UpdateTaskInput = {
  id: string;
  title: string;
  lifeArea: LifeArea;
  priority: Priority;
  dueDate: string | null; // yyyy-MM-dd
  time?: string | null;
  notes?: string | null;
  repeatRule?: RepeatRule | null;
  reminder?: ReminderType;
  goalId?: string | null;
};

/** Edit penuh sebuah task (judul, life area, prioritas, tanggal, waktu, dst). */
export async function updateTask(
  input: UpdateTaskInput,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Sesi berakhir." };

  const title = input.title.trim();
  if (!title) return { error: "Judul tugas tidak boleh kosong" };

  const due_date = input.dueDate;
  const due_time = input.time || null;
  // Judul/area/tanggal ikut di teks embedding → re-embed saat diedit.
  const embedding = await generateTaskEmbedding({
    title,
    notes: input.notes,
    life_area: input.lifeArea,
    priority: input.priority,
    due_date,
    due_time,
  });

  const { error } = await supabase
    .from("tasks")
    .update({
      title,
      life_area: input.lifeArea,
      priority: input.priority,
      due_date,
      due_time,
      notes: input.notes ?? null,
      repeat_rule: input.repeatRule ?? null,
      ...(input.reminder ? { reminder: input.reminder } : {}),
      ...(input.goalId !== undefined ? { goal_id: input.goalId } : {}),
      ...(embedding ? { embedding } : {}),
    })
    .eq("id", input.id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidateTaskScreens();
  return {};
}

/** Tambah subtask di bawah sebuah task induk (mewarisi life area induk). */
export async function addSubtask(
  parentId: string,
  title: string,
): Promise<{ error?: string; id?: string }> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Sesi berakhir." };

  const clean = title.trim();
  if (!clean) return { error: "Tulis judul subtask dulu" };

  const { data: parent } = await supabase
    .from("tasks")
    .select("life_area, priority, due_date")
    .eq("id", parentId)
    .eq("user_id", user.id)
    .single();
  if (!parent) return { error: "Task induk tidak ditemukan." };

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      user_id: user.id,
      parent_task_id: parentId,
      title: clean,
      life_area: parent.life_area,
      priority: parent.priority,
      due_date: parent.due_date,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidateTaskScreens();
  return { id: data.id as string };
}

/** Advance due_date sesuai repeat_rule untuk membuat kemunculan berikutnya. */
function nextDueDate(dueDate: string, rule: RepeatRule): string {
  const d = parseISO(dueDate);
  if (rule === "FREQ=DAILY") return format(addDays(d, 1), DATE_FMT);
  if (rule === "FREQ=WEEKLY") return format(addDays(d, 7), DATE_FMT);
  return format(addMonths(d, 1), DATE_FMT); // FREQ=MONTHLY
}

export async function toggleTask(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Sesi berakhir." };

  const { data: task } = await supabase
    .from("tasks")
    .select("status, title, life_area, priority, due_date, due_time, repeat_rule")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!task) return { error: "Task tidak ditemukan." };

  const done = task.status === "done";
  const { error } = await supabase
    .from("tasks")
    .update({
      status: done ? "todo" : "done",
      completed_at: done ? null : new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  // Task berulang: saat diselesaikan, buat kemunculan berikutnya (todo baru).
  if (!done && task.repeat_rule && task.due_date) {
    const due_date = nextDueDate(task.due_date, task.repeat_rule as RepeatRule);
    const embedding = await generateTaskEmbedding({
      title: task.title,
      life_area: task.life_area,
      priority: task.priority,
      due_date,
      due_time: task.due_time,
    });
    await supabase.from("tasks").insert({
      user_id: user.id,
      title: task.title,
      life_area: task.life_area,
      priority: task.priority,
      due_date,
      due_time: task.due_time,
      repeat_rule: task.repeat_rule,
      ...(embedding ? { embedding } : {}),
    });
  }

  revalidateTaskScreens();
  return {};
}

export async function deleteTask(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Sesi berakhir." };

  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidateTaskScreens();
  return {};
}

/** Geser task ke hari lain (aksi "Jadwalkan ulang" pada reminder). */
export async function rescheduleTask(
  id: string,
  dayOffset: number,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Sesi berakhir." };

  const { data: task } = await supabase
    .from("tasks")
    .select("title, notes, life_area, priority, due_time")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!task) return { error: "Task tidak ditemukan." };

  const due_date = format(addDays(new Date(), dayOffset), DATE_FMT);
  // Tanggal ikut di teks embedding, jadi re-embed saat dijadwalkan ulang
  // (pola updateTransaction fina-app).
  const embedding = await generateTaskEmbedding({ ...task, due_date });

  const { error } = await supabase
    .from("tasks")
    .update({ due_date, ...(embedding ? { embedding } : {}) })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidateTaskScreens();
  return {};
}
