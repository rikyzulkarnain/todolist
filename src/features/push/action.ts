"use server";

import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export type PushSubscriptionInput = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

/** Simpan langganan Web Push milik user (upsert per endpoint). */
export async function savePushSubscription(
  sub: PushSubscriptionInput,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Sesi berakhir." };

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: sub.endpoint,
      p256dh: sub.p256dh,
      auth: sub.auth,
    },
    { onConflict: "endpoint" },
  );

  if (error) return { error: error.message };
  return {};
}

/** Hapus langganan (mis. saat user mematikan notifikasi). */
export async function deletePushSubscription(
  endpoint: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Sesi berakhir." };

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  return {};
}
