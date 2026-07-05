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
  today: string; // yyyy-MM-dd
};

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

  const [{ data: profile }, { data: goals }, { data: tasks }, memories] =
    await Promise.all([
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
    ]);

  return {
    name: profile?.name?.split(" ")[0] ?? "Kamu",
    productiveTime: profile?.productive_time ?? "Pagi",
    goals: (goals ?? []).map((g) => g.title),
    tasks: tasks ?? [],
    memories: memories.map((m) => m.content),
    today,
  };
}
