"use server";

import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { LifeArea } from "@/types/task";
import { format, parseISO, subDays } from "date-fns";

const DATE_FMT = "yyyy-MM-dd";
const DAY_LONG = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
];

export type WeeklyReview = {
  rangeLabel: string;
  total: number;
  done: number;
  completionRate: number; // 0..1
  byArea: { area: LifeArea; done: number; total: number }[];
  bestDay: string | null; // hari dengan penyelesaian terbanyak
  bestDayCount: number;
  avgMood: number | null; // 1..5
  reflectionDays: number; // dari 7
  insights: string[];
};

type TaskLite = {
  life_area: LifeArea;
  due_date: string | null;
  status: string;
  completed_at: string | null;
};

/** Ringkasan mingguan (7 hari terakhir): statistik task + mood + insight. */
export async function getWeeklyReview(): Promise<WeeklyReview> {
  const supabase = await createClient();
  const user = await getCurrentUser();

  const today = new Date();
  const start = subDays(today, 6);
  const startStr = format(start, DATE_FMT);
  const todayStr = format(today, DATE_FMT);
  const rangeLabel = `${format(start, "d MMM")} – ${format(today, "d MMM")}`;

  const empty: WeeklyReview = {
    rangeLabel,
    total: 0,
    done: 0,
    completionRate: 0,
    byArea: [],
    bestDay: null,
    bestDayCount: 0,
    avgMood: null,
    reflectionDays: 0,
    insights: ["Belum ada data minggu ini. Mulai tambahkan dan selesaikan task."],
  };
  if (!user) return empty;

  const [{ data: tasks }, { data: reflections }] = await Promise.all([
    supabase
      .from("tasks")
      .select("life_area, due_date, status, completed_at")
      .eq("user_id", user.id)
      .gte("due_date", startStr)
      .lte("due_date", todayStr)
      .returns<TaskLite[]>(),
    supabase
      .from("reflections")
      .select("mood")
      .eq("user_id", user.id)
      .gte("date", startStr)
      .returns<{ mood: number }[]>(),
  ]);

  const weekTasks = tasks ?? [];
  const total = weekTasks.length;
  const doneTasks = weekTasks.filter((t) => t.status === "done");
  const done = doneTasks.length;
  const completionRate = total ? done / total : 0;

  // Breakdown per Life Area.
  const areaMap = new Map<LifeArea, { done: number; total: number }>();
  for (const t of weekTasks) {
    const cur = areaMap.get(t.life_area) ?? { done: 0, total: 0 };
    cur.total += 1;
    if (t.status === "done") cur.done += 1;
    areaMap.set(t.life_area, cur);
  }
  const byArea = Array.from(areaMap.entries())
    .map(([area, v]) => ({ area, ...v }))
    .sort((a, b) => b.done - a.done);

  // Hari paling produktif berdasarkan waktu penyelesaian.
  const dayCounts = new Array(7).fill(0);
  for (const t of doneTasks) {
    if (t.completed_at) dayCounts[parseISO(t.completed_at).getDay()] += 1;
  }
  const bestDayCount = Math.max(0, ...dayCounts);
  const bestDay =
    bestDayCount > 0 ? DAY_LONG[dayCounts.indexOf(bestDayCount)] : null;

  // Mood rata-rata.
  const moods = (reflections ?? []).map((r) => r.mood);
  const avgMood = moods.length
    ? Math.round((moods.reduce((s, m) => s + m, 0) / moods.length) * 10) / 10
    : null;

  const insights = buildInsights({
    total,
    done,
    completionRate,
    topArea: byArea[0]?.area ?? null,
    bestDay,
    avgMood,
    reflectionDays: moods.length,
  });

  return {
    rangeLabel,
    total,
    done,
    completionRate,
    byArea,
    bestDay,
    bestDayCount,
    avgMood,
    reflectionDays: moods.length,
    insights,
  };
}

/** Insight rule-based (PRD §6.4: mulai dari aturan atas data nyata). */
function buildInsights(s: {
  total: number;
  done: number;
  completionRate: number;
  topArea: LifeArea | null;
  bestDay: string | null;
  avgMood: number | null;
  reflectionDays: number;
}): string[] {
  const out: string[] = [];
  const pct = Math.round(s.completionRate * 100);

  if (s.total === 0) {
    out.push("Belum ada task minggu ini — coba mulai dari satu hal kecil.");
    return out;
  }

  if (s.completionRate >= 0.8) {
    out.push(`Minggu yang produktif — ${pct}% task selesai. Pertahankan ritmenya!`);
  } else if (s.completionRate >= 0.5) {
    out.push(`Setengah jalan tercapai (${pct}%). Fokuskan 1–2 task penting besok.`);
  } else {
    out.push(
      `Minggu ini terasa berat (${pct}% selesai). Kurangi beban — pilih task paling penting saja.`,
    );
  }

  if (s.topArea && s.done > 0)
    out.push(`Paling banyak beres di area "${s.topArea}".`);
  if (s.bestDay)
    out.push(`${s.bestDay} jadi harimu paling produktif minggu ini.`);

  if (s.avgMood !== null) {
    if (s.avgMood >= 4)
      out.push(`Mood rata-rata bagus (${s.avgMood}/5). Energi positifmu terlihat.`);
    else if (s.avgMood >= 3)
      out.push(`Mood rata-rata cukup stabil (${s.avgMood}/5).`);
    else
      out.push(
        `Mood rata-rata rendah (${s.avgMood}/5). Beri ruang untuk istirahat minggu depan.`,
      );
  }

  if (s.reflectionDays === 0)
    out.push("Belum ada refleksi. Coba catat mood harianmu untuk insight lebih akurat.");
  else if (s.reflectionDays >= 5)
    out.push(`Konsisten refleksi ${s.reflectionDays}/7 hari — kebiasaan yang bagus.`);

  return out;
}
