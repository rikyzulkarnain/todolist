"use server";

import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { LifeArea, Priority, Task } from "@/types/task";
import { addDays, format } from "date-fns";
import { revalidatePath } from "next/cache";
import { generateTaskEmbedding } from "../ai/embedding";

const DATE_FMT = "yyyy-MM-dd";

function revalidateTaskScreens() {
  revalidatePath("/home");
  revalidatePath("/tasks");
  revalidatePath("/calendar");
}

/** Semua task aktif + selesai milik user, 7 hari ke depan + tanpa tanggal. */
export async function getTasks(): Promise<Task[]> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return [];

  const { data } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", user.id)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("due_time", { ascending: true, nullsFirst: false })
    .returns<Task[]>();

  return data ?? [];
}

export type AddTaskInput = {
  title: string;
  lifeArea: LifeArea;
  priority: Priority;
  /** 0 = hari ini, 1 = besok, 3 = minggu ini (mengikuti opsi di bottom sheet). */
  dayOffset: number;
  time?: string;
  source?: Task["source"];
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
      source: input.source ?? "manual",
      ...(embedding ? { embedding } : {}),
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidateTaskScreens();
  return { id: data.id as string };
}

export async function toggleTask(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Sesi berakhir." };

  const { data: task } = await supabase
    .from("tasks")
    .select("status")
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
