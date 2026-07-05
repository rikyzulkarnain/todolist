"use server";

import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { Mood, Reflection } from "@/types/reflection";
import { format, subDays } from "date-fns";
import { revalidatePath } from "next/cache";

const DATE_FMT = "yyyy-MM-dd";

/** Refleksi hari ini (null bila belum diisi). */
export async function getTodayReflection(): Promise<Reflection | null> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return null;

  const today = format(new Date(), DATE_FMT);
  const { data } = await supabase
    .from("reflections")
    .select("*")
    .eq("user_id", user.id)
    .eq("date", today)
    .maybeSingle<Reflection>();

  return data ?? null;
}

/** Refleksi 7 hari terakhir (untuk weekly review), terbaru dulu. */
export async function getRecentReflections(
  days = 7,
): Promise<Reflection[]> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return [];

  const since = format(subDays(new Date(), days - 1), DATE_FMT);
  const { data } = await supabase
    .from("reflections")
    .select("*")
    .eq("user_id", user.id)
    .gte("date", since)
    .order("date", { ascending: false })
    .returns<Reflection[]>();

  return data ?? [];
}

/** Simpan/ubah refleksi hari ini (upsert per user+tanggal). */
export async function saveReflection(input: {
  mood: Mood;
  note?: string | null;
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Sesi berakhir. Silakan login ulang." };

  const today = format(new Date(), DATE_FMT);
  const { error } = await supabase.from("reflections").upsert(
    {
      user_id: user.id,
      date: today,
      mood: input.mood,
      note: input.note?.trim() || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,date" },
  );

  if (error) return { error: error.message };
  revalidatePath("/home");
  revalidatePath("/reflection");
  revalidatePath("/review");
  return {};
}
