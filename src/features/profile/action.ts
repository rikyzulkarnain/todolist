"use server";

import { FREE_DAILY_QUOTA } from "@/constants/assistant-constant";
import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { Profile } from "@/types/profile";
import { format } from "date-fns";

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  if (!data) return null;
  return { ...data, email: data.email ?? user.email ?? null };
}

/** Simpan timezone IANA browser ke profil bila berbeda (dipanggil dari klien). */
export async function syncTimezone(
  timezone: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return {};
  if (!timezone || timezone.length > 64) return {};

  const { data } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .single<{ timezone: string | null }>();

  if (data?.timezone === timezone) return {};

  const { error } = await supabase
    .from("profiles")
    .update({ timezone })
    .eq("id", user.id);
  if (error) return { error: error.message };
  return {};
}

export type QuotaInfo = { used: number; limit: number };

/** Kuota AI harian = jumlah pesan user hari ini (reset otomatis tiap 00.00). */
export async function getQuota(): Promise<QuotaInfo> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { used: 0, limit: FREE_DAILY_QUOTA };

  const startOfDay = `${format(new Date(), "yyyy-MM-dd")}T00:00:00`;
  const { count } = await supabase
    .from("chat_messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("role", "user")
    .gte("created_at", startOfDay);

  return { used: count ?? 0, limit: FREE_DAILY_QUOTA };
}
