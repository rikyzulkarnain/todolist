import { ENVIRONMENT } from "@/config/environment";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Klien Supabase dengan service role key — MELEWATI RLS. Hanya untuk server
 * (Route Handler / Server Action) yang menyimpan data sensitif di tabel
 * default-deny, mis. token OAuth Google Calendar. JANGAN dipakai di klien.
 */
export function createServiceClient() {
  return createSupabaseClient(
    ENVIRONMENT.supabaseUrl!,
    ENVIRONMENT.supabaseServiceRoleKey!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
