export const ENVIRONMENT = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  googleGenAIKey: process.env.GOOGLE_GEN_AI_API_KEY,
  // Kunci publik VAPID untuk Web Push (opsional; hanya perlu saat mengaktifkan
  // notifikasi server-side lewat Edge Function send-reminders).
  vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
};
