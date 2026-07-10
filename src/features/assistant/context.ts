import { findMemories } from "@/features/ai/memory";
import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { daysAgoInTz, todayInTz } from "@/lib/time";
import { Task } from "@/types/task";

export type AssistantContext = {
  name: string;
  productiveTime: string;
  goals: string[];
  /** Task 7 hari ke depan + tanpa tanggal, lengkap dengan id untuk function call. */
  tasks: Task[];
  /** Memori relevan (RAG) dengan pesan terkini pengguna — v2. */
  memories: string[];
  /** Log kegiatan terbaru (apa yang sudah dilakukan) — referensi jadwal — v3.1. */
  recentActivity: string[];
  today: string; // yyyy-MM-dd
};

// Baris log kegiatan + judul task terkait (join tasks). Supabase bisa
// mengembalikan relasi to-one sebagai objek atau array — tangani keduanya.
type ActivityRow = {
  note: string | null;
  transcript: string | null;
  created_at: string;
  tasks: { title: string } | { title: string }[] | null;
};

function formatActivity(row: ActivityRow): string {
  const rel = Array.isArray(row.tasks) ? row.tasks[0] : row.tasks;
  const title = rel?.title ?? "(task)";
  const date = row.created_at.slice(0, 10);
  const text = [row.note, row.transcript].filter(Boolean).join(" — ");
  return `- ${date} · ${title}: ${text}`;
}

/**
 * Context bundle yang dirakit sebelum memanggil AI (PRD §6.1): profil (jam
 * produktif), goal aktif, dan task hari ini + minggu ini. Dibatasi 7 hari
 * agar ukuran konteks (biaya token) terkendali.
 */
export async function getAssistantContext(
  query?: string,
): Promise<AssistantContext> {
  const supabase = await createClient();
  const user = await getCurrentUser();

  const emptyTz = todayInTz();
  const empty: AssistantContext = {
    name: "Kamu",
    productiveTime: "Pagi",
    goals: [],
    tasks: [],
    memories: [],
    recentActivity: [],
    today: emptyTz,
  };
  if (!user) return empty;

  const { data: profileTz } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .maybeSingle<{ timezone: string | null }>();
  const tz = profileTz?.timezone ?? undefined;
  const today = todayInTz(tz);
  const weekEnd = daysAgoInTz(-7, tz); // 7 hari ke depan

  const [
    { data: profile },
    { data: goals },
    { data: tasks },
    memories,
    { data: activity },
  ] = await Promise.all([
      supabase
        .from("profiles")
        .select("name, productive_time")
        .eq("id", user.id)
        .single(),
      supabase
        .from("goals")
        .select("title")
        .eq("user_id", user.id)
        .eq("status", "active"),
      supabase
        .from("tasks")
        .select("*")
        .eq("user_id", user.id)
        .or(`due_date.is.null,and(due_date.gte.${today},due_date.lte.${weekEnd})`)
        .returns<Task[]>(),
      // RAG: memori relevan dengan pesan terkini (kalau ada).
      query ? findMemories(query, 4) : Promise.resolve([]),
      // Log kegiatan terbaru (dokumentasi apa yang sudah dilakukan) — referensi
      // AI untuk menyusun langkah berikutnya. Ambil yang punya teks (note/transkrip).
      supabase
        .from("task_logs")
        .select("note, transcript, created_at, tasks(title)")
        .eq("user_id", user.id)
        .or("note.not.is.null,transcript.not.is.null")
        .order("created_at", { ascending: false })
        .limit(8)
        .returns<ActivityRow[]>(),
    ]);

  return {
    name: profile?.name?.split(" ")[0] ?? "Kamu",
    productiveTime: profile?.productive_time ?? "Pagi",
    goals: (goals ?? []).map((g) => g.title),
    tasks: tasks ?? [],
    memories: memories.map((m) => m.content),
    recentActivity: (activity ?? []).map(formatActivity),
    today,
  };
}
