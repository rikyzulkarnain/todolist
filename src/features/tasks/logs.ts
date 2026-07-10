"use server";

import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { TaskLog, TaskLogView } from "@/types/task";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { transcribeAudio } from "../ai/transcribe";

const BUCKET = "task-logs";
const SIGNED_TTL = 60 * 60; // 1 jam — cukup untuk sesi buka detail task.

// Payload lampiran multimodal dari klien (base64, tanpa prefix data URL).
type Attachment = { mimeType: string; base64: string };

// Ekstensi file dari mimeType agar objek storage rapi & bisa dibuka browser.
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
};

function extFor(mime: string): string {
  return EXT[mime.split(";")[0]] ?? "bin";
}

/**
 * Unggah satu lampiran ke bucket privat `task-logs` dengan path
 * `<user_id>/<task_id>/<uuid>.<ext>` (folder pertama = user_id, dicek RLS
 * storage). Mengembalikan path objek, atau null bila gagal (best-effort).
 */
async function uploadAttachment(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  taskId: string,
  file: Attachment,
): Promise<string | null> {
  const mime = file.mimeType.split(";")[0];
  const path = `${userId}/${taskId}/${crypto.randomUUID()}.${extFor(mime)}`;
  const bytes = Buffer.from(file.base64, "base64");
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: mime, upsert: false });
  if (error) return null;
  return path;
}

/** Buat signed URL untuk path privat; null bila path kosong / gagal. */
async function signPath(
  supabase: Awaited<ReturnType<typeof createClient>>,
  path: string | null,
): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_TTL);
  return data?.signedUrl ?? null;
}

/**
 * Ambil semua log kegiatan sebuah task (terbaru dulu), lengkap dengan signed
 * URL foto & suara. RLS "own task logs" membatasi ke milik user yang login.
 */
export async function getTaskLogs(taskId: string): Promise<TaskLogView[]> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return [];

  const { data } = await supabase
    .from("task_logs")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false })
    .returns<TaskLog[]>();

  const rows = data ?? [];
  return Promise.all(
    rows.map(async (row) => ({
      ...row,
      photoUrl: await signPath(supabase, row.photo_path),
      audioUrl: await signPath(supabase, row.audio_path),
    })),
  );
}

export type AddTaskLogInput = {
  taskId: string;
  note?: string | null;
  photo?: Attachment | null;
  audio?: Attachment | null;
};

/**
 * Tambah satu entri log kegiatan. Minimal salah satu dari catatan / foto /
 * suara harus terisi. Foto & suara diunggah ke Storage; transkrip suara
 * dihitung di latar belakang (respons terasa instan) agar bisa dibaca AI.
 */
export async function addTaskLog(
  input: AddTaskLogInput,
): Promise<{ error?: string; id?: string }> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Sesi berakhir. Silakan login ulang." };

  const note = input.note?.trim() || null;
  if (!note && !input.photo && !input.audio)
    return { error: "Tulis catatan atau lampirkan foto/suara dulu." };

  // Pastikan task milik user (RLS juga menjaga, tapi cegah orphan path).
  const { data: task } = await supabase
    .from("tasks")
    .select("id")
    .eq("id", input.taskId)
    .maybeSingle<{ id: string }>();
  if (!task) return { error: "Task tidak ditemukan." };

  const photo_path = input.photo
    ? await uploadAttachment(supabase, user.id, input.taskId, input.photo)
    : null;
  const audio_path = input.audio
    ? await uploadAttachment(supabase, user.id, input.taskId, input.audio)
    : null;

  const { data, error } = await supabase
    .from("task_logs")
    .insert({
      task_id: input.taskId,
      user_id: user.id,
      note,
      photo_path,
      audio_path,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  // Transkrip suara → teks (dibaca AI sebagai referensi jadwal). Best-effort
  // di latar belakang: kalau gagal/kuota habis, log tetap ada tanpa transkrip.
  if (input.audio) {
    const audio = input.audio;
    after(async () => {
      const res = await transcribeAudio(audio);
      const text = res.text?.trim();
      if (!text) return;
      const sb = await createClient();
      await sb.from("task_logs").update({ transcript: text }).eq("id", data.id);
    });
  }

  revalidatePath("/tasks");
  return { id: data.id as string };
}

/** Hapus satu entri log beserta objek foto/suara di Storage. */
export async function deleteTaskLog(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Sesi berakhir." };

  const { data: row } = await supabase
    .from("task_logs")
    .select("photo_path, audio_path")
    .eq("id", id)
    .maybeSingle<Pick<TaskLog, "photo_path" | "audio_path">>();

  const { error } = await supabase.from("task_logs").delete().eq("id", id);
  if (error) return { error: error.message };

  const paths = [row?.photo_path, row?.audio_path].filter(
    (p): p is string => Boolean(p),
  );
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths);

  revalidatePath("/tasks");
  return {};
}
