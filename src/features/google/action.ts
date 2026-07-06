"use server";

import { ENVIRONMENT } from "@/config/environment";
import { getCurrentUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";

export type GoogleStatus = { connected: boolean; configured: boolean };

export async function getGoogleStatus(): Promise<GoogleStatus> {
  const configured = Boolean(
    ENVIRONMENT.googleClientId && ENVIRONMENT.googleClientSecret,
  );
  const user = await getCurrentUser();
  if (!user) return { connected: false, configured };

  // Service client karena tabel token default-deny untuk user.
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("google_calendar_links")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  return { connected: Boolean(data), configured };
}

export async function disconnectGoogle(): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sesi berakhir." };

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("google_calendar_links")
    .delete()
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  return {};
}
