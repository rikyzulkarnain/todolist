"use server";

import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { Tag } from "@/types/task";
import { revalidatePath } from "next/cache";

function revalidateTaskScreens() {
  revalidatePath("/home");
  revalidatePath("/tasks");
  revalidatePath("/calendar");
}

/** Semua tag milik user (untuk saran/autocomplete di sheet detail task). */
export async function getTags(): Promise<Tag[]> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return [];

  const { data } = await supabase
    .from("tags")
    .select("id, name")
    .eq("user_id", user.id)
    .order("name", { ascending: true })
    .returns<Tag[]>();

  return data ?? [];
}

/** Ambil (atau buat) tag berdasarkan nama, lalu kembalikan id-nya. */
async function ensureTag(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  name: string,
): Promise<string | null> {
  const clean = name.trim();
  if (!clean) return null;

  const { data: existing } = await supabase
    .from("tags")
    .select("id")
    .eq("user_id", userId)
    .eq("name", clean)
    .maybeSingle();
  if (existing) return existing.id as string;

  const { data, error } = await supabase
    .from("tags")
    .insert({ user_id: userId, name: clean })
    .select("id")
    .single();
  if (error) return null;
  return data.id as string;
}

/**
 * Set daftar tag sebuah task (berdasarkan nama). Tag baru dibuat otomatis,
 * relasi lama yang tak lagi dipilih dihapus. Idempoten.
 */
export async function setTaskTags(
  taskId: string,
  names: string[],
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Sesi berakhir." };

  // Pastikan task milik user (RLS juga menjaga, ini untuk pesan error jelas).
  const { data: task } = await supabase
    .from("tasks")
    .select("id")
    .eq("id", taskId)
    .eq("user_id", user.id)
    .single();
  if (!task) return { error: "Task tidak ditemukan." };

  const unique = Array.from(
    new Set(names.map((n) => n.trim()).filter(Boolean)),
  ).slice(0, 12);

  const tagIds: string[] = [];
  for (const name of unique) {
    const id = await ensureTag(supabase, user.id, name);
    if (id) tagIds.push(id);
  }

  // Hapus semua relasi lama, lalu pasang yang baru (set kecil, aman diulang).
  await supabase.from("task_tags").delete().eq("task_id", taskId);
  if (tagIds.length) {
    const { error } = await supabase.from("task_tags").insert(
      tagIds.map((tag_id) => ({
        task_id: taskId,
        tag_id,
        user_id: user.id,
      })),
    );
    if (error) return { error: error.message };
  }

  revalidateTaskScreens();
  return {};
}
