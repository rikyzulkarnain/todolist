import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { Task } from "@/types/task";
import { addDays, format } from "date-fns";

export type AssistantContext = {
  name: string;
  productiveTime: string;
  goals: string[];
  /** Task 7 hari ke depan + tanpa tanggal, lengkap dengan id untuk function call. */
  tasks: Task[];
  today: string; // yyyy-MM-dd
};

/**
 * Context bundle yang dirakit sebelum memanggil AI (PRD §6.1): profil (jam
 * produktif), goal aktif, dan task hari ini + minggu ini. Dibatasi 7 hari
 * agar ukuran konteks (biaya token) terkendali.
 */
export async function getAssistantContext(): Promise<AssistantContext> {
  const supabase = await createClient();
  const user = await getCurrentUser();

  const today = format(new Date(), "yyyy-MM-dd");
  const weekEnd = format(addDays(new Date(), 7), "yyyy-MM-dd");

  const empty: AssistantContext = {
    name: "Kamu",
    productiveTime: "Pagi",
    goals: [],
    tasks: [],
    today,
  };
  if (!user) return empty;

  const [{ data: profile }, { data: goals }, { data: tasks }] =
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
    ]);

  return {
    name: profile?.name?.split(" ")[0] ?? "Kamu",
    productiveTime: profile?.productive_time ?? "Pagi",
    goals: (goals ?? []).map((g) => g.title),
    tasks: tasks ?? [],
    today,
  };
}
