import { cache } from "react";
import { createClient } from "./server";

/**
 * User Supabase yang terautentikasi untuk request saat ini.
 *
 * `supabase.auth.getUser()` melakukan round-trip ke server auth Supabase untuk
 * memvalidasi token. Banyak server action butuh user dalam satu render pass
 * (home fan-out ke getProfile + getTasks + kuota AI). Dibungkus React `cache()`
 * supaya semua panggilan itu cukup satu round-trip per request.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
